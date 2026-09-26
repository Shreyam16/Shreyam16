/**
 * Showroom floor plan: pure data, no three.js imports (unit-tested in tests/layout.test.ts).
 *
 * Coordinates in metres. x = right, y = up, z = toward the street.
 * The facade sits on z = 0; the showroom runs back to z = -14 and spans x = -7.5..7.5 (15 m x 14 m),
 * ceiling 3.8 m. It is one open gallery: a central aisle between two rows of white columns
 * (x = ±2.9), a side gallery beyond each colonnade (left: Necklaces & Bracelets, right: Earrings &
 * Pendants), and the far end (Rings & Combos) in front of a black feature wall, with the cashier
 * counter in the back-right corner.
 */
import { PRODUCTS, type Occasion, type RoomId } from '@/data/catalogue';

export const EYE = 1.65;
export const CEILING = 3.8;
export const HALF_W = 7.5;
export const DEPTH = 14;
export const WALL_T = 0.2;
/** Square white columns either side of the aisle. */
export const COLUMN = { x: 2.9, size: 0.46, z: [-2.4, -5.0, -7.6, -10.2] };
export const COLUMNS: Box2[] = [-1, 1].flatMap((s) => COLUMN.z.map((z) => ({
  x0: s * COLUMN.x - COLUMN.size / 2, z0: z - COLUMN.size / 2, x1: s * COLUMN.x + COLUMN.size / 2, z1: z + COLUMN.size / 2,
})));
/** Where the aisle opens into the far end (Rings & Combos). */
export const FAR_END_Z = -9.0;
export const FRONT_DOOR = { halfWidth: 1.1, height: 2.75 };
export const BODY_RADIUS = 0.3;

export * from './displays-data';
import { DISPLAYS, type Box2, type DisplaySpec } from './displays-data';
import { CONSOLE, FURNITURE_COLLIDERS, STAFF, STAFF_BY_ID, STAFF_ENABLED, type StaffId } from './features';

export const DISPLAY_BY_SKU: Record<string, DisplaySpec> = Object.fromEntries(DISPLAYS.map((d) => [d.sku, d]));

/** Combos table in the back-right corner, beside the counter, so the aisle stays clear to the hero pedestal. */
export const COMBO_TABLE = { x: 4.0, z: -11.3, r: 0.42, h: 0.95 };
/** Cashier counter in the back-right corner of the far end, facing the street. */
export const CASHIER = { x: 5.2, z: -12.85, w: 2.8, d: 0.6, h: 1.02, customerZ: -11.0 };

/** Axis-aligned footprint of a display, accounting for its rotation (multiples of 90°). */
export function displayFootprint(d: DisplaySpec): Box2 {
  const quarter = Math.abs(Math.round(d.rotY / (Math.PI / 2))) % 2 === 1;
  const hx = (quarter ? d.d : d.w) / 2;
  const hz = (quarter ? d.w : d.d) / 2;
  return { x0: d.x - hx, z0: d.z - hz, x1: d.x + hx, z1: d.z + hz };
}

/** Wall colliders (interior side). The front door gap is closed once the visitor is inside. */
export const WALLS: Box2[] = [
  { x0: -HALF_W - 0.1, z0: -0.1, x1: HALF_W + 0.1, z1: 0.1 }, // facade incl. door (closed behind visitor)
  { x0: -HALF_W - 0.1, z0: -DEPTH - 0.1, x1: -HALF_W + 0.1, z1: 0.1 },
  { x0: HALF_W - 0.1, z0: -DEPTH - 0.1, x1: HALF_W + 0.1, z1: 0.1 },
  { x0: -HALF_W - 0.1, z0: -DEPTH - 0.1, x1: HALF_W + 0.1, z1: -DEPTH + 0.1 },
];

export const OBSTACLES: Box2[] = [
  ...WALLS,
  ...COLUMNS,
  CONSOLE,
  ...FURNITURE_COLLIDERS,
  ...STAFF.filter((p) => STAFF_ENABLED && p.half > 0).map((p) => ({ x0: p.x - p.half, z0: p.z - p.half, x1: p.x + p.half, z1: p.z + p.half })),
  ...DISPLAYS.map(displayFootprint),
  { x0: COMBO_TABLE.x - COMBO_TABLE.r, z0: COMBO_TABLE.z - COMBO_TABLE.r, x1: COMBO_TABLE.x + COMBO_TABLE.r, z1: COMBO_TABLE.z + COMBO_TABLE.r },
  { x0: CASHIER.x - CASHIER.w / 2 - 0.4, z0: -DEPTH, x1: CASHIER.x + CASHIER.w / 2 + 0.4, z1: CASHIER.z + CASHIER.d / 2 },
];

// ---------------------------------------------------------------------------------------------
// Navigation graph
// ---------------------------------------------------------------------------------------------

export type NodeId =
  | 'junction' | 'leftDoor' | 'left' | 'left2' | 'leftBack' | 'leftMid' | 'leftBack2'
  | 'centre' | 'centreL' | 'centreL2' | 'centreR' | 'centreR2' | 'cashier'
  | 'rightDoor' | 'right' | 'right2' | 'rightBack' | 'rightBack2';

export interface NavNode { id: NodeId; x: number; z: number; /** where to look when arriving */ lookX: number; lookZ: number; room: RoomId | 'foyer' }

export const NODES: Record<NodeId, NavNode> = {
  // The junction: just inside the door, looking straight down the gallery to the hero pedestal.
  junction: { id: 'junction', x: 0, z: -2.8, lookX: 0, lookZ: -12, room: 'foyer' },
  // Side galleries are entered from the front, past the first column, then walked along a lane.
  leftDoor: { id: 'leftDoor', x: -2.9, z: -1.6, lookX: -6, lookZ: -2.2, room: 'left' },
  left: { id: 'left', x: -5.4, z: -1.7, lookX: -6.2, lookZ: -6.5, room: 'left' },
  left2: { id: 'left2', x: -5.4, z: -6.3, lookX: -7, lookZ: -7.4, room: 'left' },
  leftBack: { id: 'leftBack', x: -5.4, z: -8.9, lookX: -3.9, lookZ: -10.6, room: 'left' },
  leftMid: { id: 'leftMid', x: -2.9, z: -8.9, lookX: -6, lookZ: -9.2, room: 'left' },
  leftBack2: { id: 'leftBack2', x: -5.5, z: -11.2, lookX: -6.8, lookZ: -12.6, room: 'left' },
  centre: { id: 'centre', x: 0, z: -9.2, lookX: 0, lookZ: -13.5, room: 'centre' },
  centreL: { id: 'centreL', x: -0.95, z: -9.5, lookX: -2, lookZ: -10.6, room: 'centre' },
  centreL2: { id: 'centreL2', x: -0.95, z: -11.9, lookX: -2, lookZ: -12.4, room: 'centre' },
  centreR: { id: 'centreR', x: 0.95, z: -9.5, lookX: 2, lookZ: -10.6, room: 'centre' },
  centreR2: { id: 'centreR2', x: 0.95, z: -11.9, lookX: 2, lookZ: -12.4, room: 'centre' },
  cashier: { id: 'cashier', x: CASHIER.x, z: CASHIER.customerZ, lookX: CASHIER.x, lookZ: -14, room: 'centre' },
  rightDoor: { id: 'rightDoor', x: 2.9, z: -1.6, lookX: 6, lookZ: -2.2, room: 'right' },
  right: { id: 'right', x: 5.4, z: -1.7, lookX: 6.2, lookZ: -6.5, room: 'right' },
  right2: { id: 'right2', x: 5.4, z: -6.3, lookX: 3.6, lookZ: -7.4, room: 'right' },
  rightBack: { id: 'rightBack', x: 5.4, z: -8.9, lookX: 5.4, lookZ: -13, room: 'right' },
  rightBack2: { id: 'rightBack2', x: 2.9, z: -8.9, lookX: 6, lookZ: -9.2, room: 'right' },
};

export const EDGES: [NodeId, NodeId][] = [
  ['junction', 'leftDoor'], ['leftDoor', 'left'], ['left', 'left2'], ['left2', 'leftBack'], ['leftBack', 'leftBack2'], ['leftBack', 'leftMid'],
  ['junction', 'rightDoor'], ['rightDoor', 'right'], ['right', 'right2'], ['right2', 'rightBack'], ['rightBack', 'rightBack2'],
  ['junction', 'centre'], ['centre', 'centreL'], ['centre', 'centreR'], ['centreL', 'centreL2'], ['centreR', 'centreR2'],
  ['leftMid', 'centre'], ['rightBack2', 'centre'], ['rightBack', 'cashier'],
];

/** The arrival stop for each room when chosen from the junction. */
export const ROOM_ENTRY: Record<RoomId | 'foyer', NodeId> = { foyer: 'junction', left: 'left', centre: 'centre', right: 'right' };

/** Sub-stops inside each room for in-room wayfinding. */
export const ROOM_STOPS: Record<RoomId, { node: NodeId; label: string }[]> = {
  left: [{ node: 'left', label: 'Necklaces' }, { node: 'left2', label: 'Bracelets' }],
  centre: [{ node: 'centre', label: 'Rings' }, { node: 'centre', label: 'Combos' }, { node: 'cashier', label: 'Cashier' }],
  right: [{ node: 'right', label: 'Earrings' }, { node: 'right2', label: 'Pendants' }],
};

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

export function circleHitsBox(x: number, z: number, r: number, b: Box2): boolean {
  const cx = Math.max(b.x0, Math.min(x, b.x1));
  const cz = Math.max(b.z0, Math.min(z, b.z1));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function collides(x: number, z: number, r = BODY_RADIUS, obstacles: Box2[] = OBSTACLES): boolean {
  return obstacles.some((b) => circleHitsBox(x, z, r, b));
}

/** Sweep test: samples the segment every 5 cm. */
export function segmentClear(ax: number, az: number, bx: number, bz: number, r = BODY_RADIUS, obstacles: Box2[] = OBSTACLES): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (collides(ax + (bx - ax) * t, az + (bz - az) * t, r, obstacles)) return false;
  }
  return true;
}

/** Move with wall sliding: try full move, then each axis. */
export function slideMove(x: number, z: number, dx: number, dz: number, r = BODY_RADIUS): { x: number; z: number } {
  if (!collides(x + dx, z + dz, r)) return { x: x + dx, z: z + dz };
  if (!collides(x + dx, z, r)) return { x: x + dx, z };
  if (!collides(x, z + dz, r)) return { x, z: z + dz };
  return { x, z };
}

export interface Pose { x: number; y: number; z: number; tx: number; ty: number; tz: number; /** FOV multiplier while focused (1 = normal). */ zoom?: number }

export function nodePose(id: NodeId): Pose {
  const n = NODES[id];
  return { x: n.x, y: EYE, z: n.z, tx: n.lookX, ty: 1.25, tz: n.lookZ };
}

/** Camera pose that frames one display from the front at close range. */
export function focusPose(sku: string): Pose {
  const d = DISPLAY_BY_SKU[sku];
  const dist = { bust: 1.05, cushion: 0.66, earringStand: 0.8, pendantStand: 0.85, ringCushion: 0.62 }[d.kind];
  const zoom = { bust: 0.62, cushion: 0.5, earringStand: 0.48, pendantStand: 0.56, ringCushion: 0.36 }[d.kind];
  const fx = Math.sin(d.rotY), fz = Math.cos(d.rotY);
  // A visitor leans in a little over the low table vitrines.
  const eye = d.style === 'tall' ? 1.6 : 1.5;
  return { x: d.x + fx * dist, y: eye, z: d.z + fz * dist, tx: d.x, ty: d.itemY + 0.02, tz: d.z, zoom };
}

export function comboPose(): Pose {
  return { x: COMBO_TABLE.x, y: 1.6, z: COMBO_TABLE.z + 1.15, tx: COMBO_TABLE.x, ty: COMBO_TABLE.h, tz: COMBO_TABLE.z };
}

export function cashierPose(): Pose {
  return { x: CASHIER.x, y: EYE, z: CASHIER.customerZ, tx: CASHIER.x, ty: 1.3, tz: CASHIER.z - 0.45 };
}

/** Standing in front of a member of staff, at a polite conversational distance. */
export function staffPose(id: StaffId): Pose {
  if (id === 'cashier' || id === 'consultant') return cashierPose();
  const s = STAFF_BY_ID[id];
  const dist = 1.7;
  return { x: s.x + Math.sin(s.rotY) * dist, y: EYE, z: s.z + Math.cos(s.rotY) * dist, tx: s.x, ty: 1.42, tz: s.z };
}

function neighbours(id: NodeId): NodeId[] {
  return EDGES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** Dijkstra over the nav graph. */
export function shortestPath(from: NodeId, to: NodeId): NodeId[] {
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const open = new Set<NodeId>([from]);
  while (open.size) {
    let cur: NodeId | null = null;
    for (const n of open) if (cur === null || (dist.get(n) ?? Infinity) < (dist.get(cur) ?? Infinity)) cur = n;
    if (!cur) break;
    open.delete(cur);
    if (cur === to) break;
    for (const nb of neighbours(cur)) {
      const nd = (dist.get(cur) ?? 0) + Math.hypot(NODES[nb].x - NODES[cur].x, NODES[nb].z - NODES[cur].z);
      if (nd < (dist.get(nb) ?? Infinity)) { dist.set(nb, nd); prev.set(nb, cur); open.add(nb); }
    }
  }
  const path: NodeId[] = [to];
  while (path[0] !== from) {
    const p = prev.get(path[0]);
    if (!p) return from === to ? [from] : [];
    path.unshift(p);
  }
  return path;
}

/** Nearest node reachable in a straight, collision-free line. */
export function nearestClearNode(x: number, z: number): NodeId {
  let best: NodeId = 'junction';
  let bestD = Infinity;
  for (const n of Object.values(NODES)) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD && segmentClear(x, z, n.x, n.z, 0.12)) { best = n.id; bestD = d; }
  }
  return best;
}

/** Waypoints (x, z) from a start position to a destination pose, routed through the nav graph. */
export function routeTo(fromX: number, fromZ: number, dest: Pose): { x: number; z: number }[] {
  const startNode = nearestClearNode(fromX, fromZ);
  const endNode = nearestClearNode(dest.x, dest.z);
  const nodes = shortestPath(startNode, endNode);
  const pts = [{ x: fromX, z: fromZ }, ...nodes.map((id) => ({ x: NODES[id].x, z: NODES[id].z })), { x: dest.x, z: dest.z }];
  // Drop intermediate points we can skip with a clear straight line (keeps motion purposeful).
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segmentClear(pts[i].x, pts[i].z, pts[j].x, pts[j].z, 0.25)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out.filter((p, k) => k === 0 || Math.hypot(p.x - out[k - 1].x, p.z - out[k - 1].z) > 0.02);
}

export function roomAt(x: number, z: number): RoomId | 'foyer' {
  // The far end (and the cashier corner) is Rings & Combos.
  if (z < FAR_END_Z && Math.abs(x) < COLUMN.x) return 'centre';
  if (x > COLUMN.x && z < -10.0) return 'centre';
  // The aisle itself is the gallery; its cases belong to the side they stand on.
  if (Math.abs(x) < 0.8 || z > -1.2) return 'foyer';
  return x < 0 ? 'left' : 'right';
}

export const ROOM_OF_SKU: Record<string, RoomId> = Object.fromEntries(PRODUCTS.map((p) => [p.sku, p.room]));

// ---------------------------------------------------------------------------------------------
// Guided tours
// ---------------------------------------------------------------------------------------------

export type TourId = 'bridal' | 'everyday' | 'gifting' | 'festive' | 'around';
export type TourStop = { kind: 'product'; sku: string } | { kind: 'node'; node: NodeId; caption: string } | { kind: 'combos' };

export const TOURS: Record<TourId, { label: string; blurb: string; occasion?: Occasion }> = {
  bridal: { label: 'Bridal', blurb: 'Pieces for ceremonies and wedding dressing.', occasion: 'wedding' },
  everyday: { label: 'Everyday', blurb: 'Easy pieces to wear every day.', occasion: 'everyday' },
  gifting: { label: 'Gifting', blurb: 'Pieces chosen with giving in mind.', occasion: 'gifting' },
  festive: { label: 'Festive', blurb: 'Colour and detail for celebrations.', occasion: 'festive' },
  around: { label: 'Show me around', blurb: 'A short walk through every room.' },
};

/** Walking order through the gallery: down the left side, the far end, back up the right side. */
const WALK_ORDER = ['ISH-B03', 'ISH-N02', 'ISH-B04', 'ISH-N03', 'ISH-B05', 'ISH-N04', 'ISH-B06', 'ISH-B01', 'ISH-B02',
  'ISH-R01', 'ISH-R02', 'ISH-R03', 'ISH-N01', 'ISH-R06', 'ISH-R05', 'ISH-R04',
  'ISH-E06', 'ISH-E05', 'ISH-E04', 'ISH-P02', 'ISH-E03', 'ISH-P01', 'ISH-E02', 'ISH-E01'];

export function tourStops(id: TourId): TourStop[] {
  const t = TOURS[id];
  if (!t.occasion) {
    return [
      { kind: 'node', node: 'left', caption: 'Necklaces on busts in the tall vitrines of the left gallery.' },
      { kind: 'node', node: 'left2', caption: 'Bracelets and bangles in the cases along the colonnade.' },
      { kind: 'combos' },
      { kind: 'node', node: 'right2', caption: 'Pendants and occasion earrings.' },
      { kind: 'node', node: 'right', caption: 'Earrings, from studs to chandbalis.' },
    ];
  }
  const occasion = t.occasion;
  return WALK_ORDER.filter((sku) => PRODUCTS.find((p) => p.sku === sku)?.occasions.includes(occasion)).map((sku) => ({ kind: 'product' as const, sku }));
}
