/**
 * Decorative features added for realism: pure data (no three.js), shared by the scene, the
 * collision map and the Blender light-bake script (bake/bake.py via bake/layout.json).
 */
import { DISPLAYS, type Box2 } from './displays-data';

/** Black console with a floral arrangement, against the left partition inside the foyer. */
export const CONSOLE = { x0: -2.4, z0: -6.6, x1: -2.02, z1: -5.4, h: 0.82 };

/** Framed artwork hung on the right partition, facing into the foyer. */
export const ARTWORK = { x: 2.395, z: -6.0, y: 1.72, w: 1.1, h: 1.45 };

/**
 * Rings & Combos salon: walnut-panelled, under a lowered bronze-toned ceiling tray, with a
 * statement chandelier over the combos table.
 */
export const SALON = { x0: -2.6, x1: 2.6, z0: -13.9, z1: -8.1, trayY: 3.55 };
export const CHANDELIER = { x: 0, z: -9.9, top: SALON.trayY, bottom: 2.55, r: 0.42 };

/** Lounge either side of the salon, behind the ring vitrines. */
export const ARMCHAIRS: { x: number; z: number; rotY: number; w: number; d: number }[] = [
  { x: -3.1, z: -10.4, rotY: Math.PI / 2, w: 0.74, d: 0.74 },
  { x: 3.1, z: -10.4, rotY: -Math.PI / 2, w: 0.74, d: 0.74 },
];
export const SIDE_TABLE = { x: -3.1, z: -11.35, r: 0.23, h: 0.52 };
/** Flat rug under the combos table (walkable, so no collider). */
export const RUG = { x: 0, z: -10.2, w: 2.3, d: 2.5 };

/** Floor-standing cheval try-on mirrors beside each tall wall vitrine, against the outer wall. */
export const FLOOR_MIRRORS: { x: number; z: number; rotY: number }[] = DISPLAYS.filter((d) => d.style === 'tall').map((d) => {
  const s = Math.sign(d.x);
  return { x: s * 7.12, z: d.z - 0.9, rotY: s < 0 ? Math.PI / 2 : -Math.PI / 2 };
});
export const FLOOR_MIRROR_SIZE = { w: 0.36, d: 0.28, h: 1.55 };

/** Sheer curtains inside the two shop windows (drawn to the sides), within each arm. */
export const CURTAINS: { x0: number; x1: number }[] = [
  { x0: -6.5, x1: -2.6 },
  { x0: 2.6, x1: 6.5 },
];

/** Brass inlay strips set into the floor at each doorway threshold. */
export const THRESHOLDS: Box2[] = [
  { x0: -1.1, z0: -0.24, x1: 1.1, z1: -0.215 },
  { x0: -2.5125, z0: -4.0, x1: -2.4875, z1: -1.6 },
  { x0: 2.4875, z0: -4.0, x1: 2.5125, z1: -1.6 },
  { x0: -2.34, z0: -8.0125, x1: 2.34, z1: -7.9875 },
];

/** Recessed ceiling downlights: one above each vitrine plus the foyer, combos table and cashier. */
export const DOWNLIGHTS: { x: number; z: number; kind: 'display' | 'general' }[] = [
  ...DISPLAYS.map((d) => ({ x: d.x + Math.sin(d.rotY) * 0.35, z: d.z + Math.cos(d.rotY) * 0.35, kind: 'display' as const })),
  ...[
    [0, -1.4], [0, -4.4], [0, -7.2], [-1, -12.6], [1, -12.6],
    [-4.8, -1.8], [-4.8, -4.6], [-4.8, -7.4], [4.8, -1.8], [4.8, -4.6], [4.8, -7.4],
    [-5.2, -10.2], [-5.2, -12.8], [5.2, -10.8], [5.2, -13.0], [-2.9, -10.4], [2.9, -10.4],
  ].map(([x, z]) => ({ x, z, kind: 'general' as const })),
];

/** Ceiling height at a point: the salon sits under a lowered tray. */
export function ceilingAt(x: number, z: number, ceiling = 3.8) {
  return x > SALON.x0 && x < SALON.x1 && z > SALON.z0 && z < SALON.z1 ? SALON.trayY : ceiling;
}

export type StaffId = 'cashier' | 'consultant' | 'left' | 'right';

export interface StaffSpot {
  id: StaffId;
  role: string;
  /** How the person introduces themselves in the greeting panel. */
  greeting: string;
  /** GLB in public/staff/. */
  file: string;
  x: number;
  z: number;
  /** Facing (radians about y; 0 faces the street). */
  rotY: number;
  /** Target standing height in metres (models are normalised to this). */
  height: number;
  /** Collider half-size; 0 when already inside another obstacle (behind the counter). */
  half: number;
}

/** The Staff component and colliders follow this flag. */
export const STAFF_ENABLED = true;

/** Showroom staff: two behind the cashier counter, one attendant in each side room. */
export const STAFF: StaffSpot[] = [
  { id: 'cashier', role: 'Cashier', greeting: 'Welcome to the counter. I will look after your order.', file: '/staff/cashier.glb', x: -0.5, z: -13.38, rotY: 0, height: 1.66, half: 0 },
  { id: 'consultant', role: 'Salon consultant', greeting: 'Good to see you in the salon. Shall I show you around?', file: '/staff/consultant.glb', x: 0.8, z: -13.38, rotY: -0.2, height: 1.76, half: 0 },
  { id: 'left', role: 'Attendant, Necklaces & Bracelets', greeting: 'Welcome. I can walk you through the pieces, or the whole showroom.', file: '/staff/attendant-left.glb', x: -5.5, z: -6.4, rotY: 0.5, height: 1.64, half: 0.25 },
  { id: 'right', role: 'Attendant, Earrings & Pendants', greeting: 'Welcome. I can walk you through the pieces, or the whole showroom.', file: '/staff/attendant-right.glb', x: 5.5, z: -6.4, rotY: -0.5, height: 1.63, half: 0.25 },
];

export const STAFF_BY_ID: Record<StaffId, StaffSpot> = Object.fromEntries(STAFF.map((s) => [s.id, s])) as Record<StaffId, StaffSpot>;

/** Colliders for the furniture added in this file (all axis-aligned boxes). */
export const FURNITURE_COLLIDERS: Box2[] = [
  ...ARMCHAIRS.map((a) => ({ x0: a.x - a.w / 2, z0: a.z - a.d / 2, x1: a.x + a.w / 2, z1: a.z + a.d / 2 })),
  { x0: SIDE_TABLE.x - SIDE_TABLE.r, z0: SIDE_TABLE.z - SIDE_TABLE.r, x1: SIDE_TABLE.x + SIDE_TABLE.r, z1: SIDE_TABLE.z + SIDE_TABLE.r },
  ...FLOOR_MIRRORS.map((m) => ({ x0: m.x - FLOOR_MIRROR_SIZE.d / 2, z0: m.z - FLOOR_MIRROR_SIZE.w / 2, x1: m.x + FLOOR_MIRROR_SIZE.d / 2, z1: m.z + FLOOR_MIRROR_SIZE.w / 2 })),
];

export const FEATURES = {
  console: CONSOLE, artwork: ARTWORK, downlights: DOWNLIGHTS, staff: STAFF, salon: SALON, chandelier: CHANDELIER,
  armchairs: ARMCHAIRS, sideTable: SIDE_TABLE, floorMirrors: FLOOR_MIRRORS, floorMirrorSize: FLOOR_MIRROR_SIZE,
};
