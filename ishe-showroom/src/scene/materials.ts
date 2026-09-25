/**
 * Shared materials and procedurally generated textures. Everything is created once and reused so
 * the showroom compiles a small, fixed set of shader programs.
 */
import * as THREE from 'three';
import type { Tone } from '@/data/catalogue';

let cache: ReturnType<typeof build> | null = null;
export function mats() {
  if (!cache) cache = build();
  return cache;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic PRNG so the terrazzo looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function terrazzo() {
  const r = rng(7);
  const t = canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, 1024, 1024);
    // Soft cloudiness in the binder.
    for (let i = 0; i < 60; i++) {
      const g = ctx.createRadialGradient(r() * 1024, r() * 1024, 0, r() * 1024, r() * 1024, 80 + r() * 160);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    const chips = ['#cfc8bd', '#bdb5a8', '#8f8a82', '#e2d7c7', '#d4c7b5', '#a39a8c', '#f8f5ef', '#6e6a64', '#c9b8a2'];
    const draw = (count: number, min: number, max: number) => {
      for (let i = 0; i < count; i++) {
        const x = r() * 1024, y = r() * 1024, s = min + r() * (max - min);
        ctx.fillStyle = chips[Math.floor(r() * chips.length)];
        ctx.beginPath();
        const sides = 4 + Math.floor(r() * 4);
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * Math.PI * 2 + r() * 0.6;
          const rr = s * (0.55 + r() * 0.5);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    };
    draw(5200, 1, 3.5);
    draw(700, 3, 7);
    draw(90, 7, 13);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7.5, 7);
  return t;
}

function paving() {
  const t = canvasTexture(512, 512, (ctx) => {
    const r = rng(3);
    ctx.fillStyle = '#b9b5ae';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
      const v = 176 + Math.floor(r() * 18);
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
      ctx.fillRect(x * 256 + 3, y * 128 + 3, 250, 122);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 3);
  return t;
}

/** Soft radial falloff used for faked contact shadows and light pools. */
function radial(inner: string, outer: string) {
  return canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

function skyTexture() {
  return canvasTexture(16, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1b2330');
    g.addColorStop(0.55, '#46505f');
    g.addColorStop(0.8, '#8a8c8f');
    g.addColorStop(1, '#a79b8a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
  });
}

/** Tangent-space normal map from a height function, for fabric pile, weave and brushing. */
function normalMap(size: number, height: (x: number, y: number) => number, strength: number, repeat: number) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x, y);
  const t = canvasTexture(size, size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (xx: number, yy: number) => h[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

function linenTexture() {
  const r = rng(11);
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#e7e0d4';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 2) {
      ctx.fillStyle = `rgba(120,100,80,${0.03 + r() * 0.05})`;
      ctx.fillRect(0, i, 256, 1);
      ctx.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
      ctx.fillRect(i, 0, 1, 256);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/** Quiet abstract canvas for the foyer artwork: layered warm washes and one gold arc. */
export function artworkTexture() {
  const r = rng(21);
  return canvasTexture(768, 1024, (ctx) => {
    ctx.fillStyle = '#ece5d8';
    ctx.fillRect(0, 0, 768, 1024);
    for (let i = 0; i < 26; i++) {
      const g = ctx.createRadialGradient(r() * 768, 300 + r() * 700, 0, r() * 768, 300 + r() * 700, 160 + r() * 260);
      const tone = ['rgba(186,160,128,', 'rgba(120,108,96,', 'rgba(222,208,186,', 'rgba(60,56,52,'][i % 4];
      g.addColorStop(0, tone + (0.1 + r() * 0.12) + ')');
      g.addColorStop(1, tone + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 768, 1024);
    }
    ctx.strokeStyle = 'rgba(176,141,87,0.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(384, 560, 250, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    ctx.fillRect(0, 900, 768, 4);
  });
}

function build() {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

  const r = rng(5);
  const pile = new Float32Array(128 * 128).map(() => r());
  const velvetNormal = normalMap(128, (x, y) => pile[y * 128 + x], 0.6, 8);
  const weave = normalMap(128, (x, y) => Math.sin(x * 0.8) * 0.5 + Math.sin(y * 0.8) * 0.5, 0.35, 10);
  const brushed = normalMap(128, (x, y) => pile[(y % 128) * 128] * 0.8 + Math.sin(x * 0.05) * 0.02, 0.9, 4);

  const shadowTex = radial('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
  const poolTex = radial('rgba(255,226,180,0.9)', 'rgba(255,226,180,0)');

  const aoTex = canvasTexture(4, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(40,32,24,0.32)');
    g.addColorStop(0.35, 'rgba(40,32,24,0.1)');
    g.addColorStop(1, 'rgba(40,32,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  });
  const washTex = canvasTexture(256, 512, (ctx) => {
    // Elliptical falloff that reaches zero before every edge, so no rectangle outline shows.
    ctx.setTransform(1, 0, 0, 2, 0, 0);
    const g = ctx.createRadialGradient(128, 34, 0, 128, 40, 124);
    g.addColorStop(0, 'rgba(255,214,160,0.85)');
    g.addColorStop(0.5, 'rgba(255,214,160,0.22)');
    g.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

  const metal = (color: string) => std({ color, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 });

  const m = {
    // Architecture
    wall: std({ color: '#f4f2ee', roughness: 0.92 }),
    wallExterior: std({ color: '#f3f1ec', roughness: 0.85 }),
    ceiling: std({ color: '#fbfbf9', roughness: 1 }),
    floor: std({ map: terrazzo(), roughness: 0.32, metalness: 0, envMapIntensity: 0.55 }),
    paving: std({ map: paving(), roughness: 0.9 }),
    asphalt: std({ color: '#3b3d40', roughness: 0.95 }),
    kerb: std({ color: '#9f9b94', roughness: 0.9 }),
    plinth: std({ color: '#2a2a2a', roughness: 0.6 }),
    neighbourA: std({ color: '#c9c3b8', roughness: 0.95 }),
    neighbourB: std({ color: '#8f7f73', roughness: 0.95 }),
    darkWindow: std({ color: '#2a3038', roughness: 0.35, metalness: 0 }),
    warmWindow: std({ color: '#2b2622', emissive: '#f3cf94', emissiveIntensity: 0.35, roughness: 0.3 }),
    // Furniture
    // Lacquered cabinetry: dark satin base with a clear coat that picks up the lights.
    blackSatin: phys({ color: '#111111', roughness: 0.5, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.9 }),
    blackMetal: std({ color: '#0b0b0b', roughness: 0.32, metalness: 0.8, normalMap: brushed, normalScale: new THREE.Vector2(0.25, 0.25) }),
    velvet: phys({
      color: '#141414', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#5a5552'), sheenRoughness: 0.55,
      normalMap: velvetNormal, normalScale: new THREE.Vector2(0.35, 0.35),
    }),
    linen: std({ color: '#ffffff', map: linenTexture(), roughness: 1, normalMap: weave, normalScale: new THREE.Vector2(0.3, 0.3) }),
    floorGloss: std({
      color: '#000000', roughness: 0.26, metalness: 0, envMapIntensity: 0.55,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    // Decor
    ceramic: phys({ color: '#f3f0ea', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    stem: std({ color: '#3f5a36', roughness: 0.7 }),
    leaf: std({ color: '#2f4a2c', roughness: 0.6, side: THREE.DoubleSide }),
    petal: phys({ color: '#fbf8f2', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
    petalHeart: std({ color: '#c9a36b', roughness: 0.5 }),
    travertine: std({ color: '#e3d8c6', roughness: 0.55 }),
    downlightTrim: std({ color: '#1a1a1a', roughness: 0.4, metalness: 0.6 }),
    downlightLens: std({ color: '#fff8ee', emissive: '#ffe6c4', emissiveIntensity: 2.4 }),
    glass: phys({
      color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0,
      envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
    }),
    doorGlass: phys({
      color: '#dfe7ea', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0,
      envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide,
    }),
    lightStrip: std({ color: '#fff4e0', emissive: '#ffe2b8', emissiveIntensity: 1.6 }),
    ceilingPanel: std({ color: '#ffffff', emissive: '#fff6ea', emissiveIntensity: 0.9 }),
    sconce: std({ color: '#fff0d6', emissive: '#ffd79a', emissiveIntensity: 2.2 }),
    plant: std({ color: '#2f4a33', roughness: 0.9 }),
    planter: std({ color: '#161616', roughness: 0.5 }),
    ao: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false }),
    wash: new THREE.MeshBasicMaterial({ map: washTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32 }),
    cove: std({ color: '#fff3e2', emissive: '#ffd9a8', emissiveIntensity: 1.1 }),
    shadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    pool: new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }),
    highlight: new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    sky: new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false }),
    // Jewellery
    gold: metal('#d4ae6a'),
    silver: metal('#dfe2e6'),
    rose: metal('#d9a489'),
    pearl: phys({ color: '#f4eee4', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, iridescence: 0.4, envMapIntensity: 1.2 }),
    emerald: phys({ color: '#0f6b45', roughness: 0.05, clearcoat: 1, envMapIntensity: 2, emissive: '#06301f', emissiveIntensity: 0.4 }),
    ruby: phys({ color: '#9c1030', roughness: 0.05, clearcoat: 1, envMapIntensity: 2, emissive: '#3a0512', emissiveIntensity: 0.4 }),
    polki: phys({ color: '#f3f1ea', roughness: 0.12, clearcoat: 1, envMapIntensity: 1.6 }),
    crystal: phys({ color: '#f2f6ff', roughness: 0.0, metalness: 0.2, clearcoat: 1, envMapIntensity: 3, transparent: true, opacity: 0.85 }),
    enamelRed: phys({ color: '#8f1426', roughness: 0.2, clearcoat: 1, envMapIntensity: 1.2 }),
    enamelGreen: phys({ color: '#155c3c', roughness: 0.2, clearcoat: 1, envMapIntensity: 1.2 }),
  };
  return m;
}

export type MatKey = keyof ReturnType<typeof build>;

export function toneMat(tone: Tone): MatKey {
  return tone === 'silver-tone' ? 'silver' : tone === 'rose-tone' ? 'rose' : 'gold';
}

/** Black plaque with white serif text, used for product labels and wayfinding signs. */
export function textPlaque(lines: { text: string; font: string; color?: string }[], opts: { w?: number; h?: number; bg?: string; align?: CanvasTextAlign } = {}) {
  const w = opts.w ?? 1024, h = opts.h ?? 256;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = opts.bg ?? '#0e0e0e';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = opts.align ?? 'center';
    ctx.textBaseline = 'middle';
    const x = ctx.textAlign === 'left' ? w * 0.08 : ctx.textAlign === 'right' ? w * 0.92 : w / 2;
    const step = h / (lines.length + 1);
    lines.forEach((l, i) => {
      ctx.font = l.font;
      ctx.fillStyle = l.color ?? '#f5f2ea';
      const letter = l.font.includes('Jost') ? '0.18em' : '0em';
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = letter;
      ctx.fillText(l.text, x, step * (i + 1));
    });
  });
}
