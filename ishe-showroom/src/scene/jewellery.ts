/**
 * Procedural, stylised 3D jewellery and display props (busts, bolsters, stands, cushions).
 * These are illustrative models built for the demo, not scans of the real ISHÉ pieces.
 *
 * Each piece is assembled from primitives, then merged into one mesh per material to keep draw
 * calls low (roughly 3 to 6 per display).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Product, Tone } from '@/data/catalogue';
import { mats, toneMat, type MatKey } from './materials';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

class Parts {
  private items: { g: THREE.BufferGeometry; k: MatKey }[] = [];
  add(g: THREE.BufferGeometry, k: MatKey, pos = V(), rot = new THREE.Euler(), scale = V(1, 1, 1)) {
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), scale);
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    geo.deleteAttribute('uv');
    if (geo.getAttribute('uv1')) geo.deleteAttribute('uv1');
    this.items.push({ g: geo, k });
    return this;
  }
  build(): THREE.Group {
    const group = new THREE.Group();
    const byMat = new Map<MatKey, THREE.BufferGeometry[]>();
    for (const it of this.items) byMat.set(it.k, [...(byMat.get(it.k) ?? []), it.g]);
    const M = mats();
    for (const [k, list] of byMat) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, M[k] as THREE.Material);
      mesh.name = k;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    return group;
  }
}

// --- shared primitive geometries -------------------------------------------------------------
const sphere = (r: number, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7)));
const torus = (R: number, r: number, arc = TAU, radial = 10, tubular = 48) => new THREE.TorusGeometry(R, r, radial, tubular, arc);

/** Torus with a hand-hammered surface: vertices nudged along their normals. */
function hammeredTorus(R: number, r: number, seed: number) {
  const g = new THREE.TorusGeometry(R, r, 12, 96);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const d = (n - Math.floor(n) - 0.5) * r * 0.28;
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * d, pos.getY(i) + nrm.getY(i) * d, pos.getZ(i) + nrm.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

function flower(p: Parts, center: THREE.Vector3, size: number, petal: MatKey, heart: MatKey, facing = new THREE.Euler()) {
  const q = new THREE.Quaternion().setFromEuler(facing);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const off = V(Math.cos(a) * size, Math.sin(a) * size, 0).applyQuaternion(q);
    p.add(sphere(size * 0.75, 10), petal, center.clone().add(off), facing, V(1, 1, 0.45));
  }
  p.add(sphere(size * 0.55, 10), heart, center.clone().add(V(0, 0, size * 0.25).applyQuaternion(q)));
}

// --- props -----------------------------------------------------------------------------------

/** Velvet necklace bust: lathe profile flattened front-to-back. Returns a surface sampler. */
// Chest tapering in toward the base, widest across the shoulders, then a smooth slope into a tall
// neck: the shape of a boutique display bust, not a bottle (the neck and chain zone keep their radii).
const BUST_PROFILE: [number, number][] = [
  [0.0, 0.0], [0.15, 0.0], [0.163, 0.06], [0.186, 0.14], [0.2, 0.2], [0.188, 0.232], [0.145, 0.258],
  [0.098, 0.278], [0.07, 0.3], [0.058, 0.33], [0.056, 0.39], [0.055, 0.47], [0.052, 0.5], [0.0, 0.505],
];
const BUST_SX = 1.35, BUST_SZ = 0.5;
/** Smooth the profile with a spline so the lathe reads as a soft velvet form, not facets. */
function smoothProfile(scale: number) {
  const pts = BUST_PROFILE.slice(1, -1).map(([r, y]) => new THREE.Vector3(r, y, 0));
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const out = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 48; i++) { const p = c.getPoint(i / 48); out.push(new THREE.Vector2(p.x * scale, p.y * scale)); }
  out.push(new THREE.Vector2(0, BUST_PROFILE[BUST_PROFILE.length - 1][1] * scale));
  return out;
}
function bustRadiusAt(y: number) {
  for (let i = 1; i < BUST_PROFILE.length; i++) {
    const [r0, y0] = BUST_PROFILE[i - 1], [r1, y1] = BUST_PROFILE[i];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / Math.max(1e-6, y1 - y0)) * (r1 - r0);
  }
  return 0.05;
}
/** Chest half-depth: below the neck the form is flat front and back, like a real display neck form. */
const BUST_CHEST_Z = 0.078;
function addBust(p: Parts, scale = 1) {
  const geo = new THREE.LatheGeometry(smoothProfile(scale), 64);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) * BUST_SZ;
    pos.setXYZ(i, pos.getX(i) * BUST_SX, pos.getY(i), Math.sign(z) * Math.min(Math.abs(z), BUST_CHEST_Z * scale));
  }
  geo.computeVertexNormals();
  p.add(geo, 'velvet');
  // Lacquered cap on the neck, as on real display busts.
  p.add(new THREE.CylinderGeometry(0.056 * scale, 0.056 * scale, 0.012 * scale, 32), 'blackSatin', V(0, 0.506 * scale, 0), new THREE.Euler(), V(BUST_SX, 1, BUST_SZ));
}
/** Curve lying on the bust surface, from one side of the neck, dropping `drop` at the front. */
function bustCurve(yTop: number, drop: number, spread = 1.35, lift = 0.006, scale = 1) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 2 - 1;
    const a = t * spread;
    const y = yTop - drop * (1 - t * t);
    const r = bustRadiusAt(y / scale) * scale + lift;
    pts.push(V(Math.sin(a) * r * BUST_SX, y, Math.min(Math.cos(a) * r * BUST_SZ, BUST_CHEST_Z * scale) + lift));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function addBolster(p: Parts) {
  p.add(new RoundedBoxGeometry(0.24, 0.02, 0.12, 2, 0.006), 'blackSatin', V(0, 0.01, 0));
  p.add(new THREE.BoxGeometry(0.012, 0.05, 0.03), 'blackSatin', V(-0.105, 0.045, 0));
  p.add(new THREE.BoxGeometry(0.012, 0.05, 0.03), 'blackSatin', V(0.105, 0.045, 0));
  p.add(new THREE.CylinderGeometry(0.033, 0.033, 0.2, 32), 'velvet', V(0, 0.075, 0), new THREE.Euler(0, 0, Math.PI / 2));
}
const BOLSTER_Y = 0.075;

function addEarringStand(p: Parts, riser: number) {
  if (riser > 0) p.add(new RoundedBoxGeometry(0.26, riser, 0.2, 2, 0.01), 'blackSatin', V(0, riser / 2, 0));
  const b = riser;
  p.add(new THREE.CylinderGeometry(0.05, 0.055, 0.012, 32), 'blackMetal', V(0, b + 0.006, 0));
  p.add(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 12), 'blackMetal', V(0, b + 0.07, 0));
  p.add(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 12), 'blackMetal', V(0, b + 0.14, 0), new THREE.Euler(0, 0, Math.PI / 2));
}
const STAND_BAR = 0.14;

function addRingCushion(p: Parts) {
  p.add(new RoundedBoxGeometry(0.12, 0.018, 0.1, 2, 0.006), 'blackSatin', V(0, 0.009, 0));
  p.add(new RoundedBoxGeometry(0.075, 0.035, 0.06, 3, 0.014), 'velvet', V(0, 0.034, 0));
}
const RING_SEAT = 0.05;

// --- jewellery -------------------------------------------------------------------------------

type Builder = (p: Parts, metal: MatKey) => void;

const PENDANT_SCALE = 0.72;

const necklaces: Record<string, Builder> = {
  'ISH-N01': (p, metal) => {
    // Kundan-style choker: close band of set stones with small pearl drops.
    const c = bustCurve(0.335, 0.035, 1.25, 0.008);
    p.add(new THREE.TubeGeometry(c, 96, 0.0035, 8), metal);
    const colours: MatKey[] = ['polki', 'emerald', 'polki', 'ruby'];
    for (let i = 1; i < 22; i++) {
      const t = i / 22;
      const pt = c.getPointAt(t), tan = c.getTangentAt(t);
      const rot = new THREE.Euler(0, Math.atan2(tan.x, tan.z) + Math.PI / 2, 0);
      p.add(new THREE.BoxGeometry(0.013, 0.016, 0.004), metal, pt, rot);
      p.add(sphere(0.0048, 10), colours[i % 4], pt.clone().add(V(0, 0, 0.002)), rot, V(1, 1, 0.5));
      p.add(sphere(0.0032, 10), 'pearl', pt.clone().add(V(0, -0.016, 0.002)));
    }
  },
  'ISH-N02': (p, metal) => {
    // Three graduated strands.
    [[0.335, 0.055], [0.335, 0.095], [0.335, 0.14]].forEach(([y, d], i) => {
      p.add(new THREE.TubeGeometry(bustCurve(y, d, 1.3, 0.006 + i * 0.002), 96, 0.0016, 6), metal);
    });
    const mid = bustCurve(0.335, 0.095, 1.3, 0.01).getPointAt(0.5);
    p.add(sphere(0.0055, 14), metal, mid);
  },
  'ISH-N03': (p, metal) => {
    const c = bustCurve(0.335, 0.08, 1.25, 0.008);
    p.add(new THREE.TubeGeometry(c, 96, 0.0018, 6), metal);
    for (let i = 0; i < 9; i++) {
      const t = 0.1 + (i / 8) * 0.8;
      const pt = c.getPointAt(t), tan = c.getTangentAt(t);
      const s = 0.0075 + (1 - Math.abs(t - 0.5) * 2) * 0.004;
      flower(p, pt, s, metal, i % 2 ? 'ruby' : 'pearl', new THREE.Euler(-0.3, Math.atan2(tan.x, tan.z) + Math.PI / 2, 0));
    }
  },
  'ISH-N04': (p) => {
    const c = bustCurve(0.335, 0.125, 1.3, 0.006);
    p.add(new THREE.TubeGeometry(c, 96, 0.0011, 6), 'silver');
    const b = c.getPointAt(0.5);
    p.add(sphere(0.003, 10), 'silver', b.clone().add(V(0, -0.002, 0.002)));
    p.add(new THREE.OctahedronGeometry(0.008, 1), 'crystal', b.clone().add(V(0, -0.014, 0.004)), new THREE.Euler(), V(0.85, 1.35, 0.6));
  },
};

function braceletAt(y: number) { return (g: THREE.BufferGeometry, x = 0) => ({ g, pos: V(x, y, 0), rot: new THREE.Euler(0, Math.PI / 2, 0) }); }

const bracelets: Record<string, Builder> = {
  'ISH-B01': (p, metal) => {
    // Open cuff, gap at the bottom.
    const g = torus(0.037, 0.0045, TAU * 0.82, 10, 64);
    p.add(g, metal, V(0, BOLSTER_Y, 0), new THREE.Euler(0, Math.PI / 2, -Math.PI / 2 + TAU * 0.09 - Math.PI), V(1, 1, 1.8));
    const R = 0.037;
    for (const a of [-Math.PI / 2 - TAU * 0.09, -Math.PI / 2 + TAU * 0.09]) {
      p.add(sphere(0.0062, 14), metal, V(0, BOLSTER_Y + Math.sin(a) * R, Math.cos(a) * R));
    }
  },
  'ISH-B02': (p) => {
    const n = 30, R = 0.0385;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      p.add(sphere(0.0043, 14), 'pearl', V(0, BOLSTER_Y + Math.sin(a) * R, Math.cos(a) * R));
    }
    p.add(new THREE.BoxGeometry(0.006, 0.008, 0.012), 'silver', V(0, BOLSTER_Y - R, 0));
  },
  'ISH-B03': (p, metal) => {
    const at = braceletAt(BOLSTER_Y);
    for (const [x, seed] of [[-0.03, 1], [0.03, 5]]) {
      const b = at(hammeredTorus(0.038, 0.0038, seed), x);
      p.add(b.g, metal, b.pos, b.rot);
    }
  },
  'ISH-B04': (p) => {
    const R = 0.0375, n = 36;
    p.add(torus(R, 0.0012, TAU, 6, 96), 'silver', V(0, BOLSTER_Y, 0), new THREE.Euler(0, Math.PI / 2, 0));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const pos = V(0, BOLSTER_Y + Math.sin(a) * (R + 0.0022), Math.cos(a) * (R + 0.0022));
      p.add(new THREE.OctahedronGeometry(0.0034, 0), 'crystal', pos, new THREE.Euler(a, 0, 0));
      p.add(new THREE.BoxGeometry(0.0052, 0.0052, 0.0052), 'silver', pos.clone().multiplyScalar(1), new THREE.Euler(a, 0, 0), V(1, 0.5, 0.5));
    }
  },
  'ISH-B05': (p, metal) => {
    const R = 0.0375, n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      p.add(torus(0.0048, 0.0013, TAU, 8, 20), metal, V(0, BOLSTER_Y + Math.sin(a) * R, Math.cos(a) * R),
        new THREE.Euler(a + Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0), V(1.35, 1, 1));
    }
  },
  'ISH-B06': (p, metal) => {
    for (const [x, enamel] of [[-0.032, 'enamelRed'], [0.032, 'enamelGreen']] as [number, MatKey][]) {
      const rot = new THREE.Euler(0, Math.PI / 2, 0);
      p.add(torus(0.038, 0.0055, TAU, 12, 96), enamel, V(x, BOLSTER_Y, 0), rot);
      p.add(torus(0.038, 0.0018, TAU, 8, 96), metal, V(x - 0.0065, BOLSTER_Y, 0), rot);
      p.add(torus(0.038, 0.0018, TAU, 8, 96), metal, V(x + 0.0065, BOLSTER_Y, 0), rot);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU, R = 0.038 + 0.0052;
        p.add(sphere(0.0022, 8), metal, V(x, BOLSTER_Y + Math.sin(a) * R, Math.cos(a) * R));
      }
    }
  },
};

/** Builds one earring hanging from (0,0,0) downward; mirrored for the pair by the caller. */
const earringOne: Record<string, Builder> = {
  'ISH-E01': (p, metal) => {
    p.add(torus(0.006, 0.0008, Math.PI * 1.3, 6, 24), metal, V(0, -0.004, 0), new THREE.Euler(0, Math.PI / 2, Math.PI * 0.35));
    p.add(sphere(0.003, 10), metal, V(0, -0.012, 0));
    p.add(sphere(0.0075, 16), 'pearl', V(0, -0.022, 0), new THREE.Euler(), V(1, 1.15, 1));
  },
  'ISH-E02': (p, metal) => {
    p.add(sphere(0.004, 10), 'polki', V(0, -0.004, 0));
    // Crescent (opening upward) with set stones and a beaded fringe.
    p.add(torus(0.017, 0.0032, Math.PI, 10, 40), metal, V(0, -0.024, 0), new THREE.Euler(0, 0, Math.PI));
    // Fine bar across the crescent tips, linked up to the stud.
    p.add(new THREE.CylinderGeometry(0.0009, 0.0009, 0.034, 6), metal, V(0, -0.024, 0), new THREE.Euler(0, 0, Math.PI / 2));
    p.add(new THREE.CylinderGeometry(0.0009, 0.0009, 0.018, 6), metal, V(0, -0.015, 0));
    for (let i = 1; i < 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      p.add(sphere(0.0026, 8), i % 2 ? 'emerald' : 'polki', V(Math.cos(a) * 0.017, -0.024 + Math.sin(a) * 0.017, 0.003));
    }
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + ((i + 0.5) / 9) * Math.PI;
      p.add(sphere(0.0022, 8), 'pearl', V(Math.cos(a) * 0.0225, -0.024 + Math.sin(a) * 0.0225, 0));
    }
  },
  'ISH-E03': (p, metal) => {
    flower(p, V(0, -0.008, 0.002), 0.0055, metal, 'pearl');
  },
  'ISH-E04': (p, metal) => {
    p.add(hammeredTorus(0.018, 0.0024, 9), metal, V(0, -0.02, 0), new THREE.Euler(0, 0.35, 0));
  },
  'ISH-E05': (p, metal) => {
    p.add(sphere(0.0055, 14), metal, V(0, -0.006, 0), new THREE.Euler(), V(1, 0.8, 0.6));
    p.add(sphere(0.0026, 8), 'ruby', V(0, -0.006, 0.003));
    const bell = [V(0.0, 0), V(0.004, 0), V(0.009, -0.006), V(0.0125, -0.016), V(0.014, -0.022), V(0.0, -0.022)].map((v) => new THREE.Vector2(v.x, v.y));
    p.add(new THREE.LatheGeometry(bell, 32), metal, V(0, -0.012, 0));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      p.add(sphere(0.0019, 8), 'pearl', V(Math.cos(a) * 0.0135, -0.0375, Math.sin(a) * 0.0135));
    }
  },
  'ISH-E06': (p) => {
    p.add(torus(0.006, 0.0008, Math.PI * 1.3, 6, 24), 'silver', V(0, -0.004, 0), new THREE.Euler(0, Math.PI / 2, Math.PI * 0.35));
    p.add(sphere(0.0025, 10), 'silver', V(0, -0.011, 0));
    p.add(new THREE.OctahedronGeometry(0.0065, 1), 'crystal', V(0, -0.026, 0), new THREE.Euler(0, 0.4, 0), V(0.8, 2.1, 0.8));
  },
};

const pendants: Record<string, Builder> = {
  'ISH-P01': (p, metal) => {
    const s = PENDANT_SCALE;
    const c = bustCurve(0.335 * s, 0.1, 1.3, 0.004, s);
    p.add(new THREE.TubeGeometry(c, 96, 0.001, 6), metal);
    const b = c.getPointAt(0.5);
    p.add(torus(0.003, 0.0008, TAU, 6, 16), metal, b.clone().add(V(0, -0.003, 0.002)));
    p.add(sphere(0.0085, 18), 'pearl', b.clone().add(V(0, -0.014, 0.008)));
  },
  'ISH-P02': (p, metal) => {
    const s = PENDANT_SCALE;
    const c = bustCurve(0.335 * s, 0.09, 1.3, 0.004, s);
    p.add(new THREE.TubeGeometry(c, 96, 0.0012, 6), metal);
    const b = c.getPointAt(0.5).add(V(0, -0.026, 0.01));
    p.add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 40), metal, b, new THREE.Euler(Math.PI / 2 - 0.25, 0, 0));
    p.add(sphere(0.0075, 16), 'ruby', b.clone().add(V(0, 0.001, 0.003)), new THREE.Euler(-0.25, 0, 0), V(1, 1, 0.55));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      p.add(sphere(0.0022, 8), 'pearl', b.clone().add(V(Math.cos(a) * 0.0145, Math.sin(a) * 0.0145, 0.004)));
    }
    p.add(sphere(0.003, 10), 'pearl', b.clone().add(V(0, -0.023, 0.001)));
    // Matching studs laid on the stand base (part of the set, not separate products).
    for (const x of [-0.05, 0.05]) {
      p.add(new THREE.CylinderGeometry(0.008, 0.008, 0.002, 24), metal, V(x, 0.02, 0.07));
      p.add(sphere(0.004, 12), 'ruby', V(x, 0.022, 0.07), new THREE.Euler(), V(1, 0.5, 1));
    }
  },
};

const rings: Record<string, Builder> = {
  'ISH-R01': (p, metal) => {
    p.add(torus(0.009, 0.0015, TAU, 8, 48), metal, V(0, RING_SEAT, 0));
    flower(p, V(0, RING_SEAT + 0.0105, 0.001), 0.004, metal, 'pearl', new THREE.Euler(-Math.PI / 2 + 0.6, 0, 0));
  },
  'ISH-R02': (p, metal) => {
    p.add(torus(0.009, 0.0014, TAU * 0.86, 8, 48), metal, V(0, RING_SEAT, 0), new THREE.Euler(0, 0, Math.PI / 2 + TAU * 0.07));
    p.add(sphere(0.0055, 16), 'pearl', V(0, RING_SEAT + 0.0135, 0));
  },
  'ISH-R03': (p, metal) => {
    p.add(hammeredTorus(0.0095, 0.0022, 3), metal, V(0, RING_SEAT, 0), new THREE.Euler(), V(1, 1, 2.2));
  },
  'ISH-R04': (p) => {
    p.add(torus(0.009, 0.0015, TAU, 8, 48), 'silver', V(0, RING_SEAT, 0));
    p.add(new THREE.BoxGeometry(0.014, 0.004, 0.011), 'silver', V(0, RING_SEAT + 0.0105, 0));
    p.add(new THREE.BoxGeometry(0.012, 0.007, 0.009), 'emerald', V(0, RING_SEAT + 0.0145, 0));
    for (const [x, z] of [[-0.006, -0.0045], [0.006, -0.0045], [-0.006, 0.0045], [0.006, 0.0045]]) {
      p.add(new THREE.CylinderGeometry(0.0007, 0.0007, 0.008, 6), 'silver', V(x, RING_SEAT + 0.014, z));
    }
  },
  'ISH-R05': (p) => {
    const gap = 0.55;
    p.add(torus(0.009, 0.0012, TAU - gap, 8, 48), 'silver', V(0, RING_SEAT, 0), new THREE.Euler(0, 0, Math.PI / 2 + gap / 2));
    for (const a of [Math.PI / 2 - gap / 2, Math.PI / 2 + gap / 2]) {
      p.add(sphere(0.0022, 12), 'silver', V(Math.cos(a) * 0.009, RING_SEAT + Math.sin(a) * 0.009, 0));
    }
  },
  'ISH-R06': (p, metal) => {
    p.add(torus(0.009, 0.0015, TAU, 8, 48), metal, V(0, RING_SEAT, 0));
    const top = V(0, RING_SEAT + 0.011, 0.0);
    p.add(new THREE.CylinderGeometry(0.009, 0.0085, 0.003, 32), metal, top, new THREE.Euler(Math.PI / 2 - 0.5, 0, 0));
    p.add(sphere(0.0034, 12), 'polki', top.clone().add(V(0, 0.001, 0.0015)), new THREE.Euler(), V(1, 1, 0.6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      p.add(sphere(0.0021, 10), i % 2 ? 'emerald' : 'ruby', top.clone().add(V(Math.cos(a) * 0.0058, Math.sin(a) * 0.0058 * 0.88, 0.002 + Math.sin(a) * 0.0028)));
    }
  },
};

export const DISPLAY_SCALE = { ring: 1.5, earring: 1.6 };

/**
 * Builds the prop plus jewellery for a product. Origin = top surface of the display base.
 * `riser` lifts earring stands inside tall vitrines.
 */
export function buildPiece(product: Product, opts: { riser?: number } = {}): THREE.Group {
  const metal = toneMat(product.tone);
  const root = new THREE.Group();
  const props = new Parts();
  const jewel = new Parts();
  switch (product.category) {
    case 'necklace':
      addBust(props);
      necklaces[product.sku]?.(jewel, metal);
      break;
    case 'pendant':
      props.add(new RoundedBoxGeometry(0.2, 0.02, 0.17, 2, 0.006), 'blackSatin', V(0, 0.01, 0));
      addBust(props, PENDANT_SCALE);
      pendants[product.sku]?.(jewel, metal);
      break;
    case 'bracelet':
      addBolster(props);
      bracelets[product.sku]?.(jewel, metal);
      break;
    case 'ring': {
      addRingCushion(props);
      rings[product.sku]?.(jewel, metal);
      break;
    }
    case 'earring': {
      const riser = opts.riser ?? 0;
      addEarringStand(props, riser);
      const pair = new Parts();
      earringOne[product.sku]?.(pair, metal);
      const one = pair.build();
      const s = DISPLAY_SCALE.earring;
      for (const x of [-0.035, 0.035]) {
        const e = one.clone();
        e.position.set(x, riser + STAND_BAR - 0.003, 0);
        e.scale.setScalar(s);
        if (x > 0) e.scale.x *= -1;
        root.add(e);
      }
      break;
    }
  }
  root.add(props.build());
  const j = jewel.build();
  if (product.category === 'ring') {
    j.scale.setScalar(DISPLAY_SCALE.ring);
    j.position.y = -RING_SEAT * (DISPLAY_SCALE.ring - 1) + 0.004;
  }
  root.add(j);
  root.userData.sku = product.sku;
  return root;
}

/**
 * The piece alone (no bust, stand or cushion) for the camera try-on, in metres.
 * Earrings: one earring with the hook at the origin, hanging down -y.
 * Necklaces and pendants: centred on x/z, with the top of the chain at y = 0.
 * Rings and bracelets: centred on the origin, worn along +y.
 */
export type TryOnKind = 'earring' | 'necklace' | 'ring' | 'bracelet';

export function buildTryOnPiece(product: Product): { group: THREE.Group; kind: TryOnKind } | null {
  const metal = toneMat(product.tone);
  const p = new Parts();
  if (product.category === 'earring') {
    earringOne[product.sku]?.(p, metal);
    return { group: p.build(), kind: 'earring' };
  }
  if (product.category === 'ring' || product.category === 'bracelet') {
    // Ring: band centred on the origin, finger axis along +y, stone facing the camera (+z).
    // Bracelet: centred on the origin, wrist axis along +y.
    const ring = product.category === 'ring';
    (ring ? rings : bracelets)[product.sku]?.(p, metal);
    const inner = p.build();
    inner.position.y = -(ring ? RING_SEAT : BOLSTER_Y);
    const wrap = new THREE.Group();
    if (ring) wrap.rotation.x = Math.PI / 2;
    else wrap.rotation.z = Math.PI / 2;
    wrap.add(inner);
    const outer = new THREE.Group();
    outer.add(wrap);
    return { group: outer, kind: product.category };
  }
  if (product.category === 'necklace') necklaces[product.sku]?.(p, metal);
  else if (product.category === 'pendant') pendants[product.sku]?.(p, metal);
  else return null;
  const g = p.build();
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  g.position.set(-c.x, -box.max.y, -c.z);
  const wrap = new THREE.Group();
  wrap.add(g);
  // Pendants are modelled on a smaller bust; bring them back to a wearable size.
  if (product.category === 'pendant') wrap.scale.setScalar(1 / PENDANT_SCALE);
  return { group: wrap, kind: 'necklace' };
}

// --- display pieces --------------------------------------------------------------------------

/**
 * Unnamed display pieces that fill out a vitrine the way a real boutique case is dressed (several
 * pieces on small stands around the featured one). They are not catalogue products: never named,
 * priced, listed or sold; selecting the case always opens its featured piece.
 */
export type DisplayPiece = 'bangles' | 'studs' | 'rings' | 'chain' | 'drops';

export function buildDisplayPiece(kind: DisplayPiece, tone: Tone, seed = 0): THREE.Group {
  const metal = toneMat(tone);
  const p = new Parts();
  const tray = (w: number, d: number) => {
    p.add(new RoundedBoxGeometry(w, 0.014, d, 2, 0.005), 'blackSatin', V(0, 0.007, 0));
    p.add(new RoundedBoxGeometry(w - 0.012, 0.006, d - 0.012, 2, 0.002), 'velvet', V(0, 0.016, 0));
  };
  switch (kind) {
    case 'bangles': {
      // Three bangles leaning on a slim black cone.
      p.add(new THREE.CylinderGeometry(0.012, 0.03, 0.1, 24), 'blackSatin', V(0, 0.05, 0));
      [0, 1, 2].forEach((i) => {
        const g = i === 1 ? hammeredTorus(0.034, 0.0032, seed + i) : torus(0.034, 0.0028 + i * 0.0004, TAU, 10, 64);
        p.add(g, metal, V(0, 0.04 + i * 0.012, 0), new THREE.Euler(Math.PI / 2 + 0.18 - i * 0.12, 0, 0.08 * (i - 1)));
      });
      break;
    }
    case 'studs': {
      tray(0.11, 0.07);
      [-0.022, 0.022].forEach((x) => flower(p, V(x, 0.024, 0), 0.0045, metal, seed % 2 ? 'pearl' : 'polki', new THREE.Euler(-Math.PI / 2, 0, 0)));
      [-0.022, 0.022].forEach((x) => p.add(sphere(0.0035, 12), seed % 2 ? 'polki' : 'pearl', V(x, 0.024, 0.022)));
      break;
    }
    case 'rings': {
      tray(0.13, 0.06);
      [-0.04, 0, 0.04].forEach((x, i) => {
        p.add(torus(0.0085, 0.0014 + (i === 1 ? 0.0006 : 0), TAU, 8, 40), metal, V(x, 0.03, 0));
        if (i === 1) p.add(sphere(0.003, 12), seed % 2 ? 'emerald' : 'polki', V(x, 0.0395, 0));
      });
      break;
    }
    case 'chain': {
      // A small neck form with a fine chain and a single drop.
      const s = 0.46;
      p.add(new RoundedBoxGeometry(0.14, 0.014, 0.1, 2, 0.005), 'blackSatin', V(0, 0.007, 0));
      const base = new Parts();
      addBust(base, s);
      const bust = base.build();
      const g = new THREE.Group();
      bust.position.y = 0.014;
      g.add(bust);
      const c = bustCurve(0.335 * s, 0.09 * s, 1.3, 0.003, s);
      p.add(new THREE.TubeGeometry(c, 64, 0.0008, 5), metal, V(0, 0.014, 0));
      const b = c.getPointAt(0.5);
      p.add(sphere(0.003, 10), seed % 2 ? 'ruby' : 'polki', b.clone().add(V(0, 0.01, 0.002)));
      g.add(p.build());
      return g;
    }
    case 'drops': {
      // A small T-bar with a pair of drop earrings.
      p.add(new THREE.CylinderGeometry(0.025, 0.028, 0.008, 24), 'blackMetal', V(0, 0.004, 0));
      p.add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.1, 10), 'blackMetal', V(0, 0.054, 0));
      p.add(new THREE.CylinderGeometry(0.002, 0.002, 0.08, 10), 'blackMetal', V(0, 0.102, 0), new THREE.Euler(0, 0, Math.PI / 2));
      [-0.028, 0.028].forEach((x) => {
        p.add(torus(0.004, 0.0007, TAU, 6, 24), metal, V(x, 0.097, 0), new THREE.Euler(0, Math.PI / 2, 0));
        p.add(new THREE.CylinderGeometry(0.0006, 0.0006, 0.018, 6), metal, V(x, 0.084, 0));
        p.add(sphere(0.0045, 12), seed % 2 ? 'pearl' : 'emerald', V(x, 0.072, 0), new THREE.Euler(), V(1, 1.3, 1));
      });
      break;
    }
  }
  return p.build();
}
