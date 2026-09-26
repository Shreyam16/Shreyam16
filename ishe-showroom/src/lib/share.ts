import { PRODUCT_BY_SKU } from '@/data/catalogue';

export interface ShareLine { sku: string; qty: number }

/**
 * Jewel Box share links: `?box=ISH-N01*2,ISH-E02` (quantity defaults to 1). Only catalogue SKUs are
 * accepted, quantities are clamped to 1..10 and duplicates merged, so a hand-edited link can never
 * add anything that is not in the showroom.
 */
export function encodeBox(lines: ShareLine[]): string {
  return lines.filter((l) => PRODUCT_BY_SKU[l.sku]).map((l) => (l.qty > 1 ? `${l.sku}*${Math.min(10, l.qty)}` : l.sku)).join(',');
}

export function decodeBox(param: string | null | undefined): ShareLine[] {
  if (!param) return [];
  const out = new Map<string, number>();
  for (const part of param.split(',').slice(0, 24)) {
    const [rawSku, rawQty] = part.trim().split('*');
    const sku = (rawSku ?? '').toUpperCase();
    if (!PRODUCT_BY_SKU[sku]) continue;
    const n = rawQty === undefined ? 1 : Number.parseInt(rawQty, 10);
    if (!Number.isFinite(n) || n < 1) continue;
    out.set(sku, Math.min(10, (out.get(sku) ?? 0) + n));
  }
  return [...out].map(([sku, qty]) => ({ sku, qty }));
}

export function shareUrl(origin: string, lines: ShareLine[]): string {
  const u = new URL('/', origin);
  u.searchParams.set('box', encodeBox(lines));
  return u.toString();
}

/** Message used when sharing a selection on WhatsApp (to anyone, or to the store). */
export function shareMessage(lines: ShareLine[], url: string, toStore = false): string {
  const list = lines.filter((l) => PRODUCT_BY_SKU[l.sku]).map((l) => `• ${PRODUCT_BY_SKU[l.sku].name} (${l.sku})${l.qty > 1 ? ` × ${l.qty}` : ''}`).join('\n');
  return [toStore ? 'Hello ISHÉ, I would like to know more about these pieces:' : 'My ISHÉ Jewel Box:', list, url].join('\n');
}

/** wa.me link that lets the visitor pick any contact (no number needed). */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
