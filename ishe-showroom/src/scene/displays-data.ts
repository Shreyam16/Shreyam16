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
/** Wide, low glass-topped gallery case (the aisle and side-gallery tables). */
const TABLE = { w: 0.9, d: 0.6, h: 1.2, style: 'table' as const };
const RING = { w: 0.55, d: 0.55, h: 1.2, style: 'table' as const };

/**
 * Every catalogue SKU gets exactly one display (verified by tests). Gallery plan: a central aisle
 * lined with low cases, white columns at x = ±2.9, side galleries with tall wall vitrines and a
 * row of cases, and the far end with rings, the combos table and one hero piece on a lit pedestal
 * in front of the black feature wall.
 */
export const DISPLAYS: DisplaySpec[] = [
  // Far end: hero necklace on a lit pedestal, centred on the black feature wall.
  { sku: 'ISH-N01', kind: 'bust', x: 0, z: -12.9, rotY: FACE_STREET, ...TALL, itemY: 1.21 },
  // LEFT side gallery: necklace busts in tall vitrines along the outer wall.
  { sku: 'ISH-N02', kind: 'bust', x: -6.9, z: -3.7, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  { sku: 'ISH-N03', kind: 'bust', x: -6.9, z: -6.3, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  { sku: 'ISH-N04', kind: 'bust', x: -6.9, z: -8.9, rotY: FACE_EAST, ...TALL, itemY: 1.21 },
  // LEFT: bracelets in the aisle cases and along the colonnade, facing the side gallery.
  { sku: 'ISH-B01', kind: 'cushion', x: -1.75, z: -5.0, rotY: FACE_EAST, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B02', kind: 'cushion', x: -1.75, z: -7.6, rotY: FACE_EAST, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B03', kind: 'cushion', x: -3.9, z: -2.6, rotY: FACE_WEST, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B04', kind: 'cushion', x: -3.9, z: -5.0, rotY: FACE_WEST, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B05', kind: 'cushion', x: -3.9, z: -7.6, rotY: FACE_WEST, ...TABLE, itemY: 0.93 },
  { sku: 'ISH-B06', kind: 'cushion', x: -3.9, z: -10.2, rotY: FACE_WEST, ...TABLE, itemY: 0.93 },
  // FAR END: ring cases either side of the aisle, up to the feature wall.
  { sku: 'ISH-R01', kind: 'ringCushion', x: -1.75, z: -10.1, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R02', kind: 'ringCushion', x: -1.75, z: -11.55, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R03', kind: 'ringCushion', x: -1.75, z: -13.0, rotY: FACE_EAST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R04', kind: 'ringCushion', x: 1.75, z: -10.1, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R05', kind: 'ringCushion', x: 1.75, z: -11.55, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  { sku: 'ISH-R06', kind: 'ringCushion', x: 1.75, z: -13.0, rotY: FACE_WEST, ...RING, itemY: 0.9 },
  // RIGHT side gallery: earring stands in tall vitrines along the outer wall.
  { sku: 'ISH-E01', kind: 'earringStand', x: 6.9, z: -3.0, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E02', kind: 'earringStand', x: 6.9, z: -5.3, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E03', kind: 'earringStand', x: 6.9, z: -7.6, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  { sku: 'ISH-E04', kind: 'earringStand', x: 6.9, z: -9.9, rotY: FACE_WEST, ...TALL, itemY: 1.2 },
  // RIGHT: occasion earrings in the aisle cases, pendants along the colonnade.
  { sku: 'ISH-E05', kind: 'earringStand', x: 1.75, z: -5.0, rotY: FACE_WEST, ...TABLE, itemY: 0.96 },
  { sku: 'ISH-E06', kind: 'earringStand', x: 1.75, z: -7.6, rotY: FACE_WEST, ...TABLE, itemY: 0.96 },
  { sku: 'ISH-P01', kind: 'pendantStand', x: 3.9, z: -5.0, rotY: FACE_EAST, ...TABLE, h: 1.45, itemY: 1.01 },
  { sku: 'ISH-P02', kind: 'pendantStand', x: 3.9, z: -7.6, rotY: FACE_EAST, ...TABLE, h: 1.45, itemY: 1.01 },
];
