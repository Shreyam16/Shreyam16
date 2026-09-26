// Converts the Cycles stills (bake/stops/out/<stop>.<land|port>.png) into public/stops/*.webp and
// writes public/stops/manifest.json listing the stops that have both variants.
//   node scripts/stops-to-webp.mjs
import fs from 'node:fs';
import sharp from 'sharp';

const IN = 'bake/stops/out', OUT = 'public/stops';

/**
 * Tone curve fitted to colours measured in the reference film (floor, columns, ceiling, cabinets):
 * warmer and deeper, with the film's near-black cabinets. Bright neutral pixels (the ISHÉ plaque,
 * lamp diffusers) are left exactly as rendered, so the plaque is never tinted.
 */
function filmGrade(px) {
  const curve = [[250.7, 1.648], [230, 1.5], [195, 1.33]];
  for (let i = 0; i < px.length; i += 3) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const keep = Math.min(1, Math.max(0, (l - 0.7) / 0.06)) * Math.min(1, Math.max(0, (0.09 - sat) / 0.04));
    for (let c = 0; c < 3; c++) {
      const v = px[i + c], [k, e] = curve[c];
      px[i + c] = Math.round((1 - keep) * k * Math.pow(v / 255, e) + keep * v);
    }
  }
}
fs.mkdirSync(OUT, { recursive: true });
const pngs = fs.existsSync(IN) ? fs.readdirSync(IN).filter((f) => f.endsWith('.png')) : [];
const have = new Map();
for (const f of pngs) {
  const [key, variant] = f.replace('.png', '').split('.');
  const { data, info } = await sharp(`${IN}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  filmGrade(data);
  await sharp(data, { raw: info }).webp({ quality: 84 }).toFile(`${OUT}/${key}.${variant}.webp`);
  have.set(key, [...(have.get(key) ?? []), variant]);
  console.log('converted', f, `${(fs.statSync(`${OUT}/${key}.${variant}.webp`).size / 1024).toFixed(0)} KB`);
}
const stops = [...have].filter(([, v]) => v.includes('land') && v.includes('port')).map(([k]) => k).sort();
// `v` busts caches when the stills are re-rendered.
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ v: Date.now().toString(36), stops }, null, 2) + '\n');
console.log(`manifest: ${stops.length} stops`);
