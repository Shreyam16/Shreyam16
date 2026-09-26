"""
Renders photoreal stills of every room stop with Blender Cycles (bpy), from the live scene.

  python3 bake/render_stops.py [--shard 0 --of 6] [--samples 64] [--exposure 0]

Reads bake/stops/scene.glb and bake/stops/stops.json (scripts/export-stops.mjs) and
bake/layout.json (light positions), and writes bake/stops/out/<stop>.<land|port>.png.

Each stop is rendered twice with the live camera's exact pose and vertical field of view:
landscape 2.4:1 at 52° (for screens from 0.8:1 to 2.4:1) and portrait 0.8:1 at 68° (phones), so the
site can crop the centre with object-fit: cover and the still lines up with the 3D view.

The light rig is the light bake's (bake/bake.py): a spot under every downlight, coves, the
chandelier and the counter strip, at dusk (the window light is a faint blue, not daylight).
Coordinates: three.js (x, y-up, z toward street) -> Blender (x, -z, y), as the glTF importer does.
"""
import json, math, os, sys
import bpy
import addon_utils
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STOPS = json.load(open(os.path.join(ROOT, 'bake', 'stops', 'stops.json')))
L = json.load(open(os.path.join(ROOT, 'bake', 'layout.json')))
OUT = os.path.join(ROOT, 'bake', 'stops', 'out')
os.makedirs(OUT, exist_ok=True)
args = sys.argv[1:]
def arg(name, default):
    return type(default)(args[args.index(name) + 1]) if name in args else default
SHARD, OF = arg('--shard', 0), arg('--of', 1)
SAMPLES, EXPOSURE = arg('--samples', 64), arg('--exposure', 0.0)
VARIANTS = {'land': (2304, 960, STOPS['fov']['land']), 'port': (1080, 1350, STOPS['fov']['port'])}

def B(x, y, z):
    return (x, -z, y)

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('io_scene_gltf2', default_set=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'bake', 'stops', 'scene.glb'))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.03
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 3
scene.cycles.transmission_bounces = 6
scene.cycles.transparent_max_bounces = 16
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 1.0
scene.cycles.sample_clamp_indirect = 4.0
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = EXPOSURE

world = bpy.data.worlds.new('dusk')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.016, 0.03, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
scene.world = world

# --- materials: thin glass, real light from the emissive fittings ------------------------------
def principled(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None

def thin_glass(m):
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.08
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.02
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lw.outputs['Fresnel'], mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
    nt.links.new(gl.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

EMIT = {'sconce': 3.0, 'downlightLens': 3.0, 'lightStrip': 4.0, 'cove': 4.0, 'candle': 3.0, 'warmWindow': 2.0}
for m in bpy.data.materials:
    base = m.name.split('.')[0]
    if base in ('glass', 'doorGlass'):
        thin_glass(m)
        continue
    p = principled(m)
    if not p:
        continue
    if base in EMIT:
        s = p.inputs['Emission Strength']
        s.default_value = max(1.0, s.default_value) * EMIT[base]
    if base == 'terrazzo':
        p.inputs['Roughness'].default_value = 0.22

# --- lights (as the bake) -----------------------------------------------------------------------
F = L['features']
H = L['CEILING']
sal = F['salon']
k = L['cashier']

def kelvin(kv):
    t = kv / 100
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.12 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.52 * math.log(t - 10) - 305.04)
    return tuple(max(0, min(255, v)) / 255 for v in (r, g, b))

def area(x, y, z, sx, sz, power, temp, rot=(0, 0, 0)):
    d = bpy.data.lights.new('area', 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = sx, sz
    d.energy = power
    d.color = kelvin(temp)
    o = bpy.data.objects.new('area', d)
    o.location = B(x, y, z)
    o.rotation_euler = rot
    scene.collection.objects.link(o)

def in_salon(x, z):
    return sal['x0'] < x < sal['x1'] and sal['z0'] < z < sal['z1']

def spot(x, z, power, temp, angle, blend=0.6):
    d = bpy.data.lights.new('spot', 'SPOT')
    d.energy = power
    d.spot_size = math.radians(angle)
    d.spot_blend = blend
    d.shadow_soft_size = 0.05
    d.color = kelvin(temp)
    o = bpy.data.objects.new('spot', d)
    o.location = B(x, (sal['trayY'] if in_salon(x, z) else H) - 0.02, z)
    scene.collection.objects.link(o)

for dl in F['downlights']:
    if dl['kind'] == 'display':
        spot(dl['x'], dl['z'], 150, 2900, 22, blend=0.35)
    elif in_salon(dl['x'], dl['z']):
        spot(dl['x'], dl['z'], 95, 2700, 55)
    else:
        spot(dl['x'], dl['z'], 140, 3000, 70)
area(0, sal['trayY'] - 0.03, sal['z1'] - 0.06, sal['x1'] - sal['x0'] - 0.1, 0.03, 40, 2700)
for x in (sal['x0'] + 0.06, sal['x1'] - 0.06):
    area(x, sal['trayY'] - 0.03, (sal['z0'] + sal['z1']) / 2, 0.03, sal['z1'] - sal['z0'] - 0.1, 50, 2700)
ch = F['chandelier']
lamp = bpy.data.lights.new('chandelier', 'POINT')
lamp.energy = 70
lamp.shadow_soft_size = 0.35
lamp.color = kelvin(2600)
lo = bpy.data.objects.new('chandelier', lamp)
lo.location = B(ch['x'], ch['bottom'] + 0.3, ch['z'])
scene.collection.objects.link(lo)
hw = L['HALF_W']
for s in (-1, 1):
    area(s * (hw - 0.2), H - 0.12, -7, 0.08, 13.6, 180, 2900)
area(0, H - 0.12, -13.7, 14.6, 0.08, 160, 2900)
# Dusk through the glass: a faint blue, not daylight.
for x in (-4.35, 4.35):
    area(x, 1.675, 0.4, 4.3, 2.75, 30, 9000, rot=(math.radians(90), 0, 0))
area(0, 1.525, 0.4, 2.2, 3.05, 18, 9000, rot=(math.radians(90), 0, 0))
area(k['x'], 0.9, k['z'] + k['d'] / 2 + 0.05, k['w'] - 0.1, 0.05, 25, 3000, rot=(math.radians(90), 0, 0))

# --- cameras and render -------------------------------------------------------------------------
cam_data = bpy.data.cameras.new('stop')
cam_data.sensor_fit = 'VERTICAL'
cam_data.clip_start = 0.03
cam_data.clip_end = 200
cam = bpy.data.objects.new('stop', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

jobs = [(s, v) for s in sorted(STOPS['stops'], key=lambda s: s['key']) for v in VARIANTS]
for i, (s, v) in enumerate(jobs):
    if i % OF != SHARD:
        continue
    w, h, fov = VARIANTS[v]
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    cam_data.angle = math.radians(fov)
    loc = Vector(B(s['x'], s['y'], s['z']))
    tgt = Vector(B(s['tx'], s['ty'], s['tz']))
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT, f"{s['key']}.{v}.png")
    print('rendering', s['key'], v, flush=True)
    bpy.ops.render.render(write_still=True)
print('done', flush=True)
# bpy can crash while tearing down the interpreter (after every still is saved); skip teardown.
os._exit(0)
