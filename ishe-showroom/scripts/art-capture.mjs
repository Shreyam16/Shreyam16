// Art-direction QA: clean frames of the live 3D at the reference film's key moments, desktop (16:9,
// "high" tier) and phone. Writes e2e/output/art-*.png (published to qa-screenshots by CI).
//   BASE_URL=http://localhost:3000 CHROMIUM_PATH=... node scripts/art-capture.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'e2e/output';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function shoot(tag, viewport, quality, moments) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${BASE}/?mode=3d&capture=1&quality=${quality}`);
  await page.waitForFunction(() => window.__ishe?.getState().sceneReady, null, { timeout: 240000 });
  await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEvening(true); });
  await page.waitForTimeout(3000);
  for (const [name, fn, arg] of moments) {
    await page.evaluate(fn, arg);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/art-${tag}-${name}.png` });
    console.log('captured', tag, name);
  }
  await page.close();
}

const entrance = (p) => window.__ishe.getState().setEntrance(p);
const enter = () => { const s = window.__ishe.getState(); s.setEntrance(1); s.enter(); };
const node = (n) => window.__ishe.getState().goTo({ kind: 'node', node: n });
const product = (sku) => window.__ishe.getState().goTo({ kind: 'product', sku });
// Film moments: 0 s street, ~5 s doors opening, ~7 s threshold, ~9-12 s first view down the aisle.
const film = [
  ['1-exterior', entrance, 0],
  ['2-doors', entrance, 0.45],
  ['3-threshold', entrance, 0.8],
  ['4-interior', enter, null],
  ['5-aisle', node, 'centre'],
  ['6-left', node, 'left'],
  ['7-product', product, 'ISH-B03'],
];
await shoot('desk', { width: 1600, height: 900 }, 'high', film);
// What visitors see at dusk outside: the film entrance (interface shown), then the dissolve inside.
async function shootFilm(tag, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${BASE}/?mode=3d`);
  await page.waitForFunction(() => window.__ishe?.getState().sceneReady, null, { timeout: 240000 });
  await page.evaluate(() => window.__ishe.getState().setReducedMotion(true));
  for (const p of [0, 0.2, 0.45, 0.8, 0.97]) {
    await page.evaluate((v) => window.__ishe.getState().setEntrance(v), p);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/art-${tag}-film-${Math.round(p * 100)}.png` });
  }
  await page.close();
}
await shootFilm('desk', { width: 1600, height: 900 });
await shootFilm('phone', { width: 390, height: 844 });
await shoot('phone', { width: 390, height: 844 }, 'standard', [film[0], film[2], film[3], film[5]]);
await browser.close();
