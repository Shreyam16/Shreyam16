import 'server-only';
import { PRODUCT_BY_SKU } from '@/data/catalogue';
import { SHOPIFY_VARIANTS } from '@/data/shopify-variants';

export interface CheckoutLine { sku: string; quantity: number }

/** Cashier extras. Engraving is a request only: the store confirms it before anything is made. */
export interface CheckoutExtras { giftWrap: boolean; giftNote: string; engraving: string }

const oneLine = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

export function validateExtras(input: unknown): CheckoutExtras {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    giftWrap: raw.giftWrap === true,
    giftNote: typeof raw.giftNote === 'string' ? raw.giftNote.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 240) : '',
    engraving: oneLine(raw.engraving, 30),
  };
}

/** Cart attributes and note sent to Shopify (only when Shopify is configured). */
export function extrasToCart(x: CheckoutExtras): { attributes: { key: string; value: string }[]; note?: string } {
  const attributes = [{ key: 'Gift wrap', value: x.giftWrap ? 'Yes' : 'No' }];
  if (x.engraving) attributes.push({ key: 'Engraving request (to be confirmed by the store)', value: x.engraving });
  return { attributes, ...(x.giftNote ? { note: `Gift note: ${x.giftNote}` } : {}) };
}

export type CheckoutResult =
  | { mode: 'live'; checkoutUrl: string }
  | { mode: 'demo'; reason: string }
  | { mode: 'error'; status: number; message: string };

interface ShopifyEnv { domain: string; token: string; version: string; variantOverrides: Record<string, string> }

const GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

export function readShopifyEnv(env: NodeJS.ProcessEnv = process.env): ShopifyEnv | null {
  const domain = (env.SHOPIFY_STORE_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = (env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN ?? '').trim();
  if (!domain || !token) return null;
  let variantOverrides: Record<string, string> = {};
  if (env.SHOPIFY_VARIANT_MAP) {
    try { variantOverrides = JSON.parse(env.SHOPIFY_VARIANT_MAP); } catch { variantOverrides = {}; }
  }
  return { domain, token, version: (env.SHOPIFY_STOREFRONT_API_VERSION ?? '2025-10').trim() || '2025-10', variantOverrides };
}

export function variantFor(sku: string, overrides: Record<string, string> = {}): string | null {
  const v = overrides[sku] ?? SHOPIFY_VARIANTS[sku] ?? null;
  return v && GID.test(v) ? v : null;
}

export function shopifyStatus(env: NodeJS.ProcessEnv = process.env) {
  const cfg = readShopifyEnv(env);
  const mapped = Object.keys(SHOPIFY_VARIANTS).filter((s) => variantFor(s, cfg?.variantOverrides)).length;
  return { configured: Boolean(cfg), mappedVariants: mapped, totalProducts: Object.keys(SHOPIFY_VARIANTS).length };
}

export function validateLines(input: unknown): CheckoutLine[] | string {
  if (!Array.isArray(input) || input.length === 0) return 'Your order is empty.';
  if (input.length > 24) return 'Too many lines.';
  const lines: CheckoutLine[] = [];
  for (const raw of input) {
    const sku = typeof raw?.sku === 'string' ? raw.sku : '';
    const quantity = Number(raw?.quantity);
    if (!PRODUCT_BY_SKU[sku]) return `Unknown SKU: ${sku || '(blank)'}`;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return `Invalid quantity for ${sku}`;
    lines.push({ sku, quantity });
  }
  return lines;
}

const CART_CREATE = `mutation cartCreate($input: CartInput!) {
  cartCreate(input: $input) {
    cart { id checkoutUrl }
    userErrors { field message }
  }
}`;

export async function createCheckout(
  lines: CheckoutLine[],
  opts: { env?: NodeJS.ProcessEnv; buyerIp?: string; fetchImpl?: typeof fetch; extras?: CheckoutExtras } = {},
): Promise<CheckoutResult> {
  const cfg = readShopifyEnv(opts.env);
  if (!cfg) {
    return { mode: 'demo', reason: 'Shopify is not configured for this deployment. No order was created and no payment was taken.' };
  }
  const merch = lines.map((l) => ({ merchandiseId: variantFor(l.sku, cfg.variantOverrides), quantity: l.quantity, sku: l.sku }));
  const missing = merch.filter((m) => !m.merchandiseId).map((m) => m.sku);
  if (missing.length) {
    return { mode: 'demo', reason: `Shopify variants are not mapped yet for ${missing.join(', ')}. No order was created and no payment was taken.` };
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Shopify-Storefront-Private-Token': cfg.token,
  };
  if (opts.buyerIp) headers['Shopify-Storefront-Buyer-IP'] = opts.buyerIp;
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`https://${cfg.domain}/api/${cfg.version}/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: CART_CREATE,
        variables: {
          input: {
            lines: merch.map(({ merchandiseId, quantity }) => ({ merchandiseId, quantity })),
            ...(opts.extras ? extrasToCart(opts.extras) : {}),
          },
        },
      }),
      cache: 'no-store',
    });
  } catch {
    return { mode: 'error', status: 502, message: 'Could not reach Shopify. Please try again.' };
  }
  if (!res.ok) return { mode: 'error', status: 502, message: `Shopify responded with ${res.status}.` };
  const json = (await res.json()) as {
    data?: { cartCreate?: { cart?: { checkoutUrl?: string }; userErrors?: { message: string }[] } };
    errors?: { message: string }[];
  };
  const errs = [...(json.errors ?? []), ...(json.data?.cartCreate?.userErrors ?? [])];
  if (errs.length) return { mode: 'error', status: 502, message: errs.map((e) => e.message).join('; ') };
  const url = json.data?.cartCreate?.cart?.checkoutUrl;
  if (!url || !/^https:\/\//.test(url)) return { mode: 'error', status: 502, message: 'Shopify did not return a checkout URL.' };
  return { mode: 'live', checkoutUrl: url };
}
