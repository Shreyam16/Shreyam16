import { describe, expect, it } from 'vitest';
import { COMBOS, PRODUCTS, PRODUCT_BY_SKU, searchProducts } from '@/data/catalogue';
import { SHOPIFY_VARIANTS } from '@/data/shopify-variants';

const EXPECTED: [string, string][] = [
  ['ISH-N01', 'Kundan Choker Set'], ['ISH-N02', 'Layered Gold-Tone Necklace'], ['ISH-N03', 'Floral Necklace Set'], ['ISH-N04', 'Minimal Stone Necklace'],
  ['ISH-B01', 'Adjustable Cuff Bracelet'], ['ISH-B02', 'Pearl Bracelet'], ['ISH-B03', 'Textured Bangle Pair'], ['ISH-B04', 'Stone Tennis-Style Bracelet'],
  ['ISH-B05', 'Chain Bracelet'], ['ISH-B06', 'Festive Bangle Pair'],
  ['ISH-E01', 'Pearl Drop Earrings'], ['ISH-E02', 'Kundan Chandbali Earrings'], ['ISH-E03', 'Floral Stud Earrings'], ['ISH-E04', 'Textured Hoops'],
  ['ISH-E05', 'Festive Jhumka Earrings'], ['ISH-E06', 'Crystal Drop Earrings'],
  ['ISH-P01', 'Pearl Pendant Necklace'], ['ISH-P02', 'Occasion Pendant Set'],
  ['ISH-R01', 'Floral Adjustable Ring'], ['ISH-R02', 'Pearl Adjustable Ring'], ['ISH-R03', 'Textured Band Ring'], ['ISH-R04', 'Statement Stone Ring'],
  ['ISH-R05', 'Minimal Open Ring'], ['ISH-R06', 'Kundan Adjustable Ring'],
];

describe('catalogue', () => {
  it('has exactly the 24 supplied products with exact names and SKUs', () => {
    expect(PRODUCTS.map((p) => [p.sku, p.name])).toEqual(EXPECTED);
  });
  it('has no duplicate SKUs', () => {
    expect(new Set(PRODUCTS.map((p) => p.sku)).size).toBe(24);
  });
  it('only pairs and combines existing SKUs, never with itself', () => {
    for (const p of PRODUCTS) for (const s of p.pairsWith) { expect(PRODUCT_BY_SKU[s]).toBeDefined(); expect(s).not.toBe(p.sku); }
    for (const c of COMBOS) for (const s of c.skus) expect(PRODUCT_BY_SKU[s]).toBeDefined();
  });
  it('routes categories to the right rooms', () => {
    for (const p of PRODUCTS) {
      const expected = { necklace: 'left', bracelet: 'left', ring: 'centre', earring: 'right', pendant: 'right' }[p.category];
      expect(p.room).toBe(expected);
    }
  });
  it('marks every image as sample imagery', () => {
    for (const p of PRODUCTS) expect(p.image.isSample).toBe(true);
  });
  it('makes no purity / authenticity / warranty claims in copy', () => {
    const banned = /\b(\d{2}k|karat|carat|hallmark|genuine|real (gold|diamond|pearl)|certified|warranty|guarantee|sterling|925|diamond)\b/i;
    for (const p of PRODUCTS) expect(p.description).not.toMatch(banned);
  });
  it('has a Shopify mapping slot for every SKU and nothing else', () => {
    expect(Object.keys(SHOPIFY_VARIANTS).sort()).toEqual(PRODUCTS.map((p) => p.sku).sort());
  });
  it('searches by name, SKU and occasion', () => {
    expect(searchProducts('hoops').map((p) => p.sku)).toEqual(['ISH-E04']);
    expect(searchProducts('ish-r0').length).toBe(6);
    expect(searchProducts('', { occasion: 'wedding' }).every((p) => p.occasions.includes('wedding'))).toBe(true);
  });
});
