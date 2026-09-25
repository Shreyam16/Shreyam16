// Post-processes raw Cycles bakes (bake/raw/*.webp) into public/bake/*.webp:
// - partial white balance so the room reads as white architecture under warm light,
// - extra smoothing on walls/ceiling where 64-sample indirect light is grainy,
// - a lift for the ceiling, which only receives bounce light.
import fs from 'node:fs';
import sharp from 'sharp';

const RAW = 'bake/raw', OUT = 'public/bake';
const WARMTH_KEPT = 0.35; // 0 = fully neutral, 1 = as baked

const stats = await sharp(`${RAW}/floor.webp`).stats();
const mean = stats.channels.slice(0, 3).map((c) => c.mean);
const grey = (mean[0] + mean[1] + mean[2]) / 3;
const wb = mean.map((m) => (grey / m) * (1 - WARMTH_KEPT) + WARMTH_KEPT);
console.log('white balance', wb.map((v) => v.toFixed(3)).join(' '));

for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.webp'))) {
  const name = f.replace('.webp', '');
  const isFloor = name === 'floor';
  const lift = name === 'ceiling' ? 1.55 : 1;
  let img = sharp(`${RAW}/${f}`).removeAlpha()
    .recomb([[wb[0] * lift, 0, 0], [0, wb[1] * lift, 0], [0, 0, wb[2] * lift]]);
  img = img.blur(isFloor ? 1.2 : 3.5);
  await img.webp({ quality: 90 }).toFile(`${OUT}/${f}`);
  console.log('processed', name);
}
