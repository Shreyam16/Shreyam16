// Exports the live showroom (glTF) and the camera pose of every room stop, for bake/render_stops.py.
//   BASE_URL=http://localhost:3000 CHROMIUM_PATH=... node scripts/export-stops.mjs
// Writes bake/stops/scene.glb and bake/stops/stops.json.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync('bake/stops', { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('page error:', m.text()); });
await page.goto(`${BASE}/?mode=3d&capture=1&quality=standard`);
await page.waitForFunction(() => window.__ishe?.getState().sceneReady, null, { timeout: 240000 });
// Dusk (the default look), inside, every texture and font settled.
await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEvening(true); s.setEntrance(1); s.enter(); });
await page.waitForTimeout(6000);
await page.waitForFunction(() => typeof window.__isheExportStops === 'function', null, { timeout: 30000 });
const out = await page.evaluate(() => window.__isheExportStops());
fs.writeFileSync('bake/stops/scene.glb', Buffer.from(out.glb, 'base64'));
fs.writeFileSync('bake/stops/stops.json', JSON.stringify({ fov: out.fov, stops: out.stops }, null, 2));
console.log(`exported scene.glb (${(fs.statSync('bake/stops/scene.glb').size / 1e6).toFixed(1)} MB) and ${out.stops.length} stops`);
await browser.close();
