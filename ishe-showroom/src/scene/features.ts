/**
 * Decorative features added for realism: pure data (no three.js), shared by the scene, the
 * collision map and the Blender light-bake script (bake/bake.py via bake/layout.json).
 */
import { DISPLAYS, type Box2 } from './displays-data';

/** Black console with a floral arrangement against the front wall, left of the door. */
export const CONSOLE = { x0: -2.05, z0: -0.55, x1: -1.35, z1: -0.15, h: 0.82 };

/** Gold-leaf panel on the back wall of the left gallery, above the lounge (faces the street). */
export const ARTWORK = { x: -4.6, z: -13.84, y: 1.72, w: 1.1, h: 1.45, rotY: 0 };

/**
 * Far end (Rings & Combos): black lacquered feature wall under a lowered white ceiling tray, with a
 * statement chandelier over the combos table.
 */
export const SALON = { x0: -2.6, x1: 2.6, z0: -13.9, z1: -9.0, trayY: 3.55 };
export const CHANDELIER = { x: 0, z: -10.4, top: SALON.trayY, bottom: 2.55, r: 0.42 };

/** Lounge in the back corner of the left gallery: two armchairs and a tea table, on a rug. */
export const ARMCHAIRS: { x: number; z: number; rotY: number; w: number; d: number }[] = [
  { x: -6.7, z: -11.55, rotY: Math.PI / 2, w: 0.74, d: 0.74 },
  { x: -6.7, z: -13.05, rotY: Math.PI / 2, w: 0.74, d: 0.74 },
];
export const SIDE_TABLE = { x: -6.8, z: -12.3, r: 0.23, h: 0.52 };
/** Flat rug under the lounge (walkable, so no collider). */
export const RUG = { x: -6.3, z: -12.3, w: 1.8, d: 2.4 };

/** Floor-standing cheval try-on mirrors beside each tall wall vitrine, against the outer wall. */
export const FLOOR_MIRRORS: { x: number; z: number; rotY: number }[] = DISPLAYS.filter((d) => d.style === 'tall' && Math.abs(d.x) > 5).map((d) => {
  const s = Math.sign(d.x);
  return { x: s * 7.12, z: d.z - 0.8, rotY: s < 0 ? Math.PI / 2 : -Math.PI / 2 };
});
export const FLOOR_MIRROR_SIZE = { w: 0.36, d: 0.28, h: 1.55 };

/** Sheer curtains inside the two shop windows (drawn to the sides), within each arm. */
export const CURTAINS: { x0: number; x1: number }[] = [
  { x0: -6.5, x1: -2.6 },
  { x0: 2.6, x1: 6.5 },
];

/** Brass inlay strips set into the terrazzo: at the front door and where the aisle meets the far end. */
export const THRESHOLDS: Box2[] = [
  { x0: -1.1, z0: -0.24, x1: 1.1, z1: -0.215 },
  { x0: -1.2, z0: -9.0125, x1: 1.2, z1: -8.9875 },
];

/** Recessed ceiling downlights: one above each vitrine plus the aisle, side galleries, lounge and cashier. */
export const DOWNLIGHTS: { x: number; z: number; kind: 'display' | 'general' }[] = [
  ...DISPLAYS.map((d) => ({ x: d.x + Math.sin(d.rotY) * 0.35, z: d.z + Math.cos(d.rotY) * 0.35, kind: 'display' as const })),
  ...[
    [0, -1.4], [0, -4.0], [0, -6.4], [0, -8.6], [-1, -12.0], [1, -12.0],
    [-5.4, -2.2], [-5.4, -5.0], [-5.4, -7.6], [-5.4, -10.2], [5.4, -2.2], [5.4, -5.0], [5.4, -7.6], [5.4, -10.2],
    [-5.9, -12.4], [4.4, -12.2], [6.0, -12.2],
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

/**
 * Showroom staff: two behind the cashier counter (back-right corner), an attendant by the lounge at
 * the back of the left gallery, and one greeting visitors at the front of the right gallery.
 */
export const STAFF: StaffSpot[] = [
  { id: 'cashier', role: 'Cashier', greeting: 'Welcome to the counter. I will look after your order.', file: '/staff/cashier.glb', x: 4.6, z: -13.38, rotY: 0, height: 1.66, half: 0 },
  { id: 'consultant', role: 'Salon consultant', greeting: 'Good to see you in the salon. Shall I show you around?', file: '/staff/consultant.glb', x: 5.9, z: -13.38, rotY: -0.2, height: 1.76, half: 0 },
  { id: 'left', role: 'Attendant, Necklaces & Bracelets', greeting: 'Welcome. I can walk you through the pieces, or the whole showroom.', file: '/staff/attendant-left.glb', x: -4.2, z: -12.0, rotY: -0.6, height: 1.64, half: 0.25 },
  { id: 'right', role: 'Attendant, Earrings & Pendants', greeting: 'Welcome. I can walk you through the pieces, or the whole showroom.', file: '/staff/attendant-right.glb', x: 4.1, z: -2.4, rotY: -0.9, height: 1.63, half: 0.25 },
];

export const STAFF_BY_ID: Record<StaffId, StaffSpot> = Object.fromEntries(STAFF.map((s) => [s.id, s])) as Record<StaffId, StaffSpot>;

/** Window displays just inside each shop window, facing the street: in the inner pane, clear of the
 * centre mullion (x = ±4.35) and between the curtain panels. */
export const WINDOW_DISPLAYS: { x: number; z: number }[] = [{ x: -4.9, z: -0.5 }, { x: 4.9, z: -0.5 }];
export const WINDOW_PLINTH = { w: 0.62, d: 0.42, h: 0.92 };

/** White pilasters on both outer walls, between the tall vitrines and mirrors; each carries a brass sconce. */
export const PILASTER = { w: 0.36, d: 0.1 };
export const PILASTER_Z: { left: number[]; right: number[] } = {
  left: [-2.2, -5.25, -7.9, -10.6, -12.6],
  right: [-1.8, -4.45, -6.75, -9.05, -11.6],
};

/** Colliders for the furniture added in this file (all axis-aligned boxes). */
export const FURNITURE_COLLIDERS: Box2[] = [
  ...ARMCHAIRS.map((a) => ({ x0: a.x - a.w / 2, z0: a.z - a.d / 2, x1: a.x + a.w / 2, z1: a.z + a.d / 2 })),
  { x0: SIDE_TABLE.x - SIDE_TABLE.r, z0: SIDE_TABLE.z - SIDE_TABLE.r, x1: SIDE_TABLE.x + SIDE_TABLE.r, z1: SIDE_TABLE.z + SIDE_TABLE.r },
  ...FLOOR_MIRRORS.map((m) => ({ x0: m.x - FLOOR_MIRROR_SIZE.d / 2, z0: m.z - FLOOR_MIRROR_SIZE.w / 2, x1: m.x + FLOOR_MIRROR_SIZE.d / 2, z1: m.z + FLOOR_MIRROR_SIZE.w / 2 })),
  ...WINDOW_DISPLAYS.map((w) => ({ x0: w.x - WINDOW_PLINTH.w / 2, z0: w.z - WINDOW_PLINTH.d / 2, x1: w.x + WINDOW_PLINTH.w / 2, z1: w.z + WINDOW_PLINTH.d / 2 })),
  ...([-1, 1] as const).flatMap((s) => PILASTER_Z[s < 0 ? 'left' : 'right'].map((z) => {
    const inner = s * (7.4 - PILASTER.d);
    return { x0: Math.min(inner, s * 7.4), z0: z - PILASTER.w / 2, x1: Math.max(inner, s * 7.4), z1: z + PILASTER.w / 2 };
  })),
];

export const FEATURES = {
  console: CONSOLE, artwork: ARTWORK, downlights: DOWNLIGHTS, staff: STAFF, salon: SALON, chandelier: CHANDELIER,
  armchairs: ARMCHAIRS, sideTable: SIDE_TABLE, floorMirrors: FLOOR_MIRRORS, floorMirrorSize: FLOOR_MIRROR_SIZE,
  pilaster: PILASTER, pilasterZ: PILASTER_Z,
};
