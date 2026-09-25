import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '@/data/catalogue';
import {
  DISPLAYS, NODES, OBSTACLES, TOURS, collides, displayFootprint, focusPose, nearestClearNode, routeTo, segmentClear,
  staffPose, tourStops, comboPose, type TourId,
} from '@/scene/layout';
import { ARMCHAIRS, FLOOR_MIRRORS, FURNITURE_COLLIDERS, SIDE_TABLE, STAFF, STAFF_ENABLED, THRESHOLDS } from '@/scene/features';
import { decodeBox, encodeBox, shareUrl } from '@/lib/share';
import { appointmentSummary, validateAppointment, whatsappLink } from '@/lib/appointment';
import { submitAppointment } from '@/lib/appointment-server';
import { createCheckout, extrasToCart, validateExtras } from '@/lib/shopify';

const overlap = (a: { x0: number; z0: number; x1: number; z1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('staff and new furniture on the floor plan', () => {
  it('turns staff on and gives the side-room attendants colliders', () => {
    expect(STAFF_ENABLED).toBe(true);
    expect(STAFF.map((s) => s.id).sort()).toEqual(['cashier', 'consultant', 'left', 'right']);
    for (const s of STAFF.filter((p) => p.half > 0)) expect(collides(s.x, s.z, 0.05)).toBe(true);
  });
  it('keeps furniture colliders in the collision map, clear of displays and nav nodes', () => {
    for (const f of FURNITURE_COLLIDERS) {
      expect(OBSTACLES).toContainEqual(f);
      for (const d of DISPLAYS) expect(overlap(f, displayFootprint(d)), d.sku).toBe(false);
    }
    expect(FLOOR_MIRRORS).toHaveLength(8);
    expect(ARMCHAIRS).toHaveLength(2);
    expect(collides(SIDE_TABLE.x, SIDE_TABLE.z, 0.05)).toBe(true);
    for (const n of Object.values(NODES)) expect(collides(n.x, n.z), n.id).toBe(false);
  });
  it('still frames every display and the combos table from free space', () => {
    for (const d of DISPLAYS) {
      const p = focusPose(d.sku);
      expect(collides(p.x, p.z, 0.2), d.sku).toBe(false);
      const n = nearestClearNode(p.x, p.z);
      expect(segmentClear(p.x, p.z, NODES[n].x, NODES[n].z, 0.12), d.sku).toBe(true);
    }
    expect(collides(comboPose().x, comboPose().z, 0.2)).toBe(false);
  });
  it('stands the visitor in free space in front of each member of staff, reachable from the junction', () => {
    for (const s of STAFF) {
      const p = staffPose(s.id);
      expect(collides(p.x, p.z, 0.2), s.id).toBe(false);
      const route = routeTo(NODES.junction.x, NODES.junction.z, p);
      for (let i = 1; i < route.length; i++) expect(segmentClear(route[i - 1].x, route[i - 1].z, route[i].x, route[i].z, 0.12), `${s.id} leg ${i}`).toBe(true);
    }
  });
  it('lays brass thresholds across each doorway', () => {
    expect(THRESHOLDS).toHaveLength(4);
  });
});

describe('guided tours', () => {
  it('visits only matching pieces, each once, for occasion tours', () => {
    for (const id of ['bridal', 'everyday', 'gifting', 'festive'] as TourId[]) {
      const stops = tourStops(id);
      const skus = stops.map((s) => (s.kind === 'product' ? s.sku : ''));
      expect(stops.length, id).toBeGreaterThan(2);
      expect(new Set(skus).size).toBe(skus.length);
      const occ = TOURS[id].occasion!;
      for (const sku of skus) expect(PRODUCTS.find((p) => p.sku === sku)!.occasions).toContain(occ);
      expect(skus.length).toBe(PRODUCTS.filter((p) => p.occasions.includes(occ)).length);
    }
  });
  it('walks every room for "Show me around"', () => {
    const stops = tourStops('around');
    expect(stops.some((s) => s.kind === 'combos')).toBe(true);
    expect(stops.filter((s) => s.kind === 'node').length).toBe(4);
  });
});

describe('Jewel Box share links', () => {
  it('round-trips SKUs and quantities', () => {
    const lines = [{ sku: 'ISH-N01', qty: 2 }, { sku: 'ISH-E02', qty: 1 }];
    expect(encodeBox(lines)).toBe('ISH-N01*2,ISH-E02');
    expect(decodeBox(encodeBox(lines))).toEqual(lines);
    expect(new URL(shareUrl('https://example.com', lines)).searchParams.get('box')).toBe('ISH-N01*2,ISH-E02');
  });
  it('rejects unknown SKUs, clamps quantities and merges duplicates', () => {
    expect(decodeBox('ISH-X99,ish-r01*40,ISH-R01,ISH-B02*0,ISH-B03*abc,<script>')).toEqual([{ sku: 'ISH-R01', qty: 10 }]);
    expect(decodeBox(null)).toEqual([]);
  });
});

describe('appointments', () => {
  const today = new Date('2026-09-25T10:00:00');
  const good = { date: '2026-10-02', slot: '14:00', skus: ['ISH-N01', 'ISH-X99'], name: 'A Visitor', phone: '+91 98765 43210', email: 'a@example.com', notes: 'Bridal' };
  it('validates fields and drops unknown SKUs', () => {
    const v = validateAppointment(good, today);
    expect(v.ok && v.value.skus).toEqual(['ISH-N01']);
    const bad = validateAppointment({ ...good, date: '2026-09-01', slot: '03:00', email: 'nope', phone: '12' }, today);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['date', 'email', 'phone', 'slot']);
  });
  it('builds a WhatsApp link only when a number is configured', () => {
    expect(whatsappLink(undefined, 'hi')).toBeNull();
    expect(whatsappLink('+91 98765-43210', 'Hello there')).toBe('https://wa.me/919876543210?text=Hello%20there');
    expect(appointmentSummary({ ...good, skus: ['ISH-N01'] })).toContain('Kundan Choker Set (ISH-N01)');
  });
  it('stays in demo mode without configuration and never sends anything', async () => {
    const fetchImpl = vi.fn();
    const r = await submitAppointment({ ...good, date: '2099-01-01' }, { env: {} as NodeJS.ProcessEnv, fetchImpl: fetchImpl as unknown as typeof fetch });
    // 2099 is outside the four-month window, so validation fails first.
    expect(r.mode).toBe('invalid');
    const d = new Date(); d.setDate(d.getDate() + 7);
    const date = d.toISOString().slice(0, 10);
    const demo = await submitAppointment({ ...good, date }, { env: {} as NodeJS.ProcessEnv, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(demo.mode).toBe('demo');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('emails the store through Resend when configured, without claiming a confirmed booking', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    const d = new Date(); d.setDate(d.getDate() + 7);
    const r = await submitAppointment({ ...good, date: d.toISOString().slice(0, 10) }, {
      env: { RESEND_API_KEY: 'k', APPOINTMENT_EMAIL_TO: 'store@example.com' } as unknown as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.mode).toBe('received');
    if (r.mode === 'received') expect(r.message).toMatch(/not yet a confirmed appointment/);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['store@example.com'], reply_to: 'a@example.com' });
  });
});

describe('cashier extras', () => {
  it('cleans input and maps to Shopify cart attributes and note', () => {
    const x = validateExtras({ giftWrap: true, giftNote: ' Happy birthday\n', engraving: 'A & R forever and ever and ever and ever' });
    expect(x).toEqual({ giftWrap: true, giftNote: 'Happy birthday', engraving: 'A & R forever and ever and eve' });
    expect(extrasToCart(x)).toEqual({
      attributes: [{ key: 'Gift wrap', value: 'Yes' }, { key: 'Engraving request (to be confirmed by the store)', value: x.engraving }],
      note: 'Gift note: Happy birthday',
    });
    expect(validateExtras(null)).toEqual({ giftWrap: false, giftNote: '', engraving: '' });
  });
  it('sends extras to Shopify only when configured', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { cartCreate: { cart: { checkoutUrl: 'https://shop.example/c/1' }, userErrors: [] } } }), { status: 200 }));
    const env = { SHOPIFY_STORE_DOMAIN: 's.myshopify.com', SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 't', SHOPIFY_VARIANT_MAP: '{"ISH-N01":"gid://shopify/ProductVariant/1"}' } as unknown as NodeJS.ProcessEnv;
    const extras = validateExtras({ giftWrap: true, giftNote: 'For you', engraving: 'AR' });
    await createCheckout([{ sku: 'ISH-N01', quantity: 1 }], { env, fetchImpl: fetchImpl as unknown as typeof fetch, extras });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.variables.input.note).toBe('Gift note: For you');
    expect(body.variables.input.attributes).toContainEqual({ key: 'Gift wrap', value: 'Yes' });
    const demoFetch = vi.fn();
    const r = await createCheckout([{ sku: 'ISH-N01', quantity: 1 }], { env: {} as NodeJS.ProcessEnv, fetchImpl: demoFetch as unknown as typeof fetch, extras });
    expect(r.mode).toBe('demo');
    expect(demoFetch).not.toHaveBeenCalled();
  });
});
