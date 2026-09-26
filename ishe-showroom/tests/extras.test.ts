import { describe, expect, it } from 'vitest';
import { PRODUCTS, PRODUCT_BY_SKU } from '@/data/catalogue';
import { cleanBatch } from '@/lib/analytics-schema';
import { SEASON_WINDOWS, seasonFor } from '@/lib/season';
import { shareMessage, whatsappShareLink } from '@/lib/share';
import { isTryOnCategory, tryOnTarget } from '@/lib/tryon';

describe('analytics batches', () => {
  it('keeps allowed events and short safe values only', () => {
    const b = cleanBatch({
      session: 'abc123def456', mode: '3d',
      events: [
        { name: 'piece_dwell', t: 1200.4, props: { sku: 'ISH-R01', ms: 3456.78 } },
        { name: 'email_captured', t: 1, props: { email: 'a@b.c' } },
        { name: 'appointment_submit', t: 2, props: { note: 'call me on a@b.c', mode: 'demo', 'bad key': 'x' } },
      ],
    });
    expect(b).not.toBeNull();
    expect(b!.events.map((e) => e.name)).toEqual(['piece_dwell', 'appointment_submit']);
    expect(b!.events[0]).toEqual({ name: 'piece_dwell', t: 1200, props: { sku: 'ISH-R01', ms: 3456.78 } });
    expect(b!.events[1].props).toEqual({ mode: 'demo' });
  });

  it('rejects a batch without a well-formed session', () => {
    expect(cleanBatch({ session: 'Robert', events: [] })).toBeNull();
    expect(cleanBatch(null)).toBeNull();
    expect(cleanBatch({ session: 'abc123def456', events: 'x' })).toBeNull();
  });

  it('caps a batch at 100 events', () => {
    const events = Array.from({ length: 150 }, (_, i) => ({ name: 'room_dwell', t: i }));
    expect(cleanBatch({ session: 'abc123def456', events })!.events).toHaveLength(100);
  });
});

describe('seasonal windows', () => {
  it('picks the season by date', () => {
    expect(seasonFor(new Date(2026, 9, 20))).toBe('festive');
    expect(seasonFor(new Date(2026, 11, 10))).toBe('wedding');
    expect(seasonFor(new Date(2027, 1, 14))).toBe('wedding');
    expect(seasonFor(new Date(2026, 5, 1))).toBe('classic');
  });

  it('honours a valid override and ignores anything else', () => {
    expect(seasonFor(new Date(2026, 5, 1), 'festive')).toBe('festive');
    expect(seasonFor(new Date(2026, 5, 1), 'summer')).toBe('classic');
  });

  it('only shows existing catalogue pieces', () => {
    for (const s of Object.values(SEASON_WINDOWS)) for (const sku of s.skus) expect(PRODUCT_BY_SKU[sku]).toBeDefined();
  });
});

describe('WhatsApp wishlist sharing', () => {
  const lines = [{ sku: 'ISH-N01', qty: 1 }, { sku: 'ISH-R01', qty: 2 }, { sku: 'NOT-A-SKU', qty: 1 }];

  it('lists real pieces and the link, skipping unknown SKUs', () => {
    const m = shareMessage(lines, 'https://example.test/?box=x');
    expect(m).toContain(`${PRODUCT_BY_SKU['ISH-N01'].name} (ISH-N01)`);
    expect(m).toContain('(ISH-R01) × 2');
    expect(m).not.toContain('NOT-A-SKU');
    expect(m.endsWith('https://example.test/?box=x')).toBe(true);
  });

  it('opens a contact picker, not a fixed number', () => {
    const href = whatsappShareLink('Hi & bye');
    expect(href).toBe('https://wa.me/?text=Hi%20%26%20bye');
  });

  it('addresses the store when asked', () => {
    expect(shareMessage(lines, 'u', true).startsWith('Hello ISHÉ')).toBe(true);
  });
});

describe('camera try-on coverage', () => {
  it('tracks the face for ear and neck pieces and a hand for rings and bracelets', () => {
    expect(tryOnTarget('earring')).toBe('face');
    expect(tryOnTarget('pendant')).toBe('face');
    expect(tryOnTarget('ring')).toBe('hand');
    expect(tryOnTarget('bracelet')).toBe('hand');
    expect(PRODUCTS.every((p) => isTryOnCategory(p.category))).toBe(true);
  });
});
