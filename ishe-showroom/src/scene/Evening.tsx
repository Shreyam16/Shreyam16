'use client';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useShowroom } from '@/store/showroom';
import { duskSkyTexture, mats } from './materials';
import { bakedGain } from './BakedSurfaces';

const DAY = {
  hemi: 0.45, sun: 0.9, env: 1, baked: 1, sconce: 1.2, neighbour: 0.35, glass: 0, cove: 1.1,
  fog: new THREE.Color('#2a3140'), bg: new THREE.Color('#1b2330'), sunColor: new THREE.Color('#fff4e6'),
};
const DUSK = {
  hemi: 0.3, sun: 0.14, env: 0.72, baked: 0.84, sconce: 4.2, neighbour: 1.5, glass: 0.55, cove: 1.6,
  fog: new THREE.Color('#161b29'), bg: new THREE.Color('#0d1120'), sunColor: new THREE.Color('#9fb0d4'),
};

/**
 * Day / evening lighting. Evening brings a dusk sky, lit facade sconces, warm light glowing from
 * the shop windows and neighbouring flats, and slightly lower ambient light inside. No lights are
 * added: the same hemisphere + directional pair is re-balanced and emissive materials brightened.
 */
export default function Evening() {
  const { scene } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const t = useRef(-1);
  const sky = useMemo(() => ({ day: (mats().sky as THREE.MeshBasicMaterial).map, dusk: duskSkyTexture() }), []);
  const fog = useMemo(() => new THREE.Color(), []);

  useFrame((_, dtRaw) => {
    const s = useShowroom.getState();
    const want = s.evening ? 1 : 0;
    const prev = t.current;
    if (prev === want) return;
    if (prev < 0 && want === 0) { t.current = 0; return; } // materials already hold the day values
    const step = s.reducedMotion || prev < 0 ? 1 : Math.min(1, dtRaw) / 1.4;
    const next = prev < 0 ? want : prev + Math.sign(want - prev) * Math.min(step, Math.abs(want - prev));
    t.current = next;
    const k = THREE.MathUtils.smoothstep(next, 0, 1);
    const L = (a: number, b: number) => a + (b - a) * k;
    const M = mats();
    if (hemi.current) hemi.current.intensity = L(DAY.hemi, DUSK.hemi);
    if (sun.current) {
      sun.current.intensity = L(DAY.sun, DUSK.sun);
      sun.current.color.copy(DAY.sunColor).lerp(DUSK.sunColor, k);
    }
    (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = L(DAY.env, DUSK.env);
    bakedGain(L(DAY.baked, DUSK.baked));
    (M.sconce as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.sconce, DUSK.sconce);
    (M.warmWindow as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.neighbour, DUSK.neighbour);
    (M.doorGlass as THREE.MeshPhysicalMaterial).emissiveIntensity = L(DAY.glass, DUSK.glass);
    (M.cove as THREE.MeshStandardMaterial).emissiveIntensity = L(DAY.cove, DUSK.cove);
    // Sky: dip and swap textures halfway so the change reads as a fade.
    const skyMat = M.sky as THREE.MeshBasicMaterial;
    const map = next > 0.5 ? sky.dusk : sky.day;
    if (skyMat.map !== map) { skyMat.map = map; skyMat.needsUpdate = true; }
    skyMat.color.setScalar(1 - Math.sin(next * Math.PI) * 0.45);
    fog.copy(DAY.fog).lerp(DUSK.fog, k);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fog);
    if (scene.background instanceof THREE.Color) scene.background.copy(DAY.bg).lerp(DUSK.bg, k);
    const el = document.querySelector<HTMLElement>('[data-testid="showroom-canvas"]');
    if (el) el.dataset.evening = next === 1 ? 'on' : next === 0 ? 'off' : 'changing';
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff3e3', '#cfc6b8', DAY.hemi]} />
      <directionalLight ref={sun} position={[-6, 12, 10]} intensity={DAY.sun} color="#fff4e6" />
    </>
  );
}
