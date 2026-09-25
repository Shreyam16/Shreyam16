// Re-packs a generated character GLB for the web: every texture -> max 1024 px WebP
// (EXT_texture_webp), emissive copies of the base colour removed. Geometry, skin and animation
// are kept byte-for-byte. Needs a Chromium for image re-encoding (playwright-core).
//   node scripts/repack-staff.cjs in.glb out.glb [chromiumPath]
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_MODULE || 'playwright-core');

(async () => {
  const [src, out, exe] = process.argv.slice(2);
  const b = fs.readFileSync(src);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8);
  const view = (i) => { const v = j.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  const webp = [];
  for (const im of j.images || []) {
    const data = view(im.bufferView);
    const isNormal = (j.materials || []).some((m) => m.normalTexture && j.textures[m.normalTexture.index].source === j.images.indexOf(im));
    const bytes = await page.evaluate(async ({ b64, mime, lossless }) => {
      const blob = await (await fetch(`data:${mime};base64,${b64}`)).blob();
      const img = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const s = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = new OffscreenCanvas(Math.round(img.width * s), Math.round(img.height * s));
      const x = c.getContext('2d', { colorSpace: 'srgb' });
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      const out = await c.convertToBlob({ type: 'image/webp', quality: lossless ? 0.95 : 0.86 });
      return Array.from(new Uint8Array(await out.arrayBuffer()));
    }, { b64: data.toString('base64'), mime: im.mimeType || 'image/png', lossless: isNormal });
    webp.push(Buffer.from(bytes));
  }
  await browser.close();
  // Rebuild the binary chunk with the new images.
  const imgViews = new Map((j.images || []).map((im, i) => [im.bufferView, i]));
  const parts = []; let off = 0;
  j.bufferViews = j.bufferViews.map((v, i) => {
    const data = imgViews.has(i) ? webp[imgViews.get(i)] : view(i);
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    parts.push(data); const nv = { ...v, byteOffset: off, byteLength: data.length }; off += data.length; return nv;
  });
  const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  j.buffers = [{ byteLength: off }];
  for (const im of j.images || []) im.mimeType = 'image/webp';
  j.textures = (j.textures || []).map((t) => ({ sampler: t.sampler, extensions: { EXT_texture_webp: { source: t.source } } }));
  for (const m of j.materials || []) {
    const base = m.pbrMetallicRoughness?.baseColorTexture?.index;
    if (m.emissiveTexture && base !== undefined && j.textures[m.emissiveTexture.index].extensions.EXT_texture_webp.source === j.textures[base].extensions.EXT_texture_webp.source) {
      delete m.emissiveTexture; delete m.emissiveFactor;
    }
    if (m.extensions) { delete m.extensions.KHR_materials_specular; if (!Object.keys(m.extensions).length) delete m.extensions; }
  }
  j.extensionsUsed = [...new Set([...(j.extensionsUsed || []).filter((e) => e !== 'KHR_materials_specular'), 'EXT_texture_webp'])];
  j.extensionsRequired = [...new Set([...(j.extensionsRequired || []), 'EXT_texture_webp'])];
  let js = Buffer.from(JSON.stringify(j));
  const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(body.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(out, Buffer.concat([head, c1, js, c2, body]));
  console.log(path.basename(out), (fs.statSync(out).size / 1e6).toFixed(2), 'MB', (j.images || []).length, 'textures');
})();
