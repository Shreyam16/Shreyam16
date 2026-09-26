'use client';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PRODUCT_BY_SKU } from '@/data/catalogue';
import { SEASON_WINDOWS, seasonFor, type Season } from '@/lib/season';
import { useShowroom } from '@/store/showroom';
import { buildPiece } from './jewellery';
import { WINDOW_DISPLAYS, WINDOW_PLINTH } from './features';
import Merged from './Merged';
import { Box } from './Architecture';

const MARIGOLD = [new THREE.MeshStandardMaterial({ color: '#f29a1d', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#f6c027', roughness: 0.9 })];
const JASMINE = new THREE.MeshStandardMaterial({ color: '#fbf8ef', roughness: 0.8 });
const LEAF = new THREE.MeshStandardMaterial({ color: '#35552f', roughness: 0.8 });
const FLAME = new THREE.MeshStandardMaterial({ color: '#ffe2a1', emissive: '#ffb347', emissiveIntensity: 2.5 });
const CLAY = new THREE.MeshStandardMaterial({ color: '#8a4a27', roughness: 0.85 });

/** Hanging strings of flowers across the top of a window (marigold for festive, jasmine for weddings). */
function Garlands({ x0, x1, kind }: { x0: number; x1: number; kind: 'marigold' | 'jasmine' }) {
  const strands = useMemo(() => {
    const out: { p: THREE.Vector3; m: number }[] = [];
    const n = 9;
    for (let s = 0; s < n; s++) {
      const x = x0 + 0.15 + (s / (n - 1)) * (x1 - x0 - 0.3);
      const len = 0.6 + ((s * 37) % 5) * 0.12;
      for (let y = 0; y < len; y += kind === 'marigold' ? 0.045 : 0.03) out.push({ p: new THREE.Vector3(x, 3.08 - y, -0.2), m: (s + Math.round(y * 40)) % 2 });
    }
    return out;
  }, [x0, x1, kind]);
  const r = kind === 'marigold' ? 0.024 : 0.012;
  return (
    <group>
      <Box size={[x1 - x0, 0.025, 0.025]} pos={[(x0 + x1) / 2, 3.1, -0.2]} mat="brass" />
      {strands.map(({ p, m }, i) => (
        <mesh key={i} position={p} material={kind === 'marigold' ? MARIGOLD[m] : JASMINE}>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Plinth({ x, z, season }: { x: number; z: number; season: Season }) {
  const { w, d, h } = WINDOW_PLINTH;
  return (
    <group position={[x, 0, z]}>
      <Box size={[w, h - 0.02, d]} pos={[0, (h - 0.02) / 2, 0]} mat="blackSatin" />
      <Box size={[w + 0.02, 0.02, d + 0.02]} pos={[0, h - 0.01, 0]} mat="taupeVelvet" />
      <Box size={[w + 0.02, 0.01, 0.01]} pos={[0, h - 0.025, d / 2 + 0.006]} mat="bronze" />
      {season === 'festive' && [-0.24, 0.24].map((dx) => (
        <group key={dx} position={[dx, h, 0.12]}>
          <mesh position={[0, 0.012, 0]} material={CLAY}><cylinderGeometry args={[0.032, 0.02, 0.024, 16]} /></mesh>
        </group>
      ))}
      {season === 'wedding' && [-0.22, 0.22].map((dx) => (
        <mesh key={dx} position={[dx, h + 0.02, 0.1]} material={LEAF}><sphereGeometry args={[0.04, 10, 8]} /></mesh>
      ))}
    </group>
  );
}

/** Flickering diya flames (festive only), one material shared by all flames. */
function Flames({ x }: { x: number }) {
  return (
    <group>
      {[-0.24, 0.24].map((dx) => (
        <mesh key={dx} position={[x + dx, WINDOW_PLINTH.h + 0.04, WINDOW_DISPLAYS[0].z + 0.12]} scale={[1, 1.8, 1]} material={FLAME}>
          <sphereGeometry args={[0.009, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Seasonal shop-window displays: a featured catalogue piece on each plinth facing the street,
 * dressed for the season. Static dressing is merged; the pieces and flames are separate.
 */
export default function WindowDisplays() {
  const [season] = useState<Season>(() => seasonFor(new Date(), typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('season') : null));
  const pieces = useMemo(() => SEASON_WINDOWS[season].skus.map((sku) => buildPiece(PRODUCT_BY_SKU[sku])), [season]);
  useFrame((state) => {
    const s = useShowroom.getState();
    const base = s.evening ? 3.4 : 2.2;
    FLAME.emissiveIntensity = s.reducedMotion ? base : base + Math.sin(state.clock.elapsedTime * 11) * 0.35 + Math.sin(state.clock.elapsedTime * 17.3) * 0.25;
    const el = state.gl.domElement;
    if (el.dataset.season !== season) el.dataset.season = season;
  });
  return (
    <group name="window-displays">
      <Merged>
        {WINDOW_DISPLAYS.map((w) => <Plinth key={w.x} x={w.x} z={w.z} season={season} />)}
        {season !== 'classic' && WINDOW_DISPLAYS.map((w) => <Garlands key={w.x} x0={w.x - 0.55} x1={w.x + 0.55} kind={season === 'festive' ? 'marigold' : 'jasmine'} />)}
      </Merged>
      {WINDOW_DISPLAYS.map((w, i) => (
        // Facing the street (+z); necklaces sit on their bust, earrings on their stand.
        <primitive key={w.x} object={pieces[i]} position={[w.x, WINDOW_PLINTH.h, w.z]} rotation={[0, 0, 0]} />
      ))}
      {season === 'festive' && WINDOW_DISPLAYS.map((w) => <Flames key={w.x} x={w.x} />)}
    </group>
  );
}

