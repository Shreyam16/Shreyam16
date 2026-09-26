'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { BAKE_SURFACES, type BakeSurface } from './bakeSurfaces';
import { limewashTexture, mats, walnutTexture } from './materials';

/** How much the baked irradiance is scaled up (MeshBasicMaterial divides light maps by π). */
const GAIN = Math.PI * 1.3;
const baked: THREE.MeshBasicMaterial[] = [];
let gainK = 1;
let warmK = 0;
const base = new WeakMap<THREE.MeshBasicMaterial, THREE.Color>();
/** Warm 2700 K cast at dusk (multiplies each surface's own colour): the room is bright, so this
 *  reads cream-amber as in the film; a little less on the ceiling so it never turns peach. */
const WARM = new THREE.Color('#ffdcb8');
const CEILING_WARM = new THREE.Color('#ffe8cf');
const warmOf = new WeakMap<THREE.MeshBasicMaterial, THREE.Color>();
const tmp = new THREE.Color();
function applyWarmth(m: THREE.MeshBasicMaterial) {
  const b = base.get(m);
  if (b) m.color.copy(b).multiply(tmp.setRGB(1, 1, 1).lerp(warmOf.get(m) ?? WARM, warmK));
}
/** Scales every baked surface (evening mode dims the room slightly); also applies to surfaces loaded later. */
export function bakedGain(k: number) {
  gainK = k;
  for (const m of baked) m.lightMapIntensity = GAIN * k;
}
/** 0 = daylight white balance, 1 = the warm dusk cast of the reference. */
export function bakedWarmth(k: number) {
  warmK = k;
  for (const m of baked) applyWarmth(m);
}
/** Lift each surface off the old geometry toward the room so nothing z-fights. */
const OFFSET = 0.003;

function geometryFor(s: BakeSurface) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const [a0, a1, b0, b1] = s.uv;
  const c = s.c + s.normal * OFFSET;
  for (const [ra0, ra1, rb0, rb1] of s.rects) {
    const base = pos.length / 3;
    for (const [a, b] of [[ra0, rb0], [ra1, rb0], [ra1, rb1], [ra0, rb1]]) {
      if (s.plane === 'y') pos.push(a, c, b);
      else if (s.plane === 'x') pos.push(c, b, a);
      else pos.push(a, b, c);
      uv.push((a - a0) / (a1 - a0), (b - b0) / (b1 - b0));
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make every face point toward the lit side.
  const want = new THREE.Vector3(s.plane === 'x' ? s.normal : 0, s.plane === 'y' ? s.normal : 0, s.plane === 'z' ? s.normal : 0);
  const n = new THREE.Vector3().fromBufferAttribute(g.getAttribute('normal') as THREE.BufferAttribute, 0);
  if (n.dot(want) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Floor, ceiling and walls with light baked in Blender Cycles (bake/bake.py): soft shadows around
 * every vitrine, pools under the downlights, daylight through the windows, bounce light in corners.
 */
export default function BakedSurfaces() {
  const textures = useLoader(THREE.TextureLoader, BAKE_SURFACES.map((s) => `/bake/${s.name}.webp`));
  const items = useMemo(() => {
    const M = mats();
    const lime = limewashTexture();
    const wood = walnutTexture(43);
    baked.length = 0;
    return BAKE_SURFACES.map((s, i) => {
      const tex = textures[i];
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      let material: THREE.Material;
      if (s.name === 'floor') {
        const stone = (M.floor as THREE.MeshStandardMaterial).map!;
        const floorUv = stone.clone();
        // One terrazzo texture repeat covers 2 x 2 m of the plane's 0..1 UVs.
        floorUv.repeat.set(7.5, 7);
        floorUv.needsUpdate = true;
        material = new THREE.MeshBasicMaterial({ map: floorUv, lightMap: tex, lightMapIntensity: GAIN * gainK });
      } else if (s.name === 'ceiling') {
        // Brighter base so the ceiling stays ivory, not tan, under the dusk cast.
        material = new THREE.MeshBasicMaterial({ color: '#ffffff', lightMap: tex, lightMapIntensity: GAIN * gainK });
        warmOf.set(material as THREE.MeshBasicMaterial, CEILING_WARM);
      } else if (s.name !== 'wall-front') {
        // Outer walls: dark espresso wood panelling, so the gaps between the white pillars read as
        // dark recesses and the lit cases glow against them.
        const map = wood.clone();
        map.repeat.set((s.uv[1] - s.uv[0]) / 1.2, 1);
        map.needsUpdate = true;
        material = new THREE.MeshBasicMaterial({ color: '#8d7868', map, lightMap: tex, lightMapIntensity: GAIN * gainK });
      } else {
        // Warm ivory limewash, tiled about every 2 m whatever the wall's size.
        const map = lime.clone();
        map.repeat.set((s.uv[1] - s.uv[0]) / 2, (s.uv[3] - s.uv[2]) / 2);
        map.needsUpdate = true;
        material = new THREE.MeshBasicMaterial({ color: '#fbf3e6', map, lightMap: tex, lightMapIntensity: GAIN * gainK });
      }
      baked.push(material as THREE.MeshBasicMaterial);
      base.set(material as THREE.MeshBasicMaterial, (material as THREE.MeshBasicMaterial).color.clone());
      applyWarmth(material as THREE.MeshBasicMaterial);
      return { s, geometry: geometryFor(s), material };
    });
  }, [textures]);
  const M = mats();
  const floor = items.find((i) => i.s.name === 'floor')!;
  return (
    <group>
      {items.map(({ s, geometry, material }) => (
        <mesh key={s.name} geometry={geometry} material={material} name={`baked-${s.name}`} />
      ))}
      {/* Specular-only layer on the terrazzo: honed-stone sheen and soft reflections of lights. */}
      <mesh geometry={floor.geometry} material={M.floorGloss} position={[0, 0.0005, 0]} renderOrder={1} />
    </group>
  );
}
