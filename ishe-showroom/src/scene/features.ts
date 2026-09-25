/**
 * Decorative features added for realism: pure data (no three.js), shared by the scene, the
 * collision map and the Blender light-bake script (bake/bake.py via bake/layout.json).
 */
import { DISPLAYS } from './displays-data';

/** Black console with a floral arrangement, against the left partition inside the foyer. */
export const CONSOLE = { x0: -2.4, z0: -6.6, x1: -2.02, z1: -5.4, h: 0.82 };

/** Framed artwork hung on the right partition, facing into the foyer. */
export const ARTWORK = { x: 2.395, z: -6.0, y: 1.72, w: 1.1, h: 1.45 };

/** Recessed ceiling downlights: one above each vitrine plus the foyer, combos table and cashier. */
export const DOWNLIGHTS: { x: number; z: number; kind: 'display' | 'general' }[] = [
  ...DISPLAYS.map((d) => ({ x: d.x + Math.sin(d.rotY) * 0.35, z: d.z + Math.cos(d.rotY) * 0.35, kind: 'display' as const })),
  ...[
    [0, -1.4], [0, -4.4], [0, -7.2], [0, -9.9], [-1, -12.6], [1, -12.6],
    [-4.8, -1.8], [-4.8, -4.6], [-4.8, -7.4], [4.8, -1.8], [4.8, -4.6], [4.8, -7.4],
    [-5.2, -10.2], [-5.2, -12.8], [5.2, -10.8], [5.2, -13.0], [-2.9, -10.4], [2.9, -10.4],
  ].map(([x, z]) => ({ x, z, kind: 'general' as const })),
];

export interface StaffSpot {
  id: string;
  role: string;
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

/** Turn on once the GLBs are in public/staff/ (the Staff component and colliders follow this flag). */
export const STAFF_ENABLED = false;

/** Showroom staff: two behind the cashier counter, one attendant in each side room. */
export const STAFF: StaffSpot[] = [
  { id: 'cashier', role: 'Cashier', file: '/staff/cashier.glb', x: -0.5, z: -13.35, rotY: 0, height: 1.66, half: 0 },
  { id: 'consultant', role: 'Salon consultant', file: '/staff/consultant.glb', x: 0.8, z: -13.35, rotY: -0.2, height: 1.74, half: 0 },
  { id: 'left', role: 'Attendant, Necklaces & Bracelets', file: '/staff/attendant-left.glb', x: -3.35, z: -4.7, rotY: 0.42, height: 1.72, half: 0.25 },
  { id: 'right', role: 'Attendant, Earrings & Pendants', file: '/staff/attendant-right.glb', x: 3.35, z: -4.7, rotY: -0.42, height: 1.64, half: 0.25 },
];

export const FEATURES = { console: CONSOLE, artwork: ARTWORK, downlights: DOWNLIGHTS, staff: STAFF };
