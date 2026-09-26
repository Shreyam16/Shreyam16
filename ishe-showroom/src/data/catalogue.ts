/**
 * ISHÉ sample catalogue: the single source of truth for product data.
 *
 * DEMO DATA NOTICE
 * - Names and SKUs are the 24 supplied by ISHÉ and must stay exactly as written.
 * - `priceINR`, `description`, `occasions` and `pairsWith` are SAMPLE values written for the
 *   showroom demo. Replace them with approved copy and pricing before going live.
 * - Images are sample renders of stylised 3D jewellery made for this demo (`image.isSample`).
 *   They are not photographs of the real pieces.
 * - Do not add metal purity, stone authenticity, warranty or other specifications here unless
 *   ISHÉ has supplied and approved them.
 *
 * Shopify variant IDs live in `shopify-variants.ts`; 3D placement lives in `src/scene/layout.ts`.
 */

export type Category = 'necklace' | 'bracelet' | 'earring' | 'pendant' | 'ring';
export type RoomId = 'left' | 'centre' | 'right';
export type Occasion = 'wedding' | 'festive' | 'everyday' | 'evening' | 'gifting';
/** Visual tone used only to colour the stylised 3D model and sample image. Not a material claim. */
export type Tone = 'gold-tone' | 'silver-tone' | 'rose-tone';

export interface Product {
  sku: string;
  name: string;
  category: Category;
  room: RoomId;
  /** SAMPLE price in Indian rupees, demo only. */
  priceINR: number;
  /** SAMPLE editorial description, demo only. */
  description: string;
  occasions: Occasion[];
  /** SKUs from this catalogue only. */
  pairsWith: string[];
  tone: Tone;
  image: { src: string; alt: string; isSample: true };
}

export interface Combo {
  id: string;
  name: string;
  /** Pairings of existing catalogue SKUs only. */
  skus: [string, string];
  note: string;
}

export const DEMO_DATA = true;

export const CATEGORY_LABEL: Record<Category, string> = {
  necklace: 'Necklaces',
  bracelet: 'Bracelets',
  earring: 'Earrings',
  pendant: 'Pendants',
  ring: 'Rings',
};

export const ROOMS: Record<RoomId, { label: string; direction: 'Left' | 'Straight' | 'Right'; categories: Category[] }> = {
  left: { label: 'Necklaces & Bracelets', direction: 'Left', categories: ['necklace', 'bracelet'] },
  centre: { label: 'Rings & Combos', direction: 'Straight', categories: ['ring'] },
  right: { label: 'Earrings & Pendants', direction: 'Right', categories: ['earring', 'pendant'] },
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  wedding: 'Wedding',
  festive: 'Festive',
  everyday: 'Everyday',
  evening: 'Evening',
  gifting: 'Gifting',
};

const img = (sku: string, name: string) => ({
  src: `/products/${sku.toLowerCase()}.webp`,
  alt: `Sample render of the ${name} (illustrative, not a product photograph)`,
  isSample: true as const,
});

type Draft = Omit<Product, 'image' | 'room'>;

const ROOM_OF: Record<Category, RoomId> = {
  necklace: 'left',
  bracelet: 'left',
  ring: 'centre',
  earring: 'right',
  pendant: 'right',
};

const drafts: Draft[] = [
  // NECKLACES
  { sku: 'ISH-N01', name: 'Kundan Choker Set', category: 'necklace', priceINR: 18900, tone: 'gold-tone',
    description: 'A close-set choker with kundan-style detailing that frames the collarbone. Sample description.',
    occasions: ['wedding', 'festive'], pairsWith: ['ISH-E02', 'ISH-R06', 'ISH-B06'] },
  { sku: 'ISH-N02', name: 'Layered Gold-Tone Necklace', category: 'necklace', priceINR: 7400, tone: 'gold-tone',
    description: 'Three fine strands falling at graduated lengths for easy, stacked movement. Sample description.',
    occasions: ['everyday', 'evening'], pairsWith: ['ISH-E04', 'ISH-B05', 'ISH-R03'] },
  { sku: 'ISH-N03', name: 'Floral Necklace Set', category: 'necklace', priceINR: 12600, tone: 'gold-tone',
    description: 'Petal motifs linked into a soft collar, composed to sit flat and catch light. Sample description.',
    occasions: ['festive', 'wedding', 'gifting'], pairsWith: ['ISH-E03', 'ISH-R01', 'ISH-B03'] },
  { sku: 'ISH-N04', name: 'Minimal Stone Necklace', category: 'necklace', priceINR: 5200, tone: 'silver-tone',
    description: 'A single stone suspended on a fine chain. Quiet enough for every day. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-E06', 'ISH-R05', 'ISH-B04'] },

  // BRACELETS
  { sku: 'ISH-B01', name: 'Adjustable Cuff Bracelet', category: 'bracelet', priceINR: 4800, tone: 'gold-tone',
    description: 'An open cuff with a gentle taper that adjusts to the wrist. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-R03', 'ISH-E04', 'ISH-N02'] },
  { sku: 'ISH-B02', name: 'Pearl Bracelet', category: 'bracelet', priceINR: 5600, tone: 'silver-tone',
    description: 'A single row of rounded pearl-look beads with a neat clasp. Sample description.',
    occasions: ['evening', 'wedding', 'gifting'], pairsWith: ['ISH-E01', 'ISH-R02', 'ISH-P01'] },
  { sku: 'ISH-B03', name: 'Textured Bangle Pair', category: 'bracelet', priceINR: 6900, tone: 'gold-tone',
    description: 'Two bangles with a hand-finished texture, designed to be worn together. Sample description.',
    occasions: ['festive', 'everyday'], pairsWith: ['ISH-R03', 'ISH-E04', 'ISH-N03'] },
  { sku: 'ISH-B04', name: 'Stone Tennis-Style Bracelet', category: 'bracelet', priceINR: 8800, tone: 'silver-tone',
    description: 'A continuous line of set stones on a flexible band. Sample description.',
    occasions: ['evening', 'wedding'], pairsWith: ['ISH-E06', 'ISH-R04', 'ISH-N04'] },
  { sku: 'ISH-B05', name: 'Chain Bracelet', category: 'bracelet', priceINR: 3900, tone: 'gold-tone',
    description: 'Polished links in an easy, everyday weight. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-N02', 'ISH-R05', 'ISH-E04'] },
  { sku: 'ISH-B06', name: 'Festive Bangle Pair', category: 'bracelet', priceINR: 9400, tone: 'gold-tone',
    description: 'A pair of bangles with enamel colour and bright detailing for celebrations. Sample description.',
    occasions: ['festive', 'wedding'], pairsWith: ['ISH-N01', 'ISH-E05', 'ISH-R06'] },

  // EARRINGS
  { sku: 'ISH-E01', name: 'Pearl Drop Earrings', category: 'earring', priceINR: 4200, tone: 'gold-tone',
    description: 'A single pearl-look drop beneath a small hook. Sample description.',
    occasions: ['everyday', 'evening', 'gifting'], pairsWith: ['ISH-P01', 'ISH-B02', 'ISH-R02'] },
  { sku: 'ISH-E02', name: 'Kundan Chandbali Earrings', category: 'earring', priceINR: 9800, tone: 'gold-tone',
    description: 'Crescent chandbalis with kundan-style setting and a beaded fringe. Sample description.',
    occasions: ['wedding', 'festive'], pairsWith: ['ISH-N01', 'ISH-R06', 'ISH-B06'] },
  { sku: 'ISH-E03', name: 'Floral Stud Earrings', category: 'earring', priceINR: 3400, tone: 'rose-tone',
    description: 'Small five-petal studs that sit close to the ear. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-N03', 'ISH-R01', 'ISH-P02'] },
  { sku: 'ISH-E04', name: 'Textured Hoops', category: 'earring', priceINR: 3900, tone: 'gold-tone',
    description: 'Mid-size hoops with a subtle hammered texture. Sample description.',
    occasions: ['everyday', 'evening'], pairsWith: ['ISH-B03', 'ISH-N02', 'ISH-R03'] },
  { sku: 'ISH-E05', name: 'Festive Jhumka Earrings', category: 'earring', priceINR: 7600, tone: 'gold-tone',
    description: 'Bell-shaped jhumkas with a fine beaded edge that moves as you do. Sample description.',
    occasions: ['festive', 'wedding'], pairsWith: ['ISH-B06', 'ISH-P02', 'ISH-R06'] },
  { sku: 'ISH-E06', name: 'Crystal Drop Earrings', category: 'earring', priceINR: 5800, tone: 'silver-tone',
    description: 'Elongated faceted drops for evening light. Sample description.',
    occasions: ['evening', 'gifting'], pairsWith: ['ISH-N04', 'ISH-B04', 'ISH-R04'] },

  // PENDANTS
  { sku: 'ISH-P01', name: 'Pearl Pendant Necklace', category: 'pendant', priceINR: 4600, tone: 'gold-tone',
    description: 'A single pearl-look pendant on a fine chain. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-E01', 'ISH-R02', 'ISH-B02'] },
  { sku: 'ISH-P02', name: 'Occasion Pendant Set', category: 'pendant', priceINR: 8200, tone: 'gold-tone',
    description: 'An ornate pendant on a fine chain, composed as a set for occasions. Sample description.',
    occasions: ['festive', 'wedding', 'evening'], pairsWith: ['ISH-E05', 'ISH-R04', 'ISH-E03'] },

  // RINGS
  { sku: 'ISH-R01', name: 'Floral Adjustable Ring', category: 'ring', priceINR: 2900, tone: 'rose-tone',
    description: 'A floral crown on an adjustable band. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-E03', 'ISH-N03', 'ISH-B01'] },
  { sku: 'ISH-R02', name: 'Pearl Adjustable Ring', category: 'ring', priceINR: 3200, tone: 'gold-tone',
    description: 'A single pearl-look bead on an open, adjustable band. Sample description.',
    occasions: ['everyday', 'evening'], pairsWith: ['ISH-E01', 'ISH-P01', 'ISH-B02'] },
  { sku: 'ISH-R03', name: 'Textured Band Ring', category: 'ring', priceINR: 2600, tone: 'gold-tone',
    description: 'A band with a hand-finished surface that stacks well. Sample description.',
    occasions: ['everyday'], pairsWith: ['ISH-B03', 'ISH-E04', 'ISH-B01'] },
  { sku: 'ISH-R04', name: 'Statement Stone Ring', category: 'ring', priceINR: 6400, tone: 'silver-tone',
    description: 'A bold rectangular stone lifted on a slim setting. Sample description.',
    occasions: ['evening', 'wedding'], pairsWith: ['ISH-E06', 'ISH-B04', 'ISH-P02'] },
  { sku: 'ISH-R05', name: 'Minimal Open Ring', category: 'ring', priceINR: 2200, tone: 'silver-tone',
    description: 'An open band finished with two small spheres. Sample description.',
    occasions: ['everyday', 'gifting'], pairsWith: ['ISH-N04', 'ISH-B05', 'ISH-E03'] },
  { sku: 'ISH-R06', name: 'Kundan Adjustable Ring', category: 'ring', priceINR: 4400, tone: 'gold-tone',
    description: 'A kundan-style cluster on an adjustable band. Sample description.',
    occasions: ['festive', 'wedding'], pairsWith: ['ISH-E02', 'ISH-N01', 'ISH-B06'] },
];

export const PRODUCTS: Product[] = drafts.map((d) => ({ ...d, room: ROOM_OF[d.category], image: img(d.sku, d.name) }));

export const PRODUCT_BY_SKU: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.sku, p]));

/** Curated pairings of existing items, shown on the Combos table in the Rings & Combos salon. */
export const COMBOS: Combo[] = [
  { id: 'combo-bridal', name: 'Bridal Kundan Pairing', skus: ['ISH-N01', 'ISH-E02'], note: 'Choker with chandbalis for ceremony dressing.' },
  { id: 'combo-pearl', name: 'Pearl Pairing', skus: ['ISH-P01', 'ISH-E01'], note: 'Pendant and drops for quiet evenings.' },
  { id: 'combo-stack', name: 'Textured Stack', skus: ['ISH-B03', 'ISH-R03'], note: 'Bangle pair with a matching band.' },
  { id: 'combo-festive', name: 'Festive Pairing', skus: ['ISH-E05', 'ISH-B06'], note: 'Jhumkas and bangles for celebrations.' },
  { id: 'combo-minimal', name: 'Minimal Pairing', skus: ['ISH-N04', 'ISH-R05'], note: 'Single stone and open ring.' },
];

export function getProduct(sku: string): Product | undefined {
  return PRODUCT_BY_SKU[sku];
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function searchProducts(query: string, opts: { category?: Category | 'all'; occasion?: Occasion | 'all' } = {}): Product[] {
  const q = query.trim().toLowerCase();
  return PRODUCTS.filter((p) => {
    if (opts.category && opts.category !== 'all' && p.category !== opts.category) return false;
    if (opts.occasion && opts.occasion !== 'all' && !p.occasions.includes(opts.occasion)) return false;
    if (!q) return true;
    return [p.name, p.sku, CATEGORY_LABEL[p.category], p.description].join(' ').toLowerCase().includes(q);
  });
}
