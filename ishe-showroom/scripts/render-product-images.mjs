// Renders the 24 sample product images from the procedural 3D models via the /studio route.
// Usage: start the dev server (npm run dev), then `node scripts/render-product-images.mjs`.
// Output: public/products/<sku>.webp (sample imagery, labelled "SAMPLE RENDER").
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SKUS = ['N01','N02','N03','N04','B01','B02','B03','B04','B05','B06','E01','E02','E03','E04','E05','E06','P01','P02','R01','R02','R03','R04','R05','R06'].map((s) => `ISH-${s}`);

fs.mkdirSync('public/products', { recursive: true });
const browser = await chromium.launch({ executablePath: EXEC, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
for (const sku of SKUS) {
  await page.goto(`${BASE}/studio?sku=${sku}`);
  await page.waitForFunction(() => window.__studioReady === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.locator('#studio').screenshot();
  await sharp(buf).webp({ quality: 84 }).toFile(`public/products/${sku.toLowerCase()}.webp`);
  console.log('rendered', sku);
}
await browser.close();
