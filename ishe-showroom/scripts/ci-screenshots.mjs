// Converts e2e screenshots to compact JPEGs for review: node scripts/ci-screenshots.mjs <in> <out>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src = 'e2e/output', out = 'e2e/output-jpg'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.png'))) {
  await sharp(path.join(src, f)).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, f.replace(/\.png$/, '.jpg')));
}
console.log('converted', fs.readdirSync(out).length, 'files');
