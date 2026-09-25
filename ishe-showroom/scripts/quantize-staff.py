"""Quantizes NORMAL (int8), TEXCOORD_0 (uint16) and WEIGHTS_0 (uint8) of a GLB with
KHR_mesh_quantization. Positions, joints, skin and animation are untouched.
  python3 scripts/quantize-staff.py in.glb out.glb"""
import json, struct, sys, array

src, out = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
binb = b[20 + jl + 8:]
N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read(acc):
    a = j['accessors'][acc]; v = j['bufferViews'][a['bufferView']]
    n = N[a['type']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    assert a['componentType'] == 5126 and 'byteStride' not in v or v.get('byteStride') == 4 * n
    return array.array('f', binb[off:off + a['count'] * n * 4]), a['count'], n

new_views = []  # (bytes, stride)
def add_view(data, stride):
    new_views.append((data, stride)); return len(j['bufferViews']) + len(new_views) - 1

for mesh in j['meshes']:
    for p in mesh['primitives']:
        at = p['attributes']
        if 'NORMAL' in at:
            f, c, _ = read(at['NORMAL']); q = bytearray(c * 4)
            for i in range(c):
                for k in range(3): q[i * 4 + k] = max(-127, min(127, round(f[i * 3 + k] * 127))) & 0xff
            at['NORMAL'] = len(j['accessors']); j['accessors'].append({'bufferView': add_view(bytes(q), 4), 'componentType': 5120, 'normalized': True, 'count': c, 'type': 'VEC3'})
        if 'TEXCOORD_0' in at:
            f, c, _ = read(at['TEXCOORD_0'])
            if min(f) >= -1e-4 and max(f) <= 1 + 1e-4:
                q = array.array('H', [max(0, min(65535, round(v * 65535))) for v in f])
                at['TEXCOORD_0'] = len(j['accessors']); j['accessors'].append({'bufferView': add_view(q.tobytes(), 4), 'componentType': 5123, 'normalized': True, 'count': c, 'type': 'VEC2'})
        if 'WEIGHTS_0' in at:
            f, c, _ = read(at['WEIGHTS_0']); q = bytearray(c * 4)
            for i in range(c):
                w = [max(0, f[i * 4 + k]) for k in range(4)]; s = sum(w) or 1
                ints = [round(x / s * 255) for x in w]
                ints[ints.index(max(ints))] += 255 - sum(ints)  # keep the sum exactly 255
                q[i * 4:i * 4 + 4] = bytes(ints)
            at['WEIGHTS_0'] = len(j['accessors']); j['accessors'].append({'bufferView': add_view(bytes(q), 4), 'componentType': 5121, 'normalized': True, 'count': c, 'type': 'VEC4'})

# Drop accessors nothing references any more (the float originals), then remap indices.
refs = set()
for mesh in j['meshes']:
    for p in mesh['primitives']:
        refs |= set(p['attributes'].values())
        if 'indices' in p: refs.add(p['indices'])
for sk in j.get('skins', []):
    if 'inverseBindMatrices' in sk: refs.add(sk['inverseBindMatrices'])
for an in j.get('animations', []):
    for sm in an['samplers']: refs |= {sm['input'], sm['output']}
amap = {old: new for new, old in enumerate(sorted(refs))}
j['accessors'] = [j['accessors'][old] for old in sorted(refs)]
for mesh in j['meshes']:
    for p in mesh['primitives']:
        p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = amap[p['indices']]
for sk in j.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = amap[sk['inverseBindMatrices']]
for an in j.get('animations', []):
    for sm in an['samplers']: sm['input'], sm['output'] = amap[sm['input']], amap[sm['output']]

# Rebuild the buffer, dropping views no accessor/image references any more.
used = {a['bufferView'] for a in j['accessors'] if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', [])}
views = [(binb[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']], v) for v in j['bufferViews']] + [(d, {'buffer': 0, 'byteLength': len(d), 'byteStride': s, 'target': 34962}) for d, s in new_views]
remap, body, nv = {}, bytearray(), []
for i, (data, v) in enumerate(views):
    if i not in used: continue
    while len(body) % 4: body.append(0)
    v = dict(v); v['byteOffset'] = len(body); v['byteLength'] = len(data); body += data
    remap[i] = len(nv); nv.append(v)
while len(body) % 4: body.append(0)
for a in j['accessors']:
    if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
for im in j.get('images', []): im['bufferView'] = remap[im['bufferView']]
j['bufferViews'] = nv; j['buffers'] = [{'byteLength': len(body)}]
j['extensionsUsed'] = sorted(set(j.get('extensionsUsed', []) + ['KHR_mesh_quantization']))
j['extensionsRequired'] = sorted(set(j.get('extensionsRequired', []) + ['KHR_mesh_quantization']))
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(body)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(body), 0x004E4942) + bytes(body)
open(out, 'wb').write(glb)
print(out, round(len(glb) / 1e6, 2), 'MB')
