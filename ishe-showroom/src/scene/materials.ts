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

// Deterministic PRNG so procedural textures look the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Polished white terrazzo: warm white matrix with fine grey, black, beige and white marble chips,
 * laid in 1 x 1 m panels with hairline joints; one texture repeat covers 2 x 2 m.
 */
function terrazzo() {
  const r = rng(29);
  const t = canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, 1024, 1024);
    // Soft cloudiness in the matrix.
    for (let i = 0; i < 60; i++) {
      const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 200;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const tone = r() > 0.5 ? '250,248,244' : '222,215,204';
      g.addColorStop(0, `rgba(${tone},${0.18 + r() * 0.2})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      for (const [dx, dy] of [[0, 0], [1024, 0], [-1024, 0], [0, 1024], [0, -1024]]) { ctx.save(); ctx.translate(dx, dy); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore(); }
    }
    const chips: [string, number, number][] = [
      ['#8d8780', 5200, 2.2], ['#b9b1a5', 5200, 2.4], ['#2e2c2a', 1600, 1.8], ['#cdbb9c', 2600, 2.6], ['#fbfaf7', 2600, 2.4], ['#6f6a64', 900, 3.6], ['#a8927a', 500, 4.2],
    ];
    for (const [c, n, size] of chips) {
      ctx.fillStyle = c;
      for (let i = 0; i < n; i++) {
        const x = r() * 1024, y = r() * 1024, a = 0.4 + r() * size, b = 0.4 + r() * size * 0.8;
        ctx.beginPath();
        ctx.moveTo(x + a, y);
        ctx.lineTo(x + a * 0.3, y + b);
        ctx.lineTo(x - a * 0.8, y + b * 0.4);
        ctx.lineTo(x - a * 0.5, y - b * 0.7);
        ctx.lineTo(x + a * 0.4, y - b);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Hairline brass-toned joints between 1 m panels.
    ctx.fillStyle = 'rgba(176,160,132,0.55)';
    for (const k of [0, 512]) { ctx.fillRect(0, k, 1024, 2); ctx.fillRect(k, 0, 2, 1024); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7.5, 7);
  return t;
}

/** Warm white limewash: soft, cloudy variation with faint brush direction. */
export function limewashTexture() {
  const r = rng(17);
  const t = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#f7f4ee';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const x = r() * 512, y = r() * 512, rad = 30 + r() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const tone = r() > 0.5 ? '255,253,249' : '228,221,209';
      g.addColorStop(0, `rgba(${tone},${0.05 + r() * 0.07})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      // Draw with wrap-around so the texture tiles seamlessly.
      for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { ctx.save(); ctx.translate(dx, dy); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore(); }
    }
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '255,252,246' : '214,206,192'},${0.03 + r() * 0.04})`;
      ctx.lineWidth = 1 + r() * 3;
      const x = r() * 512, y = r() * 512, a = -0.6 + r() * 1.2, l = 20 + r() * 50;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Walnut veneer with vertical grain; `dark` for the salon panelling. */
export function walnutTexture(seed: number) {
  const r = rng(seed);
  const t = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#5a3a25';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 180; i++) {
      const x = r() * 512, w = 0.6 + r() * 2.6, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
      const dark = r() > 0.45;
      ctx.strokeStyle = dark ? `rgba(38,22,12,${0.15 + r() * 0.3})` : `rgba(140,98,62,${0.1 + r() * 0.2})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let y = -8; y <= 520; y += 8) {
        const xx = x + Math.sin(y * f * 6.28 + ph) * amp;
        if (y < 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Wool rug: ivory field, taupe border, quiet lattice. */
function rugTexture() {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#e6dccb';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(120,100,80,0.18)';
    ctx.lineWidth = 2;
    for (let i = -512; i < 1024; i += 48) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + 512, 0); ctx.lineTo(i, 512); ctx.stroke();
    }
    ctx.strokeStyle = '#7a6a5b';
    ctx.lineWidth = 22;
    ctx.strokeRect(26, 26, 460, 460);
    ctx.strokeStyle = '#b39a74';
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, 416, 416);
  });
}

function paving() {
  const t = canvasTexture(512, 512, (ctx) => {
    const r = rng(3);
    ctx.fillStyle = '#a9a196';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
      const v = 204 + Math.floor(r() * 16);
      ctx.fillStyle = `rgb(${v},${v - 5},${v - 14})`;
      ctx.fillRect(x * 256 + 2, y * 128 + 2, 252, 124);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? '240,234,222' : '150,140,126'},${0.15 + r() * 0.2})`;
        ctx.fillRect(x * 256 + 2 + r() * 250, y * 128 + 2 + r() * 122, 1 + r() * 2, 1 + r() * 2);
      }
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

/** Dusk: deep blue overhead fading to a warm band at the horizon (evening mode). */
export function duskSkyTexture() {
  return canvasTexture(16, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0b1022');
    g.addColorStop(0.5, '#27294a');
    g.addColorStop(0.72, '#5b4560');
    g.addColorStop(0.86, '#b86e55');
    g.addColorStop(1, '#e0a06a');
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
  // Gold-leaf panel: overlapping leaf squares with soft patina, like the gilded art in the salon.
  const r = rng(21);
  return canvasTexture(768, 1024, (ctx) => {
    ctx.fillStyle = '#b89452';
    ctx.fillRect(0, 0, 768, 1024);
    const leaf = 96;
    for (let y = -leaf / 2; y < 1024; y += leaf * 0.86) for (let x = -leaf / 2; x < 768; x += leaf * 0.9) {
      const v = Math.floor(r() * 40) - 20;
      ctx.fillStyle = `rgba(${206 + v},${170 + v},${104 + v},0.55)`;
      ctx.fillRect(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, leaf, leaf);
      ctx.strokeStyle = 'rgba(120,88,40,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, leaf, leaf);
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * 768, y = r() * 1024, rad = 40 + r() * 180;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const tone = ['rgba(92,70,40,', 'rgba(240,214,150,', 'rgba(70,60,48,'][i % 3];
      g.addColorStop(0, tone + (0.12 + r() * 0.18) + ')');
      g.addColorStop(1, tone + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 768, 1024);
    }
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

  const limewash = limewashTexture();
  limewash.repeat.set(2, 2);
  const walnut = walnutTexture(31);
  walnut.repeat.set(3, 1);
  const walnutFlutedMap = walnutTexture(37);
  walnutFlutedMap.repeat.set(6, 1);
  // Vertical flutes about 5 cm apart across the 7.2 m arm panels.
  const flutes = normalMap(64, (x) => -Math.cos((x / 64) * Math.PI * 2) * 6, 1, 1);
  flutes.repeat.set(144, 1);
  const folds = normalMap(128, (x) => Math.sin((x / 128) * Math.PI * 2 * 3) * 5 + Math.sin((x / 128) * Math.PI * 2 * 7) * 2, 0.6, 1);
  folds.repeat.set(6, 1);
  const rug = rugTexture();

  const m = {
    // Architecture
    // Warm ivory plaster, lit warm (the video's walls and pillars).
    wall: std({ color: '#f6efe4', map: limewash, roughness: 0.94 }),
    // Warm cream limestone for the facade, with slightly darker, recessed joints.
    wallExterior: std({ color: '#e6dcc9', roughness: 0.82 }),
    limestoneJoint: std({ color: '#cbbfa9', roughness: 0.9 }),
    ceiling: std({ color: '#fbfbf9', roughness: 1 }),
    floor: std({ map: terrazzo(), roughness: 0.3, metalness: 0, envMapIntensity: 0.6 }),
    // Honed stone pavers with a slight sheen (they catch the warm light at dusk).
    paving: std({ map: paving(), roughness: 0.6, envMapIntensity: 0.6 }),
    asphalt: std({ color: '#3b3d40', roughness: 0.95 }),
    kerb: std({ color: '#9f9b94', roughness: 0.9 }),
    plinth: std({ color: '#2a2a2a', roughness: 0.6 }),
    neighbourA: std({ color: '#c9c3b8', roughness: 0.95 }),
    neighbourB: std({ color: '#8f7f73', roughness: 0.95 }),
    darkWindow: std({ color: '#2a3038', roughness: 0.35, metalness: 0 }),
    warmWindow: std({ color: '#2b2622', emissive: '#f3cf94', emissiveIntensity: 0.35, roughness: 0.3 }),
    // Furniture
    // Lacquered cabinetry: dark satin base with a clear coat that picks up the lights.
    // Espresso lacquer: near-black with a warm brown undertone, as on the boutique's cabinets.
    blackSatin: phys({ color: '#1b1511', roughness: 0.45, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }),
    // Thin dark-bronze frames on the glass boxes.
    darkBronze: std({ color: '#5b4128', metalness: 0.85, roughness: 0.35, envMapIntensity: 1.1 }),
    // Display cabinets: dark chocolate-brown satin lacquer with a soft, warm sheen (not glossy black).
    caseWood: phys({ color: '#241a13', roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.45 }),
    blackMetal: std({ color: '#0b0b0b', roughness: 0.32, metalness: 0.8, normalMap: brushed, normalScale: new THREE.Vector2(0.25, 0.25) }),
    velvet: phys({
      // Champagne suede busts, bolsters and cushions, as in the boutique's cases.
      color: '#b08a55', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#f6dfae'), sheenRoughness: 0.45,
      emissive: '#3a2610', emissiveIntensity: 0.35,
      normalMap: velvetNormal, normalScale: new THREE.Vector2(0.3, 0.3),
    }),
    linen: std({ color: '#ffffff', map: linenTexture(), roughness: 1, normalMap: weave, normalScale: new THREE.Vector2(0.3, 0.3) }),
    floorGloss: std({
      color: '#000000', roughness: 0.2, metalness: 0, envMapIntensity: 0.8,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    // Warm ivory / walnut palette
    walnut: std({ color: '#ffffff', map: walnut, roughness: 0.55, envMapIntensity: 0.6 }),
    walnutFluted: std({ color: '#ffffff', map: walnutFlutedMap, roughness: 0.5, normalMap: flutes, normalScale: new THREE.Vector2(1.4, 1.4), envMapIntensity: 0.6 }),
    bronze: std({ color: '#8f6c46', metalness: 1, roughness: 0.34, envMapIntensity: 1.2 }),
    brass: std({ color: '#c09a58', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }),
    // Lowered white tray: a touch of self-light so it reads as lit plaster, not grey concrete, at dusk.
    bronzeCeiling: std({ color: '#f6f3ee', metalness: 0, roughness: 0.95, emissive: '#6e5f4c', emissiveIntensity: 0.45 }),
    // Black lacquered panelling for the salon feature wall.
    ebony: phys({ color: '#0e0c0b', roughness: 0.42, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.7 }),
    goldLeaf: std({ color: '#ffffff', map: artworkTexture(), metalness: 0.85, roughness: 0.42, envMapIntensity: 1.3 }),
    taupeVelvet: phys({
      // Golden-tan suede deck, brightly lit by the case LEDs (the glass boxes glow warm in the video).
      color: '#c9a877', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffe3b0'), sheenRoughness: 0.45,
      emissive: '#6a4a20', emissiveIntensity: 0.5,
      normalMap: velvetNormal, normalScale: new THREE.Vector2(0.3, 0.3),
    }),
    boucle: std({ color: '#e7dfd1', roughness: 1, normalMap: velvetNormal, normalScale: new THREE.Vector2(0.8, 0.8) }),
    rug: std({ map: rug, roughness: 1 }),
    // Try-on mirrors: a sharp reflection of the environment map, no render targets.
    mirror: std({ color: '#ece6dc', metalness: 1, roughness: 0.04, envMapIntensity: 1.25 }),
    sheer: std({
      color: '#f7f2e8', roughness: 1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
      normalMap: folds, normalScale: new THREE.Vector2(1, 1),
    }),
    candle: std({ color: '#fff5e3', emissive: '#ffcf8f', emissiveIntensity: 2.6 }),
    // Decor
    ceramic: phys({ color: '#f3f0ea', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    stem: std({ color: '#3f5a36', roughness: 0.7 }),
    leaf: std({ color: '#2f4a2c', roughness: 0.6, side: THREE.DoubleSide }),
    petal: phys({ color: '#fbf8f2', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
    petalHeart: std({ color: '#c9a36b', roughness: 0.5 }),
    travertine: std({ color: '#f1ede6', roughness: 0.35 }),
    downlightTrim: std({ color: '#1a1a1a', roughness: 0.4, metalness: 0.6 }),
    downlightLens: std({ color: '#fff8ee', emissive: '#ffe6c4', emissiveIntensity: 2.4 }),
    // Low-iron display glass: almost invisible head-on, crisp reflections at an angle.
    glass: phys({
      color: '#ffffff', transparent: true, opacity: 0.045, roughness: 0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0,
      envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide,
    }),
    doorGlass: phys({
      // Clear low-iron glass: the lit interior reads through it; reflections stay faint.
      color: '#f1ebe2', transparent: true, opacity: 0.09, roughness: 0.02, metalness: 0,
      envMapIntensity: 1.1, depthWrite: false, side: THREE.DoubleSide,
      // Warm glow seen from the street in evening mode (intensity driven by Evening.tsx).
      emissive: '#ffc98a', emissiveIntensity: 0,
    }),
    lightStrip: std({ color: '#fff4e0', emissive: '#ffd6a0', emissiveIntensity: 1.6 }),
    ceilingPanel: std({ color: '#ffffff', emissive: '#fff6ea', emissiveIntensity: 0.9 }),
    sconce: std({ color: '#fff0d6', emissive: '#ffcf8a', emissiveIntensity: 2.2 }),
    // Clipped boxwood: deep green with a fine leafy surface, not a smooth ball.
    plant: std({ color: '#2a4029', roughness: 0.95, normalMap: velvetNormal, normalScale: new THREE.Vector2(1.6, 1.6) }),
    planter: std({ color: '#141312', roughness: 0.42, envMapIntensity: 0.7 }),
    // Warm light spilling from the façade sconces onto the stone (strength driven by Evening.tsx).
    facadeWash: new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.05 }),
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
