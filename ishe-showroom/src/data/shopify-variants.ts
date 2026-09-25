/**
 * SKU -> Shopify ProductVariant GID mapping. Kept apart from the catalogue and the 3D scene.
 *
 * Fill each value with the variant GID from your Shopify admin, e.g.
 *   'ISH-N01': 'gid://shopify/ProductVariant/1234567890'
 * Variant IDs are not secret. The Storefront token is, and it only lives in server env vars.
 * `SHOPIFY_VARIANT_MAP` (JSON) in the environment overrides entries here.
 * `null` means "not mapped": checkout stays in demo mode until every SKU in the order is mapped.
 */
export const SHOPIFY_VARIANTS: Record<string, string | null> = {
  'ISH-N01': null, 'ISH-N02': null, 'ISH-N03': null, 'ISH-N04': null,
  'ISH-B01': null, 'ISH-B02': null, 'ISH-B03': null, 'ISH-B04': null, 'ISH-B05': null, 'ISH-B06': null,
  'ISH-E01': null, 'ISH-E02': null, 'ISH-E03': null, 'ISH-E04': null, 'ISH-E05': null, 'ISH-E06': null,
  'ISH-P01': null, 'ISH-P02': null,
  'ISH-R01': null, 'ISH-R02': null, 'ISH-R03': null, 'ISH-R04': null, 'ISH-R05': null, 'ISH-R06': null,
};
