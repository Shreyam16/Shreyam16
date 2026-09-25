/** Vitrine placement for all 24 products (data only). */
import type { Category } from '@/data/catalogue';

export type DisplayKind = 'bust' | 'cushion' | 'earringStand' | 'pendantStand' | 'ringCushion';
export const KIND_FOR: Record<Category, DisplayKind> = {
  necklace: 'bust',
  bracelet: 'cushion',
  earring: 'earringStand',
  pendant: 'pendantStand',
  ring: 'ringCushion',
};

export interface Box2 { x0: number; z0: number; x1: number; z1: number }

export interface DisplaySpec {
  sku: string;
  kind: DisplayKind;
  x: number;
  z: number;
  /** Rotation about y; the display front faces (sin rotY, cos rotY). */
  rotY: number;
  /** Case footprint (width across the front, depth). */
  w: number;
  d: number;
  /** Total case height and the height at which the jewellery sits. */
  h: number;
  itemY: number;
  /** Tall wall vitrine or low freestanding table case. */
  style: 'tall' | 'table';
}

const FACE_EAST = Math.PI / 2; // front faces +x
const FACE_WEST = -Math.PI / 2; // front faces -x
const FACE_STREET = 0; // front faces +z

const TALL = { w: 0.8, d: 0.6, h: 2.05, style: 'tall' as const };
const TABLE = { w: 0.6, d: 0.6, h: 1.2, style: 'table' as const };
const RING = { w: 0.55, d: 0.55, h: 1.2, style: 'table' as const };

/** Every catalogue SKU gets exactly one display (verified by tests). */
export const DISPLAYS: DisplaySpec[] = [
  // LEFT arm: necklace busts in tall vitrines along the outer wall.
  { sku: 'ISH-N01', kind: 'bust', x: -6.9, z: -1.9, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  { sku: 'ISH-N02', kind: 'bust', x: -6.9, z: -3.7, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  { sku: 'ISH-N03', kind: 'bust', x: -6.9, z: -5.5, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  { sku: 'ISH-N04', kind: 'bust', x: -6.9, z: -7.3, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  // LEFT back corner: bracelet cushions in table vitrines.
  { sku: 'ISH-B01', kind: 'cushion', x: -6.2, z: -9.2, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B02', kind: 'cushion', x: -4.2, z: -9.2, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B03', kind: 'cushion', x: -6.2, z: -11.0, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B04', kind: 'cushion', x: -4.2, z: -11.0, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B05', kind: 'cushion', x: -6.2, z: -12.8, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B06', kind: 'cushion', x: -4.2, z: -12.8, rotY: FACE_STREET, ...TABLE, itemY: 0.93 },
  // CENTRE salon: ring cushions either side of the aisle to the cashier.
  { sku: 'ISH-R01', kind: 'ringCushion', x: -2.0, z: -9.2, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R02', kind: 'ringCushion', x: -2.0, z: -10.7, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R03', kind: 'ringCushion', x: -2.0, z: -12.2, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R04', kind: 'ringCushion', x: 2.0, z: -9.2, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R05', kind: 'ringCushion', x: 2.0, z: -10.7, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R06', kind: 'ringCushion', x: 2.0, z: -12.2, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  // RIGHT arm: earring stands in tall vitrines along the outer wall.
  { sku: 'ISH-E01', kind: 'earringStand', x: 6.9, z: -1.9, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E02', kind: 'earringStand', x: 6.9, z: -3.7, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E03', kind: 'earringStand', x: 6.9, z: -5.5, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E04', kind: 'earringStand', x: 6.9, z: -7.3, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  // RIGHT back corner: two earring tables, two pendant stands.
  { sku: 'ISH-E05', kind: 'earringStand', x: 4.2, z: -9.6, rotY: FACE_STREET, ...TABLE, itemY: 0.96 },
  { sku: 'ISH-E06', kind: 'earringStand', x: 6.2, z: -9.6, rotY: FACE_STREET, ...TABLE, itemY: 0.96 },
  { sku: 'ISH-P01', kind: 'pendantStand', x: 4.2, z: -12.0, rotY: FACE_STREET, ...TABLE, h: 1.45, itemY: 1.01 },
  { sku: 'ISH-P02', kind: 'pendantStand', x: 6.2, z: -12.0, rotY: FACE_STREET, ...TABLE, h: 1.45, itemY: 1.01 },
];

