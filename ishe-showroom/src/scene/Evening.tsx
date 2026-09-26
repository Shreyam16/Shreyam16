'use client';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useShowroom } from '@/store/showroom';
import { duskSkyTexture, mats } from './materials';
import { bakedGain, bakedWarmth } from './BakedSurfaces';

const DAY = {
  hemi: 0.45, sun: 0.9, env: 1, baked: 1, sconce: 1.2, neighbour: 0.35, glass: 0, cove: 1.1, street: 1, strip: 1.6, pool: 0.35, lens: 2.4, wash: 0.05,
  fog: new THREE.Color('#2a3140'), bg: new THREE.Color('#1b2330'), sunColor: new THREE.Color('#fff4e6'),
};
/** Dusk on the limestone front: darker than day, and warm (multiplied with its day colour). */
const STONE_DUSK = new THREE.Color('#7d7061');
/** Warm cast on unbaked plaster at dusk (multiplied with its day colour). */
const WALL_DUSK = new THREE.Color('#ffd3a6');
/** Warm fill inside at dusk (the amber of the reference). */
const DUSK_SKY_FILL = new THREE.Color('#ffd6a6');
const DUSK = {
  // Dusk: lower ambient and bounce, brighter case lights, coves and sconces, for the warm, lit-from-within look.
  // Inside stays bright (the film's interior glows well above the street); coves and strips stay soft.
  hemi: 0.2, sun: 0.1, env: 0.5, baked: 0.92, sconce: 4, neighbour: 1.8, glass: 0.1, cove: 0.7, street: 0.3, strip: 1.7, pool: 0.5, lens: 3.2, wash: 0.9,
  fog: new THREE.Color('#161b29'), bg: new THREE.Color('#0d1120'), sunColor: new THREE.Color('#9fb0d4'),
};

/**
 * Day / evening lighting. Evening brings a dusk sky, lit facade sconces, warm light glowing from
 * the shop windows and neighbouring flats, and slightly lower ambient light inside. No lights are
 * added: the same hemisphere + directional pair is re-balanced and emissive materials brightened.
 */
export default function Evening() {
  const { scene, gl } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const t = useRef(-1);
  const sky = useMemo(() => ({ day: (mats().sky as THREE.MeshBasicMaterial).map, dusk: duskSkyTexture() }), []);
  const fog = useMemo(() => new THREE.Color(), []);
  // Street-side finishes lose most of their daylight at dusk; remember their day colours.
  const street = useMemo(() => {
    const M = mats();
    // (The planters and boxwood stand in the shop's light, so they keep theirs.)
    return (['asphalt', 'plinth', 'neighbourA', 'neighbourB', 'darkWindow'] as const)
      .map((k) => { const m = M[k] as THREE.MeshStandardMaterial; return { m, day: m.color.clone() }; });
  }, []);
  // The limestone front keeps more of its light at dusk and turns warm: it is lit by its sconces
  // and the glow of the shop, not by the sky.
  const stone = useMemo(() => {
    const M = mats();
    return (['wallExterior', 'limestoneJoint', 'paving', 'kerb'] as const)
      .map((k) => { const m = M[k] as THREE.MeshStandardMaterial; return { m, day: m.color.clone() }; });
  }, []);
  // Interior plaster and stone take the same warm cast as the baked surfaces at dusk.
  const warm = useMemo(() => {
    const M = mats();
    return (['wall', 'travertine', 'bronzeCeiling'] as const)
      .map((k) => { const m = M[k] as THREE.MeshStandardMaterial; return { m, day: m.color.clone() }; });
  }, []);

  useFrame((_, dtRaw) => {
    const s = useShowroom.getState();
    const want = s.evening ? 1 : 0;
    const prev = t.current;
    // QA marker: always reflects the settled state, whichever path below runs.
    const mark = (v: number) => { const m = v === 1 ? 'on' : v === 0 ? 'off' : 'changing'; if (gl.domElement.dataset.evening !== m) gl.domElement.dataset.evening = m; };
    if (prev === want) { mark(prev); return; }
    if (prev < 0 && want === 0) { t.current = 0; mark(0); return; } // materials already hold the day values
    const step = s.reducedMotion || prev < 0 ? 1 : Math.min(1, dtRaw) / 1.4;
    const next = prev < 0 ? want : prev + Math.sign(want - prev) * Math.min(step, Math.abs(want - prev));
    t.current = next;
    const k = THREE.MathUtils.smoothstep(next, 0, 1);
    const L = (a: number, b: number) => a + (b - a) * k;
    const M = mats();
    if (hemi.current) {
      hemi.current.intensity = L(DAY.hemi, DUSK.hemi);
      hemi.current.color.set('#fff3e3').lerp(DUSK_SKY_FILL, k);
    }
    if (sun.current) {
      sun.current.intensity = L(DAY.sun, DUSK.sun);
      sun.current.color.copy(DAY.sunColor).lerp(DUSK.sunColor, k);
    }
    (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = L(DAY.env, DUSK.env);
    bakedGain(L(DAY.baked, DUSK.baked));
    bakedWarmth(k);
    (M.sconce as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.sconce, DUSK.sconce);
    (M.warmWindow as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.neighbour, DUSK.neighbour);
    (M.doorGlass as THREE.MeshPhysicalMaterial).emissiveIntensity = L(DAY.glass, DUSK.glass);
    (M.cove as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.cove, DUSK.cove);
    (M.lightStrip as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.strip, DUSK.strip);
    (M.downlightLens as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.lens, DUSK.lens);
    (M.pool as THREE.MeshBasicMaterial).opacity = L(DAY.pool, DUSK.pool);
    (M.facadeWash as THREE.MeshBasicMaterial).opacity = L(DAY.wash, DUSK.wash);
    for (const { m, day } of street) m.color.copy(day).multiplyScalar(L(1, DUSK.street));
    for (const { m, day } of stone) m.color.setRGB(1, 1, 1).lerp(STONE_DUSK, k).multiply(day);
    for (const { m, day } of warm) m.color.setRGB(1, 1, 1).lerp(WALL_DUSK, k * 0.8).multiply(day);
    // Sky: dip and swap textures halfway so the change reads as a fade.
    const skyMat = M.sky as THREE.MeshBasicMaterial;
    const map = next > 0.5 ? sky.dusk : sky.day;
    if (skyMat.map !== map) { skyMat.map = map; skyMat.needsUpdate = true; }
    skyMat.color.setScalar(1 - Math.sin(next * Math.PI) * 0.45);
    fog.copy(DAY.fog).lerp(DUSK.fog, k);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fog);
    if (scene.background instanceof THREE.Color) scene.background.copy(DAY.bg).lerp(DUSK.bg, k);
    mark(next);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff3e3', '#cfc6b8', DAY.hemi]} />
      <directionalLight ref={sun} position={[-6, 12, 10]} intensity={DAY.sun} color="#fff4e6" />
    </>
  );
}
