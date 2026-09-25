// Captures still frames of the real-time showroom for the lite (no-WebGL / low-power) experience.
// Usage: start the dev server, then `node scripts/render-lite-backdrops.mjs`.
// Output: public/lite/*.webp
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync('public/lite', { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`${BASE}/?mode=3d&capture=1`);
await page.waitForFunction(() => window.__ishe?.getState().sceneReady, null, { timeout: 240000 });
// Staff stream in after the room; wait so every still (street views included) shows them settled.
await page.waitForFunction(() => window.__isheStaff?.().every((p) => p.loaded), null, { timeout: 120000 }).catch(() => console.warn('staff not loaded'));
await page.waitForTimeout(3000);
// Stills are daylight; the lite showroom adds its own dusk tint for evening (the default).
await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEvening(false); });

const save = async (name) => {
  await page.waitForTimeout(1500);
  const buf = await page.screenshot();
  await sharp(buf).webp({ quality: 78 }).toFile(`public/lite/${name}.webp`);
  console.log('captured', name);
};

for (const p of [0, 0.3, 0.45, 0.6, 0.8]) {
  await page.evaluate((v) => window.__ishe.getState().setEntrance(v), p);
  await save(`entrance-${Math.round(p * 100)}`);
}
await page.evaluate(() => { const s = window.__ishe.getState(); s.setEntrance(1); s.enter(); });
await page.waitForTimeout(800);
for (const node of ['junction', 'left', 'leftBack', 'centre', 'right', 'rightBack']) {
  await page.evaluate((n) => window.__ishe.getState().goTo({ kind: 'node', node: n }), node);
  await save(`room-${node}`);
}
await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'cashier' }));
await save('room-cashier');
await browser.close();
