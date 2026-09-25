import { describe, expect, it, vi } from 'vitest';
import { createCheckout, shopifyStatus, validateLines } from '@/lib/shopify';

const ENV = {
  SHOPIFY_STORE_DOMAIN: 'example-store.myshopify.com',
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'test-token',
  SHOPIFY_VARIANT_MAP: JSON.stringify({ 'ISH-N01': 'gid://shopify/ProductVariant/111', 'ISH-E02': 'gid://shopify/ProductVariant/222' }),
} as unknown as NodeJS.ProcessEnv;

describe('checkout', () => {
  it('validates lines against the catalogue', () => {
    expect(validateLines([])).toBeTypeOf('string');
    expect(validateLines([{ sku: 'ISH-X99', quantity: 1 }])).toMatch(/Unknown SKU/);
    expect(validateLines([{ sku: 'ISH-N01', quantity: 0 }])).toMatch(/Invalid quantity/);
    expect(validateLines([{ sku: 'ISH-N01', quantity: 2 }])).toEqual([{ sku: 'ISH-N01', quantity: 2 }]);
  });

  it('stays in demo mode with no configuration and never calls Shopify', async () => {
    const fetchImpl = vi.fn();
    const r = await createCheckout([{ sku: 'ISH-N01', quantity: 1 }], { env: {} as NodeJS.ProcessEnv, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.mode).toBe('demo');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(shopifyStatus({} as NodeJS.ProcessEnv).configured).toBe(false);
  });

  it('stays in demo mode when a SKU has no variant mapping', async () => {
    const fetchImpl = vi.fn();
    const r = await createCheckout([{ sku: 'ISH-R01', quantity: 1 }], { env: ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ mode: 'demo' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates a Shopify cart and returns its checkoutUrl', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.query).toContain('cartCreate');
      expect(body.variables.input.lines).toEqual([
        { merchandiseId: 'gid://shopify/ProductVariant/111', quantity: 1 },
        { merchandiseId: 'gid://shopify/ProductVariant/222', quantity: 2 },
      ]);
      expect((init.headers as Record<string, string>)['Shopify-Storefront-Private-Token']).toBe('test-token');
      return new Response(JSON.stringify({ data: { cartCreate: { cart: { id: 'c1', checkoutUrl: 'https://example-store.myshopify.com/cart/c/abc' }, userErrors: [] } } }), { status: 200 });
    });
    const r = await createCheckout(
      [{ sku: 'ISH-N01', quantity: 1 }, { sku: 'ISH-E02', quantity: 2 }],
      { env: ENV, fetchImpl: fetchImpl as unknown as typeof fetch, buyerIp: '203.0.113.5' },
    );
    expect(r).toEqual({ mode: 'live', checkoutUrl: 'https://example-store.myshopify.com/cart/c/abc' });
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://example-store.myshopify.com/api/2025-10/graphql.json');
  });

  it('surfaces Shopify userErrors instead of pretending success', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { cartCreate: { cart: null, userErrors: [{ message: 'Merchandise not found' }] } } }), { status: 200 }));
    const r = await createCheckout([{ sku: 'ISH-N01', quantity: 1 }], { env: ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ mode: 'error', message: 'Merchandise not found' });
  });
});
