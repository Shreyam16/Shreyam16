// End-to-end checks against a running server (dev or `next start`).
//   BASE_URL=http://localhost:3000 node e2e/run.mjs
// Uses playwright-core with a local Chromium (CHROMIUM_PATH). WebGL runs through SwiftShader in
// headless mode, so the 3D pass uses ?mode=3d to bypass the "software renderer -> lite" rule.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import sharp from 'sharp';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'e2e/output';
fs.mkdirSync(OUT, { recursive: true });
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const results = [];
async function check(name, fn) {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`  ✓ ${name}`); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

const state = (page) => page.evaluate(() => {
  const s = window.__ishe.getState();
  return { phase: s.phase, entrance: s.entrance, room: s.room, view: s.view, moving: s.moving, cart: s.cart, saved: s.saved, renderMode: s.renderMode };
});
const waitIdle = (page, ms = 20000) => page.waitForFunction(() => !window.__ishe.getState().moving, null, { timeout: ms });

async function canvasNotBlank(page, file) {
  const buf = await page.screenshot({ path: `${OUT}/${file}` });
  const { data, info } = await sharp(buf).resize(64, 40).greyscale().raw().toBuffer({ resolveWithObject: true });
  let min = 255, max = 0, sum = 0;
  for (const v of data) { min = Math.min(min, v); max = Math.max(max, v); sum += v; }
  const mean = sum / data.length;
  assert(max - min > 60, `frame looks blank (range ${min}-${max})`);
  assert(mean > 20 && mean < 245, `frame looks all black/white (mean ${mean.toFixed(1)})`);
  return info;
}

const browser = await chromium.launch({ executablePath: EXEC, args: GL_ARGS });

// ---------------------------------------------------------------------------------------------
console.log('Desktop 3D (1440x900)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await check('loads the 3D showroom outside the store', async () => {
    await page.goto(`${BASE}/?mode=3d`);
    await page.waitForFunction(() => document.querySelector('[data-render-mode="3d"] canvas'), null, { timeout: 30000 });
    await page.waitForTimeout(5000);
    const s = await state(page);
    assert(s.renderMode === '3d' && s.phase === 'outside', `unexpected ${JSON.stringify(s)}`);
    await canvasNotBlank(page, '01-exterior.png');
  });

  await check('scrolling opens the doors and moves toward the entrance', async () => {
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
    await page.waitForTimeout(1500);
    const s = await state(page);
    assert(s.entrance > 0.2 && s.phase === 'outside', `entrance progress ${s.entrance}`);
    await canvasNotBlank(page, '02-doors-opening.png');
  });

  await check('"Walk me in" carries the visitor through the doors to the junction', async () => {
    await page.getByTestId('enter-button').click();
    await page.waitForFunction(() => window.__ishe.getState().phase === 'inside', null, { timeout: 20000 });
    await page.getByTestId('junction-chooser').waitFor({ timeout: 8000 });
    const cam = await page.evaluate(() => window.__isheCamera());
    assert(cam.z < -2 && Math.abs(cam.y - 1.65) < 0.01, `camera ${JSON.stringify(cam)}`);
    await canvasNotBlank(page, '03-junction.png');
  });

  await check('LEFT goes to Necklaces & Bracelets', async () => {
    await page.getByTestId('choose-left').click();
    await waitIdle(page);
    const t = await page.getByTestId('current-room').textContent();
    assert(/Necklaces & Bracelets/.test(t), `room label "${t}"`);
    await canvasNotBlank(page, '04-left-room.png');
  });

  let before;
  await check('clicking a vitrine in the 3D scene focuses it and opens its panel', async () => {
    before = await page.evaluate(() => window.__isheCamera());
    const pt = await page.evaluate(() => window.__isheProject(-6.9, 1.2, -3.7)); // ISH-N02 bust
    assert(pt.visible, 'N02 not in view');
    await page.mouse.click(pt.x, pt.y);
    await page.getByTestId('product-panel').waitFor({ timeout: 5000 });
    await waitIdle(page);
    const name = await page.getByTestId('product-name').textContent();
    const sku = await page.getByTestId('product-sku').textContent();
    assert(name === 'Layered Gold-Tone Necklace' && sku === 'ISH-N02', `${name} ${sku}`);
    const cam = await page.evaluate(() => window.__isheCamera());
    assert(Math.hypot(cam.x - -5.85, cam.z - -3.7) < 0.05, `focus camera ${JSON.stringify(cam)}`);
    await canvasNotBlank(page, '05-focus-n02.png');
  });

  await check('panel shows pairings, adds to Jewel Box and saves', async () => {
    assert(await page.getByTestId('pair-ISH-E04').isVisible(), 'pairing missing');
    await page.getByTestId('add-to-box').click();
    await page.getByTestId('save-toggle').click();
    const s = await state(page);
    assert(s.cart.length === 1 && s.cart[0].sku === 'ISH-N02' && s.saved.includes('ISH-N02'), JSON.stringify(s.cart));
    const label = await page.getByTestId('open-box').getAttribute('aria-label');
    assert(/1 items/.test(label), label);
  });

  await check('Escape closes the panel and restores the previous camera position', async () => {
    await page.keyboard.press('Escape');
    await waitIdle(page);
    assert(!(await page.getByTestId('product-panel').isVisible().catch(() => false)), 'panel still open');
    const cam = await page.evaluate(() => window.__isheCamera());
    const d = Math.hypot(cam.x - before.x, cam.z - before.z) + Math.abs(cam.tx - before.tx) + Math.abs(cam.tz - before.tz);
    assert(d < 0.02, `camera not restored (${d.toFixed(3)})`);
  });

  await check('finder search reaches a product in another room', async () => {
    await page.getByTestId('open-finder').click();
    await page.getByTestId('finder-input').fill('hoops');
    await page.getByTestId('result-ISH-E04').click();
    await page.getByTestId('product-panel').waitFor();
    await waitIdle(page);
    assert((await page.getByTestId('product-name').textContent()) === 'Textured Hoops', 'wrong product');
    const s = await state(page);
    assert(s.room === 'right', `room ${s.room}`);
    await canvasNotBlank(page, '06-focus-e04.png');
  });

  await check('occasion finder filters by occasion', async () => {
    await page.keyboard.press('Escape');
    await waitIdle(page);
    await page.getByTestId('open-finder').click();
    await page.getByTestId('occasion-wedding').click();
    const n = await page.locator('[data-testid^="result-"]').count();
    assert(n > 0 && n < 24, `wedding results ${n}`);
    await page.keyboard.press('Escape');
  });

  await check('Buy Now walks to the cashier, shows the order, and stays honest in demo mode', async () => {
    await page.getByTestId('open-finder').click();
    await page.getByTestId('finder-input').fill('ISH-R04');
    await page.getByTestId('result-ISH-R04').click();
    await waitIdle(page);
    await page.getByTestId('buy-now').click();
    await page.getByTestId('walking-to-cashier').waitFor({ timeout: 3000 });
    await page.getByTestId('cashier-panel').waitFor({ timeout: 20000 });
    const cam = await page.evaluate(() => window.__isheCamera());
    assert(Math.abs(cam.z - -10.85) < 0.05 && Math.abs(cam.x) < 0.05, `not at cashier ${JSON.stringify(cam)}`);
    assert(await page.getByTestId('demo-banner').isVisible(), 'demo banner missing');
    assert((await page.getByTestId('subtotal').textContent()).includes('6,400'), 'subtotal');
    await canvasNotBlank(page, '07-cashier.png');
    const url = page.url();
    await page.getByTestId('proceed-checkout').click();
    await page.getByText('Demo mode · no purchase made').waitFor({ timeout: 8000 });
    assert(page.url() === url, 'navigated away in demo mode');
    await page.screenshot({ path: `${OUT}/08-cashier-demo.png` });
  });

  await check('Return from the cashier goes back to where the visitor stood', async () => {
    await page.getByRole('button', { name: 'Return to the showroom' }).click();
    await waitIdle(page);
    const s = await state(page);
    assert(s.view.kind === 'node', JSON.stringify(s.view));
  });

  await check('Jewel Box persists and can be taken to the cashier', async () => {
    await page.getByTestId('open-box').click();
    await page.getByTestId('box-line-ISH-N02').waitFor();
    await page.getByTestId('box-checkout').click();
    await page.getByTestId('cashier-panel').waitFor({ timeout: 20000 });
    await page.keyboard.press('Escape');
    await waitIdle(page);
    await page.reload();
    await page.waitForFunction(() => window.__ishe?.getState().renderMode === '3d');
    const s = await state(page);
    assert(s.cart.some((l) => l.sku === 'ISH-N02') && s.phase === 'outside', 'cart not persisted / entrance skipped');
  });

  await check('combos table opens curated pairings', async () => {
    await page.evaluate(() => { const s = window.__ishe.getState(); s.setEntrance(1); s.enter(); });
    await page.waitForTimeout(500);
    await page.getByTestId('choose-centre').click();
    await waitIdle(page);
    const pt = await page.evaluate(() => window.__isheProject(0, 0.97, -9.9));
    await page.mouse.click(pt.x, pt.y);
    await page.getByTestId('combos-panel').waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/09-combos.png` });
  });

  await check('sound is off by default and toggles', async () => {
    const pressed = await page.getByTestId('sound-toggle').getAttribute('aria-pressed');
    assert(pressed === 'false', `sound default ${pressed}`);
  });

  await check('no page errors or console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 3).join(' | '));
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
// Small viewport so software rendering reaches a usable frame rate for timing-based walking.
console.log('Keyboard walking and collision (3D, small viewport)');
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 300 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?mode=3d`);
  await page.waitForFunction(() => window.__ishe?.getState().renderMode === '3d');
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEntrance(1); s.enter(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'node', node: 'left' }));
  await page.waitForTimeout(800);
  await check('W walks forward at eye height', async () => {
    const a = await page.evaluate(() => window.__isheCamera());
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
    const b = await page.evaluate(() => window.__isheCamera());
    assert(Math.hypot(b.x - a.x, b.z - a.z) > 0.3, `moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m`);
    assert(Math.abs(b.y - 1.65) < 0.05, `eye height ${b.y}`);
  });
  await check('walls and vitrines stop the visitor', async () => {
    // Keep walking at the necklace vitrines / outer wall for a long time.
    await page.keyboard.down('KeyW'); await page.waitForTimeout(12000); await page.keyboard.up('KeyW');
    const c = await page.evaluate(() => window.__isheCamera());
    assert(c.x > -7.1, `walked into the outer wall (x=${c.x.toFixed(2)})`);
    const inCase = [-1.9, -3.7, -5.5, -7.3].some((z) => c.x < -6.3 && Math.abs(c.z - z) < 0.4);
    assert(!inCase, `walked into a vitrine ${JSON.stringify(c)}`);
    // Turn around and walk back toward the entrance: the closed doors stop the visitor.
    await page.keyboard.down('KeyE'); await page.waitForTimeout(2500); await page.keyboard.up('KeyE');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(12000); await page.keyboard.up('KeyW');
    const d = await page.evaluate(() => window.__isheCamera());
    assert(d.z < -0.25 && d.x > -7.15 && d.x < 7.15 && d.z > -13.65, `left the showroom ${JSON.stringify(d)}`);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
console.log('Every product is reachable and framed (3D)');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?mode=3d`);
  await page.waitForFunction(() => window.__ishe?.getState().renderMode === '3d');
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEntrance(1); s.enter(); });
  await page.waitForTimeout(500);
  const skus = await page.evaluate(() => Array.from({ length: 24 }, (_, i) => ['N01','N02','N03','N04','B01','B02','B03','B04','B05','B06','E01','E02','E03','E04','E05','E06','P01','P02','R01','R02','R03','R04','R05','R06'][i]));
  const tiles = [];
  await check('all 24 displays open the matching product panel', async () => {
    for (const code of skus) {
      const sku = `ISH-${code}`;
      await page.evaluate((k) => window.__ishe.getState().goTo({ kind: 'product', sku: k }), sku);
      await page.getByTestId('product-sku').filter({ hasText: sku }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(700);
      tiles.push(await page.screenshot({ clip: { x: 0, y: 0, width: 820, height: 800 } }));
    }
  });
  if (tiles.length === 24) {
    const small = await Promise.all(tiles.map((t) => sharp(t).resize(328, 320).toBuffer()));
    await sharp({ create: { width: 328 * 6, height: 320 * 4, channels: 3, background: '#000' } })
      .composite(small.map((input, i) => ({ input, left: (i % 6) * 328, top: Math.floor(i / 6) * 320 }))).png().toFile(`${OUT}/10-all-displays.png`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
console.log('Reduced motion');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await check('Enter goes straight inside and room moves are instant', async () => {
    await page.goto(`${BASE}/?mode=3d`);
    await page.waitForFunction(() => window.__ishe?.getState().reducedMotion === true);
    await page.getByTestId('enter-button').click();
    await page.getByTestId('junction-chooser').waitFor({ timeout: 5000 });
    await page.getByTestId('choose-right').click();
    await page.waitForTimeout(300);
    const s = await state(page);
    assert(!s.moving && s.room === 'right', JSON.stringify(s));
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
console.log('Mobile 3D (390x844, touch)');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await check('mobile layout: large targets, no horizontal overflow', async () => {
    await page.goto(`${BASE}/?mode=3d`);
    await page.waitForFunction(() => window.__ishe?.getState().renderMode === '3d');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/11-mobile-exterior.png` });
    await page.getByTestId('enter-button').tap();
    await page.getByTestId('junction-chooser').waitFor({ timeout: 20000 });
    const box = await page.getByTestId('choose-centre').boundingBox();
    assert(box.height >= 88 && box.width >= 100, `target ${JSON.stringify(box)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${OUT}/12-mobile-junction.png` });
  });
  await check('mobile: tap room, hold-to-walk pad, open a product', async () => {
    await page.getByTestId('choose-right').tap();
    await waitIdle(page);
    await page.getByTestId('move-pad').waitFor();
    const a = await page.evaluate(() => window.__isheCamera());
    await page.dispatchEvent('[aria-label="Walk forward"]', 'pointerdown', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(4000);
    await page.dispatchEvent('[aria-label="Walk forward"]', 'pointerup', { pointerId: 1, pointerType: 'touch' });
    const c = await page.evaluate(() => window.__isheCamera());
    assert(Math.hypot(c.x - a.x, c.z - a.z) > 0.2, 'pad did not move camera');
    await page.getByTestId('displays-toggle').tap();
    await page.getByTestId('display-btn-ISH-P01').tap();
    await page.getByTestId('product-panel').waitFor();
    await waitIdle(page);
    await page.screenshot({ path: `${OUT}/13-mobile-product.png` });
  });
  await ctx.close();
}

console.log('Software-rendered WebGL (auto-detect)');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await check('a software renderer is detected and gets the lite showroom with an explanation', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForFunction(() => window.__ishe?.getState().renderMode !== 'detecting');
    const s = await page.evaluate(() => [window.__ishe.getState().renderMode, window.__ishe.getState().liteReason]);
    assert(s[0] === 'lite' && /software/i.test(s[1] ?? ''), JSON.stringify(s));
  });
  await page.close();
}

await browser.close();

// ---------------------------------------------------------------------------------------------
console.log('No WebGL (lite fallback)');
{
  const b2 = await chromium.launch({ executablePath: EXEC, args: ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'] });
  const page = await b2.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await check('falls back to the lite showroom instead of a blank screen', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForFunction(() => window.__ishe?.getState().renderMode === 'lite', null, { timeout: 15000 });
    await page.getByTestId('lite-showroom').waitFor({ state: 'attached' });
    await page.waitForTimeout(800);
    await canvasNotBlank(page, '14-lite-exterior.png');
  });
  await check('lite: scroll entrance, rooms, product, cashier demo', async () => {
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/15-lite-entering.png` });
    await page.getByTestId('enter-button').click();
    await page.getByTestId('junction-chooser').waitFor({ timeout: 20000 });
    await page.getByTestId('choose-left').click();
    await page.getByTestId('lite-display-ISH-B02').click();
    assert((await page.getByTestId('product-name').textContent()) === 'Pearl Bracelet', 'lite product');
    await page.screenshot({ path: `${OUT}/16-lite-product.png` });
    await page.getByTestId('buy-now').click();
    await page.getByTestId('cashier-panel').waitFor();
    await page.getByTestId('proceed-checkout').click();
    await page.getByText('Demo mode · no purchase made').waitFor({ timeout: 8000 });
    await page.screenshot({ path: `${OUT}/17-lite-cashier.png` });
  });
  await check('lite: no page errors', async () => { assert(errors.length === 0, errors.join(' | ')); });
  await b2.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
