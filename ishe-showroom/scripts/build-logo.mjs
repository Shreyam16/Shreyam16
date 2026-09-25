// Extracts the official ISHÉ wordmark from the supplied brand board
// (brand-source/ishe-brand-board.webp) without redrawing any letterforms.
// Output:
//   public/brand/ishe-wordmark-black.png  black wordmark on transparent (alpha from luminance)
//   public/brand/ishe-logo-plaque.png     black wordmark on a white rectangular plaque
import sharp from 'sharp';

const SRC = 'brand-source/ishe-brand-board.webp';
const BOX = { left: 180, top: 343, width: 941 - 180 + 1, height: 645 - 343 + 1 };
const PAD = 6;

const crop = { left: BOX.left - PAD, top: BOX.top - PAD, width: BOX.width + PAD * 2, height: BOX.height + PAD * 2 };
const { data, info } = await sharp(SRC).extract(crop).greyscale().raw().toBuffer({ resolveWithObject: true });

// Board background ~250, ink ~20. Map luminance to alpha so edges keep their anti-aliasing.
const BG = 246, INK = 30;
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i++) {
  const a = Math.max(0, Math.min(1, (BG - data[i]) / (BG - INK)));
  rgba[i * 4] = 10; rgba[i * 4 + 1] = 10; rgba[i * 4 + 2] = 10; rgba[i * 4 + 3] = Math.round(a * 255);
}
const mark = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
await mark.clone().toFile('public/brand/ishe-wordmark-black.png');

// White plaque: generous margins, 2:1-ish rectangle.
const plaqueW = Math.round(info.width * 1.42), plaqueH = Math.round(info.height * 1.9);
await sharp({ create: { width: plaqueW, height: plaqueH, channels: 4, background: '#ffffff' } })
  .composite([{ input: await mark.toBuffer(), left: Math.round((plaqueW - info.width) / 2), top: Math.round((plaqueH - info.height) / 2) }])
  .png().toFile('public/brand/ishe-logo-plaque.png');
console.log('logo written', info.width, info.height, plaqueW, plaqueH);
