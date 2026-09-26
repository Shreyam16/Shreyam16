// Converts the Cycles stills (bake/stops/out/<stop>.<land|port>.png) into public/stops/*.webp and
// writes public/stops/manifest.json listing the stops that have both variants.
//   node scripts/stops-to-webp.mjs
import fs from 'node:fs';
import sharp from 'sharp';

const IN = 'bake/stops/out', OUT = 'public/stops';
fs.mkdirSync(OUT, { recursive: true });
const pngs = fs.existsSync(IN) ? fs.readdirSync(IN).filter((f) => f.endsWith('.png')) : [];
const have = new Map();
for (const f of pngs) {
  const [key, variant] = f.replace('.png', '').split('.');
  await sharp(`${IN}/${f}`).removeAlpha().webp({ quality: 82 }).toFile(`${OUT}/${key}.${variant}.webp`);
  have.set(key, [...(have.get(key) ?? []), variant]);
  console.log('converted', f, `${(fs.statSync(`${OUT}/${key}.${variant}.webp`).size / 1024).toFixed(0)} KB`);
}
const stops = [...have].filter(([, v]) => v.includes('land') && v.includes('port')).map(([k]) => k).sort();
// `v` busts caches when the stills are re-rendered.
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ v: Date.now().toString(36), stops }, null, 2) + '\n');
console.log(`manifest: ${stops.length} stops`);
