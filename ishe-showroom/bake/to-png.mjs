// Converts bake/*.npy (uint8 HxWx3, written by bake.py) to public/bake/*.webp.
import fs from 'node:fs';
import sharp from 'sharp';
const dir = 'public/bake';
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.npy') && f !== 'exposure.npy')) {
  const buf = fs.readFileSync(`${dir}/${f}`);
  const headerLen = buf.readUInt16LE(8);
  const header = buf.slice(10, 10 + headerLen).toString();
  const shape = header.match(/\((\d+), (\d+), (\d+)\)/).slice(1).map(Number);
  const data = buf.slice(10 + headerLen);
  await sharp(data, { raw: { width: shape[1], height: shape[0], channels: 3 } }).webp({ quality: 90 }).toFile(`${dir}/${f.replace('.npy', '.webp')}`);
  fs.unlinkSync(`${dir}/${f}`);
  console.log('wrote', f.replace('.npy', '.webp'), shape);
}
