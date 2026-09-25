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
// A fake camera exists, but camera permission is never granted: exercises the "refused" path.
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream'];

const results = [];
async function check(name, fn, limitMs = 300000) {
  const t = Date.now();
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`check timed out after ${limitMs / 1000}s`)), limitMs); });
  try { await Promise.race([fn(), limit]); clearTimeout(timer); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`  ✓ ${name}`); }
  catch (e) { clearTimeout(timer); results.push({ name, ok: false, err: e.message }); console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }
// Keep partial results if a section's setup throws outside a check.
process.on('uncaughtException', (e) => {
  results.push({ name: 'uncaught error', ok: false, err: e.message });
  console.log(`  ✗ uncaught error\n      ${e.message.split('\n')[0]}`);
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, metrics: globalThis.__metrics }, null, 2));
  process.exit(1);
});

const state = (page) => page.evaluate(() => {
  const s = window.__ishe.getState();
  return { phase: s.phase, entrance: s.entrance, room: s.room, view: s.view, moving: s.moving, cart: s.cart, saved: s.saved, renderMode: s.renderMode };
});
const waitIdle = (page, ms = 20000) => page.waitForFunction(() => !window.__ishe.getState().moving, null, { timeout: ms });
/** The branded loader covers the page until the first frame is on screen. */
// Cold loads compile every shader in software (SwiftShader), which can take minutes on CI.
const waitReady = async (page, ms = 240000) => {
  await page.waitForFunction(() => window.__ishe?.getState().sceneReady, null, { timeout: ms });
  await page.getByTestId('loading-screen').waitFor({ state: 'detached', timeout: 60000 });
};
const enterNow = (page) => page.evaluate(() => { const s = window.__ishe.getState(); s.setEntrance(1); s.enter(); });
const metrics = {};
globalThis.__metrics = metrics;

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

  await check('branded loading screen shows the plaque and real progress, then fades into the street', async () => {
    await page.goto(`${BASE}/?mode=3d`);
    await page.getByTestId('loading-screen').waitFor({ timeout: 10000 });
    assert(await page.getByTestId('loading-screen').locator('img[alt="ISHÉ"]').isVisible(), 'plaque missing');
    await page.screenshot({ path: `${OUT}/00-loading.png` });
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const v = await page.getByTestId('loading-progress').getAttribute('aria-valuenow').catch(() => null);
      if (v === null) break;
      seen.add(Number(v));
      if (await page.evaluate(() => window.__ishe?.getState().sceneReady)) break;
      await page.waitForTimeout(100);
    }
    await waitReady(page);
    metrics.coldLoadMs = Date.now() - t0;
    const s = await page.evaluate(() => ({ p: window.__ishe.getState().loadProgress, phase: window.__ishe.getState().phase }));
    metrics.loadingProgressSeen = [...seen].sort((a, b) => a - b);
    assert(s.p === 1 && s.phase === 'outside', JSON.stringify(s));
  });

  await check('loads the 3D showroom outside the store', async () => {
    await page.waitForFunction(() => document.querySelector('[data-render-mode="3d"] canvas'), null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    const s = await state(page);
    assert(s.renderMode === '3d' && s.phase === 'outside', `unexpected ${JSON.stringify(s)}`);
    await canvasNotBlank(page, '01-exterior.png');
    metrics.drawCallsOutside = await page.evaluate(() => window.__isheRenderInfo());
  });

  await check('seasonal shop windows are dressed for the current season', async () => {
    const season = await page.waitForFunction(() => document.querySelector('[data-testid="showroom-canvas"]')?.dataset.season, null, { timeout: 30000 }).then((h) => h.jsonValue());
    const expected = await page.evaluate(() => { const d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate(); return md >= 920 && md <= 1120 ? 'festive' : md >= 1121 || md <= 228 ? 'wedding' : 'classic'; });
    assert(season === expected, `season ${season}, expected ${expected}`);
    metrics.season = season;
    await page.evaluate(() => window.__ishe.getState().setEntrance(0.35));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/01b-windows-${season}.png` });
    await page.evaluate(() => window.__ishe.getState().setEntrance(0));
  });

  await check('evening toggle: opens at dusk, switches to day and back', async () => {
    const pressed = await page.getByTestId('evening-toggle').getAttribute('aria-pressed');
    assert(pressed === 'true', `evening default ${pressed}`);
    await page.waitForFunction(() => document.querySelector('[data-testid="showroom-canvas"]')?.dataset.evening === 'on', null, { timeout: 15000 });
    await canvasNotBlank(page, '01b-exterior-evening.png');
    await page.getByTestId('evening-toggle').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="showroom-canvas"]')?.dataset.evening === 'off', null, { timeout: 15000 });
    await canvasNotBlank(page, '01c-exterior-day.png');
    metrics.drawCallsOutsideEvening = await page.evaluate(() => window.__isheRenderInfo());
    await page.getByTestId('evening-toggle').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="showroom-canvas"]')?.dataset.evening === 'on', null, { timeout: 15000 });
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
    metrics.drawCallsJunction = await page.evaluate(() => window.__isheRenderInfo());
  });

  await check('LEFT goes to Necklaces & Bracelets', async () => {
    await page.getByTestId('choose-left').click();
    await waitIdle(page);
    const t = await page.getByTestId('current-room').textContent();
    assert(/Necklaces & Bracelets/.test(t), `room label "${t}"`);
    await canvasNotBlank(page, '04-left-room.png');
    metrics.drawCallsLeftRoom = await page.evaluate(() => window.__isheRenderInfo());
  });

  await check('staff: all four load at human scale with feet on the floor, idle animation playing', async () => {
    await page.waitForFunction(() => window.__isheStaff?.().every((p) => p.loaded), null, { timeout: 90000 });
    const a = await page.evaluate(() => window.__isheStaff());
    // Software GL can stall for seconds while the skinned shaders compile: wait for the clock to
    // move (i.e. frames to render), then give the idle a moment before comparing poses.
    await page.waitForFunction((t) => window.__isheStaff().every((p) => p.animTime > t + 0.5), a[0].animTime, { timeout: 120000 });
    const b = await page.evaluate(() => window.__isheStaff());
    metrics.staff = b;
    // Within 40° of the spot's direction: the idle keeps some natural sway (it was ~90° before stabilising).
    for (const p of b) assert(Math.abs(p.facingErrDeg) < 40, `${p.id} faces ${p.facingErrDeg}° off its spot`);
    for (const p of b) assert(p.hips[2] < -0.5 && Math.abs(p.hips[0]) < 7.3, `${p.id} hips outside the shop ${p.hips}`);
    for (const p of a) {
      assert(p.head[1] > 1.35 && p.head[1] < 1.8, `${p.id} head at ${p.head[1]}`);
      assert(p.toe[1] > -0.05 && p.toe[1] < 0.2, `${p.id} toe at ${p.toe[1]}`);
    }
    // The idle clip is advancing and actually moves the skeleton.
    const still = a.filter((p, i) => !(b[i].animTime !== p.animTime && [...p.spine, ...p.hips, ...p.headQuat].some((v, k) => Math.abs(v - [...b[i].spine, ...b[i].hips, ...b[i].headQuat][k]) > 1e-5)));
    assert(still.length === 0, `idle not playing for ${still.map((p) => p.id)} ${JSON.stringify(still)}`);
  });

  await check('staff: clicking the attendant opens her greeting, and she looks at the visitor while talking', async () => {
    const pt = await page.evaluate(() => window.__isheProject(-4.2, 1.1, -12.0));
    assert(pt.visible, 'attendant not in view');
    await page.mouse.click(pt.x, pt.y);
    await page.getByTestId('staff-panel').waitFor({ timeout: 8000 });
    await waitIdle(page);
    assert((await page.getByTestId('staff-greeting').textContent()).includes('Welcome'), 'greeting');
    // Engaged: she turns toward the visitor (the camera stands slightly off her resting direction).
    await page.waitForTimeout(3000);
    const left = (await page.evaluate(() => window.__isheStaff())).find((p) => p.id === 'left');
    metrics.leftAttendantTurn = { headYaw: left.headYaw, bodyYaw: left.bodyYaw };
    await canvasNotBlank(page, '04b-attendant-left.png');
    await page.keyboard.press('Escape');
    await waitIdle(page);
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

  await check('guided tour: keyboard opens the attendant, Bridal walks the vitrines with Next / Stop', async () => {
    await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'node', node: 'left' }));
    await waitIdle(page);
    await page.getByTestId('talk-staff').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('staff-panel').waitFor({ timeout: 10000 });
    await waitIdle(page);
    await page.getByTestId('tour-bridal').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('tour-bar').waitFor();
    await waitIdle(page);
    const first = await page.evaluate(() => window.__ishe.getState().view);
    const total = await page.evaluate(() => window.__ishe.getState().tour.stops.length);
    assert(first.kind === 'product' && first.sku === 'ISH-N01', JSON.stringify(first));
    assert((await page.getByTestId('tour-progress').textContent()) === `1 of ${total}`, 'progress');
    await page.getByTestId('tour-next').focus();
    await page.keyboard.press('Enter');
    await waitIdle(page);
    const second = await page.evaluate(() => window.__ishe.getState().view);
    assert(second.kind === 'product' && second.sku !== 'ISH-N01', JSON.stringify(second));
    await page.getByTestId('product-panel').waitFor();
    await canvasNotBlank(page, '06b-tour-bridal.png');
    await page.getByTestId('tour-stop').click();
    await waitIdle(page);
    const s = await state(page);
    assert(s.view.kind === 'node' && !(await page.getByTestId('tour-bar').isVisible().catch(() => false)), JSON.stringify(s.view));
    metrics.bridalTourStops = total;
  });

  await check('appointment form: field errors, then honest demo mode (nothing sent or booked)', async () => {
    await page.getByTestId('open-appointment').click();
    await page.getByTestId('appointment-demo-banner').waitFor({ timeout: 8000 });
    assert(await page.getByTestId('whatsapp-unconfigured').isVisible(), 'WhatsApp should say not configured');
    await page.getByTestId('appt-submit').click();
    await page.getByText('Please check the highlighted fields.').waitFor();
    assert(await page.getByTestId('appt-name').getAttribute('aria-invalid') === 'true', 'name not flagged');
    const d = new Date(); d.setDate(d.getDate() + 5);
    await page.getByTestId('appt-date').fill(d.toISOString().slice(0, 10));
    await page.locator('[data-testid="appt-slot-14:00"]').check({ force: true });
    await page.getByTestId('appt-name').fill('Test Visitor');
    await page.getByTestId('appt-phone').fill('+91 98765 43210');
    await page.getByTestId('appt-email').fill('visitor@example.com');
    await page.getByTestId('appt-submit').click();
    await page.getByText('Demo mode · not sent, not booked').waitFor({ timeout: 8000 });
    assert(!(await page.getByText(/confirmed appointment|booking confirmed/i).isVisible().catch(() => false)), 'claimed a confirmation');
    await page.screenshot({ path: `${OUT}/06c-appointment-demo.png` });
    await page.keyboard.press('Escape');
  });

  await check('try-on: camera permission refused shows a clear fallback and loads nothing', async () => {
    const cdn = [];
    page.on('request', (r) => { if (/jsdelivr|mediapipe|storage\.googleapis/.test(r.url())) cdn.push(r.url()); });
    await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'product', sku: 'ISH-E02' }));
    await waitIdle(page);
    await page.getByTestId('try-on-open').click();
    await page.getByTestId('try-on').waitFor();
    assert(await page.getByTestId('try-on-scale-note').isVisible(), 'scale note missing');
    await page.getByTestId('try-on-start').click();
    await page.getByTestId('try-on-fallback').waitFor({ timeout: 10000 });
    const st = await page.getByTestId('try-on-status').getAttribute('data-status');
    assert(st === 'denied' || st === 'unavailable', `status ${st}`);
    assert(cdn.length === 0, `fetched ${cdn[0]}`);
    metrics.tryOnDeniedStatus = st;
    await page.screenshot({ path: `${OUT}/06d-try-on-denied.png` });
    await page.getByRole('button', { name: 'Back to the piece' }).click();
    await page.getByTestId('product-panel').waitFor();
    await page.keyboard.press('Escape');
    await waitIdle(page);
  });

  await check('try-on: rings use hand tracking, and a refused camera still falls back cleanly', async () => {
    const cdn = [];
    page.on('request', (r) => { if (/jsdelivr|mediapipe|storage\.googleapis/.test(r.url())) cdn.push(r.url()); });
    await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'product', sku: 'ISH-R01' }));
    await waitIdle(page);
    await page.getByTestId('try-on-open').click();
    await page.getByTestId('try-on').waitFor();
    const target = await page.getByTestId('try-on-canvas').getAttribute('data-target');
    assert(target === 'hand', `target ${target}`);
    await page.getByTestId('try-on-start').click();
    await page.getByTestId('try-on-fallback').waitFor({ timeout: 10000 });
    assert(cdn.length === 0, `fetched ${cdn[0]}`);
    await page.screenshot({ path: `${OUT}/06e-try-on-ring-denied.png` });
    await page.getByRole('button', { name: 'Back to the piece' }).click();
    await page.getByTestId('product-panel').waitFor();
    await page.keyboard.press('Escape');
    await waitIdle(page);
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
    metrics.drawCallsCashier = await page.evaluate(() => window.__isheRenderInfo());
    assert((await page.getByTestId('cashier-greeting').textContent()).includes('Welcome to the counter'), 'cashier greeting');
    await page.getByTestId('gift-wrap').check();
    await page.getByTestId('gift-note').fill('Happy anniversary');
    await page.getByTestId('engraving').fill('A & R');
    assert((await page.getByTestId('ring-size-link').getAttribute('href')) === '/ring-size-guide', 'ring guide link');
    const url = page.url();
    await page.getByTestId('proceed-checkout').click();
    await page.getByText('Demo mode · no purchase made').waitFor({ timeout: 8000 });
    assert(page.url() === url, 'navigated away in demo mode');
    const extras = await page.getByTestId('demo-extras').textContent();
    assert(/Yes/.test(extras) && /Happy anniversary/.test(extras) && /A & R/.test(extras) && /confirmed by the store/.test(extras), extras);
    // Demo counter ceremony: terminal (nothing charged) → wrapping → hand-over → sample receipt.
    await page.getByTestId('ceremony').waitFor();
    assert((await page.getByTestId('ceremony').getAttribute('data-stage')) === 'terminal', 'ceremony should start at the terminal');
    await canvasNotBlank(page, '08a-counter-terminal.png');
    await page.getByTestId('terminal-pay').click();
    await page.getByTestId('receipt').waitFor({ timeout: 20000 });
    const receipt = await page.getByTestId('receipt').textContent();
    assert(/Sample receipt/i.test(receipt) && /No payment was taken/.test(receipt) && /not a tax invoice/.test(receipt), receipt);
    assert(/Happy anniversary/.test(receipt) && /Statement Stone Ring/.test(receipt) && /SAMPLE-/.test(receipt), receipt);
    await page.waitForTimeout(1500);
    await canvasNotBlank(page, '08b-counter-receipt.png');
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

  await check('share link: encodes the Jewel Box and shows "Shared selection" only after the entrance', async () => {
    await waitReady(page);
    await page.evaluate(() => { const s = window.__ishe.getState(); s.addToCart('ISH-E02', 2); });
    await page.getByTestId('open-box').click();
    await page.getByTestId('box-share').click();
    const link = await page.getByTestId('share-link').inputValue();
    const box = new URL(link).searchParams.get('box');
    assert(/ISH-N02/.test(box) && /ISH-E02\*2/.test(box), `box=${box}`);
    // WhatsApp: a contact-picker link with the list and the share link; the store button is honest when unset.
    const wa = await page.getByTestId('box-whatsapp-share').getAttribute('href');
    const text = decodeURIComponent(new URL(wa).searchParams.get('text') ?? '');
    assert(wa.startsWith('https://wa.me/?text='), `wa ${wa}`);
    assert(text.includes('(ISH-E02) × 2') && text.includes(link), `text ${text}`);
    const storeSet = await page.getByTestId('box-whatsapp-store').count();
    assert(storeSet || await page.getByTestId('box-whatsapp-store-unconfigured').isVisible(), 'store WhatsApp state missing');
    await page.screenshot({ path: `${OUT}/08a-box-share.png` });
    await page.keyboard.press('Escape');
    // Software WebGL: park this page so it does not starve the new context's first load.
    await page.goto('about:blank');
    const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
    const p2 = await other.newPage();
    await p2.goto(`${link}&mode=3d`);
    await waitReady(p2);
    assert(!(await p2.getByTestId('shared-panel').isVisible().catch(() => false)), 'shared panel shown before entering');
    assert((await p2.evaluate(() => window.__ishe.getState().cart.length)) === 0, 'cart changed without consent');
    await p2.getByTestId('enter-button').click();
    await p2.getByTestId('shared-panel').waitFor({ timeout: 30000 });
    assert(await p2.getByTestId('shared-ISH-E02').isVisible(), 'E02 missing');
    await p2.screenshot({ path: `${OUT}/08b-shared-selection.png` });
    await p2.getByTestId('shared-add').click();
    const cart = await p2.evaluate(() => window.__ishe.getState().cart);
    assert(cart.some((l) => l.sku === 'ISH-E02' && l.qty === 2), JSON.stringify(cart));
    } finally { await other.close(); }
  });

  await check('ring size guide page is printable and labelled approximate', async () => {
    const p3 = await ctx.newPage();
    try {
      await p3.goto(`${BASE}/ring-size-guide`);
      await p3.getByText('Approximate · for guidance only').waitFor();
      assert((await p3.locator('tbody tr').count()) >= 15, 'rows');
    } finally { await p3.close(); }
  });

  await check('combos table opens curated pairings', async () => {
    await page.goto(`${BASE}/?mode=3d`);
    await waitReady(page);
    await page.evaluate(() => { const s = window.__ishe.getState(); s.setEntrance(1); s.enter(); });
    await page.waitForTimeout(500);
    await page.getByTestId('choose-centre').click();
    await waitIdle(page);
    const pt = await page.evaluate(() => window.__isheProject(0, 0.97, -10.4));
    await page.mouse.click(pt.x, pt.y);
    await page.getByTestId('combos-panel').waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/09-combos.png` });
  });

  await check('sound is off by default and toggles', async () => {
    const pressed = await page.getByTestId('sound-toggle').getAttribute('aria-pressed');
    assert(pressed === 'false', `sound default ${pressed}`);
  });

  await check('staff voice: silent with sound off, greets and introduces a tour with sound on', async () => {
    const voiceReq = [];
    page.on('request', (r) => { if (r.url().includes('/voice/')) voiceReq.push(r.url()); });
    await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'staff', id: 'right' }));
    await page.getByTestId('staff-panel').waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    assert((await page.evaluate(() => window.__isheVoiceLog.length)) === 0 && voiceReq.length === 0, 'spoke with sound off');
    await page.keyboard.press('Escape');
    await waitIdle(page);
    await page.getByTestId('sound-toggle').click();
    assert((await page.getByTestId('sound-toggle').getAttribute('aria-pressed')) === 'true', 'sound did not turn on');
    const greet = page.waitForResponse((r) => r.url().endsWith('/voice/greet-attendant.wav'), { timeout: 30000 });
    await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'staff', id: 'right' }));
    await page.getByTestId('staff-panel').waitFor({ timeout: 30000 });
    const res = await greet;
    assert(res.status() < 400, `voice file ${res.status()}`);
    await waitIdle(page);
    await page.getByTestId('tour-bridal').click();
    await page.waitForFunction(() => window.__isheVoiceLog.includes('tour-bridal-attendant'), null, { timeout: 10000 });
    await page.getByTestId('tour-stop').click();
    await waitIdle(page);
    metrics.voiceLog = await page.evaluate(() => window.__isheVoiceLog);
    await page.getByTestId('sound-toggle').click();
  });

  await check('visit statistics: anonymous batches, re-validated by the server, discarded when unset', async () => {
    await page.waitForFunction(() => window.__isheAnalytics.length > 0, null, { timeout: 30000 });
    const batches = (await page.evaluate(() => window.__isheAnalytics)).map((b) => JSON.parse(b));
    const names = new Set(batches.flatMap((b) => b.events.map((e) => e.name)));
    for (const n of ['session_start', 'staff_greeting', 'tour_start']) assert(names.has(n), `missing ${n} in ${[...names]}`);
    const raw = JSON.stringify(batches);
    assert(!/@|Test Visitor|98765/.test(raw), 'personal data in analytics');
    const r = await page.evaluate((b) => fetch('/api/analytics', { method: 'POST', body: JSON.stringify(b) }).then((x) => x.json()), batches[0]);
    assert(r.ok === true && typeof r.stored === 'boolean', JSON.stringify(r));
    metrics.analytics = { batches: batches.length, events: [...names], stored: r.stored };
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
  await check('section loads', () => waitReady(page));
  await page.waitForTimeout(1000);
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
    const inCase = [-3.7, -6.3, -8.9].some((z) => c.x < -6.3 && Math.abs(c.z - z) < 0.4);
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
  await check('section loads', () => waitReady(page));
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
  }, 900000);
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
    await waitReady(page);
    await page.getByTestId('enter-button').click();
    await page.getByTestId('junction-chooser').waitFor({ timeout: 5000 });
    await page.getByTestId('choose-right').click();
    // Instant: no tween is started, so the move completes on the next rendered frame.
    await waitIdle(page, 10000);
    const s = await state(page);
    assert(!s.moving && s.room === 'right', JSON.stringify(s));
    const cam = await page.evaluate(() => window.__isheCamera());
    assert(Math.hypot(cam.x - 5.4, cam.z - -1.7) < 0.01, `camera ${JSON.stringify(cam)}`);
  });
  await check('reduced motion: evening switches instantly (no in-between frames)', async () => {
    await page.evaluate(() => {
      window.__eveSeen = [];
      const el = document.querySelector('[data-testid="showroom-canvas"]');
      new MutationObserver(() => window.__eveSeen.push(el.dataset.evening)).observe(el, { attributes: true, attributeFilter: ['data-evening'] });
    });
    await page.getByTestId('evening-toggle').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="showroom-canvas"]')?.dataset.evening === 'off', null, { timeout: 10000 });
    const seen = await page.evaluate(() => window.__eveSeen);
    assert(!seen.includes('changing'), `saw ${seen}`);
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
    await waitReady(page);
    await page.waitForTimeout(1500);
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
  await check('mobile: attendant greeting and tour controls fit the screen', async () => {
    await page.keyboard.press('Escape');
    await waitIdle(page);
    await page.evaluate(() => { window.__ishe.getState().setReducedMotion(true); window.__ishe.getState().goTo({ kind: 'staff', id: 'right' }); });
    await page.getByTestId('staff-panel').waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${OUT}/13b-mobile-attendant.png` });
    await page.getByTestId('tour-everyday').tap();
    await page.getByTestId('tour-bar').waitFor();
    const bar = await page.getByTestId('tour-bar').boundingBox();
    assert(bar.x >= 0 && bar.x + bar.width <= 390, `tour bar ${JSON.stringify(bar)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${OUT}/13c-mobile-tour.png` });
    await page.getByTestId('tour-stop').tap();
  });
  for (const evening of [false, true]) {
    await page.evaluate((e) => { const s = window.__ishe.getState(); s.setEvening(e); }, evening);
    for (const node of ['junction', 'left', 'leftBack', 'centre', 'right', 'rightBack']) {
      await page.evaluate((n) => window.__ishe.getState().goTo({ kind: 'node', node: n }), node);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/rooms-mobile-${evening ? 'evening' : 'day'}-${node}.png` });
    }
  }
  await ctx.close();
}

console.log('Room and staff screenshots, day and evening (3D, 1440x900)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?mode=3d`);
  await check('section loads', () => waitReady(page));
  await page.evaluate(() => { const s = window.__ishe.getState(); s.setReducedMotion(true); s.setEntrance(1); s.enter(); });
  await page.waitForFunction(() => window.__isheStaff?.().every((p) => p.loaded), null, { timeout: 90000 }).catch(() => undefined);
  await check('every room renders, day and evening, with draw calls recorded', async () => {
    metrics.rooms = {};
    for (const evening of [false, true]) {
      await page.evaluate((e) => window.__ishe.getState().setEvening(e), evening);
      const views = [
        ...['junction', 'left', 'leftBack', 'centre', 'right', 'rightBack'].map((n) => ({ kind: 'node', node: n })),
        { kind: 'combos' }, { kind: 'cashier' },
        { kind: 'staff', id: 'left' }, { kind: 'staff', id: 'right' },
      ];
      for (const v of views) {
        await page.evaluate((vv) => window.__ishe.getState().goTo(vv), v);
        await page.waitForTimeout(1500);
        const name = `${evening ? 'evening' : 'day'}-${v.node ?? (v.id ? `staff-${v.id}` : v.kind)}`;
        await canvasNotBlank(page, `rooms-desktop-${name}.png`);
        metrics.rooms[name] = (await page.evaluate(() => window.__isheRenderInfo())).calls;
        await page.keyboard.press('Escape').catch(() => undefined);
      }
    }
  }, 900000);
  await check('staff close-ups (cashier and consultant behind the counter)', async () => {
    await page.evaluate(() => window.__ishe.getState().setEvening(false));
    for (const [id, x] of [['cashier', 4.6], ['consultant', 5.9]]) {
      await page.evaluate(() => window.__ishe.getState().goTo({ kind: 'node', node: 'cashier' }));
      await page.waitForTimeout(800);
      const pt = await page.evaluate((xx) => window.__isheProject(xx, 1.3, -13.38), x);
      assert(pt.visible, `${id} not visible from the cashier`);
      await page.screenshot({ path: `${OUT}/staff-${id}.png`, clip: { x: Math.max(0, pt.x - 260), y: Math.max(0, pt.y - 300), width: 520, height: 600 } });
    }
    for (const id of ['left', 'right']) {
      await page.evaluate((i) => window.__ishe.getState().goTo({ kind: 'staff', id: i }), id);
      await page.waitForTimeout(1500);
      const [x, z] = id === 'left' ? [-4.2, -12.0] : [4.1, -2.4];
      const pt = await page.evaluate(([xx, zz]) => window.__isheProject(xx, 1.1, zz), [x, z]);
      await page.screenshot({ path: `${OUT}/staff-attendant-${id}.png`, clip: { x: Math.max(0, pt.x - 300), y: 0, width: 600, height: 900 } });
      await page.keyboard.press('Escape');
    }
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
  await check('lite: no staff models, guided tour still available, evening tint', async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ishe.getState().view.kind === 'node');
    assert(await page.evaluate(() => typeof window.__isheStaff === 'undefined'), 'staff hook present in lite');
    assert(await page.evaluate(() => !document.querySelector('canvas')), 'canvas in lite');
    await page.getByTestId('talk-staff').click();
    await page.getByTestId('staff-panel').waitFor();
    await page.getByTestId('tour-festive').click();
    await page.getByTestId('tour-bar').waitFor();
    await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-stop').click();
    // Opens at dusk (tint on); the toggle switches to daylight.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="lite-evening"]')).opacity === '1', null, { timeout: 3000 });
    await page.screenshot({ path: `${OUT}/17b-lite-evening.png` });
    await page.getByTestId('evening-toggle').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="lite-evening"]')).opacity === '0', null, { timeout: 3000 });
  });
  await check('lite: no page errors', async () => { assert(errors.length === 0, errors.join(' | ')); });
  await check('visit statistics: nothing is sent when the browser asks not to be tracked', async () => {
    const p4 = await b2.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await p4.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }));
      const sent = [];
      p4.on('request', (r) => { if (r.url().includes('/api/analytics')) sent.push(r.url()); });
      await p4.goto(`${BASE}/`);
      await p4.waitForFunction(() => window.__ishe?.getState().renderMode === 'lite', null, { timeout: 15000 });
      await p4.getByTestId('enter-button').click();
      await p4.getByTestId('choose-left').click();
      await p4.getByTestId('lite-display-ISH-B02').click();
      await p4.getByTestId('add-to-box').click();
      await p4.waitForTimeout(17000);
      assert(sent.length === 0 && (await p4.evaluate(() => window.__isheAnalytics.length)) === 0, `sent ${sent.length}`);
    } finally { await p4.close(); }
  });
  await b2.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, metrics }, null, 2));
console.log('METRICS', JSON.stringify(metrics));
process.exit(failed.length ? 1 : 0);
