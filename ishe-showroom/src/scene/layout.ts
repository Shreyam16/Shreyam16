/**
 * Showroom floor plan: pure data, no three.js imports (unit-tested in tests/layout.test.ts).
 *
 * Coordinates in metres. x = right, y = up, z = toward the street.
 * The facade sits on z = 0; the showroom runs back to z = -14 and spans x = -7.5..7.5 (15 m x 14 m),
 * ceiling 3.8 m. The U is: left arm (x < -2.5) + back salon (z < -8) + right arm (x > 2.5), with the
 * entrance foyer / junction in the notch of the U.
 */
import { PRODUCTS, type RoomId } from '@/data/catalogue';

export const EYE = 1.65;
export const CEILING = 3.8;
export const HALF_W = 7.5;
export const DEPTH = 14;
export const WALL_T = 0.2;
export const PARTITION_X = 2.5;
export const PARTITION_END_Z = -8;
export const SIDE_DOOR = { z0: -4.0, z1: -1.6, lintel: 2.9 };
export const FRONT_DOOR = { halfWidth: 1.1, height: 2.75 };
export const BODY_RADIUS = 0.3;

export * from './displays-data';
import { DISPLAYS, type Box2, type DisplaySpec } from './displays-data';
import { CONSOLE, STAFF, STAFF_ENABLED } from './features';

export const DISPLAY_BY_SKU: Record<string, DisplaySpec> = Object.fromEntries(DISPLAYS.map((d) => [d.sku, d]));

export const COMBO_TABLE = { x: 0, z: -9.9, r: 0.42, h: 0.95 };
export const CASHIER = { x: 0, z: -12.85, w: 2.8, d: 0.6, h: 1.02, customerZ: -10.85 };

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
  // Partitions with side doorways into the arms.
  { x0: -PARTITION_X - 0.1, z0: SIDE_DOOR.z1, x1: -PARTITION_X + 0.1, z1: 0 },
  { x0: -PARTITION_X - 0.1, z0: PARTITION_END_Z, x1: -PARTITION_X + 0.1, z1: SIDE_DOOR.z0 },
  { x0: PARTITION_X - 0.1, z0: SIDE_DOOR.z1, x1: PARTITION_X + 0.1, z1: 0 },
  { x0: PARTITION_X - 0.1, z0: PARTITION_END_Z, x1: PARTITION_X + 0.1, z1: SIDE_DOOR.z0 },
];

/** Velvet benches against the partitions inside each arm. */
export const BENCHES: Box2[] = [
  { x0: -3.18, z0: -6.9, x1: -2.6, z1: -5.3 },
  { x0: 2.6, z0: -6.9, x1: 3.18, z1: -5.3 },
];

export const OBSTACLES: Box2[] = [
  ...WALLS,
  ...BENCHES,
  CONSOLE,
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
  junction: { id: 'junction', x: 0, z: -2.8, lookX: 0, lookZ: -9, room: 'foyer' },
  leftDoor: { id: 'leftDoor', x: -2.5, z: -2.8, lookX: -6, lookZ: -3.4, room: 'left' },
  left: { id: 'left', x: -4.4, z: -3.2, lookX: -7, lookZ: -5.2, room: 'left' },
  left2: { id: 'left2', x: -4.6, z: -6.6, lookX: -5.2, lookZ: -11, room: 'left' },
  leftBack: { id: 'leftBack', x: -5.2, z: -8.4, lookX: -5.2, lookZ: -12, room: 'left' },
  leftMid: { id: 'leftMid', x: -5.2, z: -10.1, lookX: -5.2, lookZ: -13.5, room: 'left' },
  leftBack2: { id: 'leftBack2', x: -5.2, z: -11.9, lookX: -5.2, lookZ: -13.5, room: 'left' },
  centre: { id: 'centre', x: 0, z: -8.5, lookX: 0, lookZ: -13.5, room: 'centre' },
  centreL: { id: 'centreL', x: -1.1, z: -9.0, lookX: -2, lookZ: -10.7, room: 'centre' },
  centreL2: { id: 'centreL2', x: -1.1, z: -11.4, lookX: -2, lookZ: -12.2, room: 'centre' },
  centreR: { id: 'centreR', x: 1.1, z: -9.0, lookX: 2, lookZ: -10.7, room: 'centre' },
  centreR2: { id: 'centreR2', x: 1.1, z: -11.4, lookX: 2, lookZ: -12.2, room: 'centre' },
  cashier: { id: 'cashier', x: 0, z: CASHIER.customerZ, lookX: 0, lookZ: -14, room: 'centre' },
  rightDoor: { id: 'rightDoor', x: 2.5, z: -2.8, lookX: 6, lookZ: -3.4, room: 'right' },
  right: { id: 'right', x: 4.4, z: -3.2, lookX: 7, lookZ: -5.2, room: 'right' },
  right2: { id: 'right2', x: 4.6, z: -6.6, lookX: 5.2, lookZ: -11, room: 'right' },
  rightBack: { id: 'rightBack', x: 5.2, z: -8.4, lookX: 5.2, lookZ: -12, room: 'right' },
  rightBack2: { id: 'rightBack2', x: 5.2, z: -10.8, lookX: 5.2, lookZ: -13.5, room: 'right' },
};

export const EDGES: [NodeId, NodeId][] = [
  ['junction', 'leftDoor'], ['leftDoor', 'left'], ['left', 'left2'], ['left2', 'leftBack'], ['leftBack', 'leftMid'], ['leftMid', 'leftBack2'],
  ['junction', 'rightDoor'], ['rightDoor', 'right'], ['right', 'right2'], ['right2', 'rightBack'], ['rightBack', 'rightBack2'],
  ['junction', 'centre'], ['centre', 'centreL'], ['centre', 'centreR'], ['centreL', 'centreL2'], ['centreR', 'centreR2'],
  ['centreL2', 'cashier'], ['centreR2', 'cashier'],
  ['leftBack', 'centre'], ['rightBack', 'centre'],
];

/** The arrival stop for each room when chosen from the junction. */
export const ROOM_ENTRY: Record<RoomId | 'foyer', NodeId> = { foyer: 'junction', left: 'left', centre: 'centre', right: 'right' };

/** Sub-stops inside each room for in-room wayfinding. */
export const ROOM_STOPS: Record<RoomId, { node: NodeId; label: string }[]> = {
  left: [{ node: 'left', label: 'Necklaces' }, { node: 'leftBack', label: 'Bracelets' }],
  centre: [{ node: 'centre', label: 'Rings' }, { node: 'centre', label: 'Combos' }, { node: 'cashier', label: 'Cashier' }],
  right: [{ node: 'right', label: 'Earrings' }, { node: 'rightBack', label: 'Pendants' }],
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
  return { x: 0, y: 1.6, z: COMBO_TABLE.z + 1.15, tx: 0, ty: COMBO_TABLE.h, tz: COMBO_TABLE.z };
}

export function cashierPose(): Pose {
  return { x: 0, y: EYE, z: CASHIER.customerZ, tx: 0, ty: 1.3, tz: CASHIER.z - 0.45 };
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
  if (x < -PARTITION_X) return 'left';
  if (x > PARTITION_X) return 'right';
  if (z < PARTITION_END_Z) return x < -3 ? 'left' : x > 3 ? 'right' : 'centre';
  return 'foyer';
}

export const ROOM_OF_SKU: Record<string, RoomId> = Object.fromEntries(PRODUCTS.map((p) => [p.sku, p.room]));
