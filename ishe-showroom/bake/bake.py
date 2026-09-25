"""
Bakes lighting for the ISHÉ showroom with Blender Cycles (bpy).

  python3 bake/bake.py [--samples 256] [--only floor]

Reads bake/layout.json (exported from the TypeScript floor plan), rebuilds the room with its
occluders and light sources, bakes diffuse lighting (direct + indirect, no albedo) onto every
surface in `surfaces`, and writes public/bake/<name>.npy (bake/to-png.mjs converts them). The scene
applies these as light maps.

Occluders carry their real (linear) albedo, so walnut panelling and the travertine floor tint the
bounce light, while the lightmaps themselves hold lighting only (no albedo).

Coordinates: three.js (x, y-up, z toward street) -> Blender (x, -z, y).
"""
import json, math, os, sys
import bpy
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, 'bake', 'layout.json')))
OUT = os.path.join(ROOT, 'public', 'bake')
os.makedirs(OUT, exist_ok=True)
args = sys.argv[1:]
SAMPLES = int(args[args.index('--samples') + 1]) if '--samples' in args else 256
ONLY = args[args.index('--only') + 1].split(',') if '--only' in args else None

def B(x, y, z):  # three -> blender
    return (x, -z, y)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.022, 0.026, 1)

def material(name, albedo, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*albedo, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m

# Linear albedo of the scene's finishes.
WHITE = material('white', (0.86, 0.84, 0.8))          # warm white limewash
FLOOR = material('terrazzo', (0.74, 0.71, 0.66))     # polished white terrazzo
BLACK = material('black', (0.04, 0.04, 0.04))         # black lacquer
WALNUT = material('walnut', (0.13, 0.07, 0.035))
BRONZE = material('bronze', (0.22, 0.15, 0.09))
TAUPE = material('champagne', (0.38, 0.29, 0.18))    # champagne suede decks
BOUCLE = material('boucle', (0.7, 0.65, 0.57))

def box(x0, y0, z0, x1, y1, z1, mat):
    """Axis-aligned box in three.js coordinates."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.scale = (abs(x1 - x0), abs(z1 - z0), abs(y1 - y0))
    o.location = B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o.data.materials.append(mat)
    return o

def cylinder(x, z, r, y0, y1, mat):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=y1 - y0, vertices=32)
    o = bpy.context.active_object
    o.location = B(x, (y0 + y1) / 2, z)
    o.data.materials.append(mat)
    return o

# --- bake surfaces (also the room's visible faces) ----------------------------------------
def surface_object(s):
    verts, faces, uvs = [], [], []
    a0, a1, b0, b1 = s['uv']
    for r in s['rects']:
        ra0, ra1, rb0, rb1 = r
        base = len(verts)
        # Sit 1 cm proud of the wall blocks so bake rays do not start inside them.
        c = s['c'] + (s['normal'] * 0.01 if s['plane'] != 'y' else 0)
        for (a, b) in [(ra0, rb0), (ra1, rb0), (ra1, rb1), (ra0, rb1)]:
            if s['plane'] == 'y':
                p = (a, c, b)
            elif s['plane'] == 'x':
                p = (c, b, a)
            else:
                p = (a, b, c)
            verts.append(B(*p))
            uvs.append(((a - a0) / (a1 - a0), (b - b0) / (b1 - b0)))
        faces.append((base, base + 1, base + 2, base + 3))
    mesh = bpy.data.meshes.new(s['name'])
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    # Orient faces toward the lit side.
    want = {'x': (s['normal'], 0, 0), 'y': (0, 0, s['normal']), 'z': (0, -s['normal'], 0)}[s['plane']]
    for poly in mesh.polygons:
        if sum(n * w for n, w in zip(poly.normal, want)) < 0:
            poly.flip()
    mesh.update()
    uvl = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[mesh.loops[li].vertex_index]
    o = bpy.data.objects.new(s['name'], mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(FLOOR if s['name'] == 'floor' else WHITE)
    return o

surf_objs = [(s, surface_object(s)) for s in L['surfaces']]

# --- occluders ----------------------------------------------------------------------------
H = L['CEILING']
# Wall thickness behind the faces, so light cannot leak between rooms.
for w in L['walls'][1:]:  # walls[0] is the facade collider (door closed); rebuilt with openings below
    box(w['x0'], 0, w['z0'], w['x1'], H, w['z1'], WHITE)
sd = L['SIDE_DOOR']
for s in (-1, 1):
    box(s * 2.5 - 0.1, sd['lintel'], sd['z0'], s * 2.5 + 0.1, H, sd['z1'], WHITE)
    cylinder(s * 2.5, -8, 0.16, 0, H, BLACK)
# Facade with the door and window openings.
for x0, x1, y0, y1 in [(-7.6, -6.5, 0, H), (-6.5, -2.2, 0, 0.45), (-6.5, -2.2, 3.1, H), (-2.2, -1.1, 0, H), (-1.1, 1.1, 2.75, H),
                       (1.1, 2.2, 0, H), (2.2, 6.5, 0, 0.45), (2.2, 6.5, 3.1, H), (6.5, 7.6, 0, H)]:
    box(x0, y0, -0.1, x1, y1, 0.1, WHITE)

F = L['features']
# White pilasters between the arm vitrines.
for s in (-1, 1):
    for z in F['pilasterZ']:
        x_in = s * (L['HALF_W'] - 0.1 - F['pilaster']['d'])
        box(min(s * 7.4, x_in), 0.0, z - F['pilaster']['w'] / 2, max(s * 7.4, x_in), H, z + F['pilaster']['w'] / 2, WHITE)
# Salon: black lacquered feature wall, lowered white tray.
sal = F['salon']
box(-2.6, 0.1, -13.9, 2.6, sal['trayY'], -13.87, BLACK)
tray = box(sal['x0'], sal['trayY'], sal['z0'], sal['x1'], H, sal['z1'], WHITE)
# Lounge and try-on mirrors.
for a in F['armchairs']:
    box(a['x'] - a['w'] / 2, 0, a['z'] - a['d'] / 2, a['x'] + a['w'] / 2, 0.6, a['z'] + a['d'] / 2, BOUCLE)
st = F['sideTable']
cylinder(st['x'], st['z'], st['r'], st['h'] - 0.03, st['h'], WALNUT)
cylinder(st['x'], st['z'], 0.03, 0, st['h'], BRONZE)
ms = F['floorMirrorSize']
for m in F['floorMirrors']:
    box(m['x'] - 0.03, 0, m['z'] - ms['w'] / 2, m['x'] + 0.03, ms['h'], m['z'] + ms['w'] / 2, WALNUT)

for d in L['displays']:
    b = d['box']
    top = 0.9 if d['style'] == 'tall' else 0.85
    box(b['x0'], 0.0, b['z0'], b['x1'], top, b['z1'], BLACK)
    box(b['x0'] + 0.01, top, b['z0'] + 0.01, b['x1'] - 0.01, top + 0.012, b['z1'] - 0.01, TAUPE)
    if d['style'] == 'tall':
        box(b['x0'], d['h'] - 0.08, b['z0'], b['x1'], d['h'], b['z1'], BLACK)
for b in L['benches']:
    box(b['x0'], 0, b['z0'], b['x1'], 0.42, b['z1'], BLACK)
c = L['features']['console']
box(c['x0'], 0, c['z0'], c['x1'], c['h'], c['z1'], BLACK)
k = L['cashier']
box(k['x'] - k['w'] / 2, 0, k['z'] - k['d'] / 2, k['x'] + k['w'] / 2, k['h'], k['z'] + k['d'] / 2, BLACK)
box(k['x'] - k['w'] / 2 - 0.4, 0, k['z'] - 0.92 - 0.13, k['x'] + k['w'] / 2 + 0.4, 0.9, k['z'] - 0.92 + 0.13, BLACK)
t = L['comboTable']
cylinder(t['x'], t['z'], t['r'], t['h'] - 0.04, t['h'], BLACK)
cylinder(t['x'], t['z'], 0.07, 0, t['h'], BLACK)
cylinder(t['x'], t['z'], 0.32, 0, 0.06, BLACK)

# --- lights -------------------------------------------------------------------------------
def kelvin(k):
    # Approximate blackbody colour (Tanner Helland), normalised.
    t = k / 100
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
    bpy.context.collection.objects.link(o)
    return o

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
    o.location = B(x, (sal['trayY'] if in_salon(x, z) else H) - 0.02, z)  # default spot points down -Z in Blender = down
    bpy.context.collection.objects.link(o)

for dl in L['features']['downlights']:
    if dl['kind'] == 'display':
        # Tight, bright accent on each piece.
        spot(dl['x'], dl['z'], 150, 3000, 22, blend=0.35)
    elif in_salon(dl['x'], dl['z']):
        spot(dl['x'], dl['z'], 95, 2800, 55)
    else:
        spot(dl['x'], dl['z'], 140, 3200, 70)

# Salon: warm cove along the tray edge and the chandelier's glow (intimate, 2700 K).
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
bpy.context.collection.objects.link(lo)

# Perimeter cove: long thin area lights just below the ceiling along the outer walls.
hw = L['HALF_W']
for s in (-1, 1):
    area(s * (hw - 0.2), H - 0.12, -7, 0.08, 13.6, 180, 3000)
area(0, H - 0.12, -13.7, 14.6, 0.08, 160, 3000)
# Daylight through the shop windows and glass door (cool, soft).
for x in (-4.35, 4.35):
    area(x, 1.8, 0.4, 4.3, 2.6, 260, 6500, rot=(math.radians(90), 0, 0))
area(0, 1.4, 0.4, 2.2, 2.7, 140, 6500, rot=(math.radians(90), 0, 0))
# Lit kick strip on the cashier counter and the brand-wall wash.
area(k['x'], 0.9, k['z'] + k['d'] / 2 + 0.05, k['w'] - 0.1, 0.05, 25, 3000, rot=(math.radians(90), 0, 0))

# --- bake ---------------------------------------------------------------------------------
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
scene.render.bake.margin = 8

results = {}
for s, o in surf_objs:
    if ONLY and s['name'] not in ONLY:
        continue
    w, h = s['res']
    img = bpy.data.images.new(s['name'], w, h, float_buffer=True)
    mat = o.data.materials[0].copy()
    o.data.materials[0] = mat
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    print('baking', s['name'], w, h, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[:, :, :3]
    results[s['name']] = px

# One shared exposure so surfaces stay consistent with each other.
if results:
    ref = np.percentile(results.get('floor', next(iter(results.values()))), 97)
    scale = 0.85 / max(ref, 1e-6)
    if 'floor' in results:
        np.save(os.path.join(OUT, 'exposure.npy'), np.array([scale]))
for name, px in results.items():
    exposure_file = os.path.join(OUT, 'exposure.npy')
    scale = float(np.load(exposure_file)[0]) if os.path.exists(exposure_file) else 1.0
    lin = np.clip(px * scale, 0, 1)
    # Denoise: separable 7-tap Gaussian in linear space (baked lighting is low-frequency).
    k = np.array([0.03, 0.105, 0.22, 0.29, 0.22, 0.105, 0.03], dtype=np.float32)
    for axis in (0, 1):
        pad = np.pad(lin, [(3, 3) if a == axis else (0, 0) for a in range(3)], mode='edge')
        lin = sum(k[i] * np.take(pad, range(i, i + lin.shape[axis]), axis=axis) for i in range(7))
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    out = (np.clip(srgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    np.save(os.path.join(OUT, f'{name}.npy'), out[::-1])  # flip rows: Blender images are bottom-up
    print('saved', name, out.shape, 'mean', float(lin.mean()), flush=True)
