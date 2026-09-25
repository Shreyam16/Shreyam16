'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mats } from './materials';
import { artworkTexture } from './materials';
import { ARTWORK, CONSOLE, DOWNLIGHTS, ceilingAt } from './features';
import Furniture from './Furniture';
import { CEILING } from './layout';
import { Box } from './Architecture';

/** Seeded random so the arrangement is identical on every load. */
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

/** White phalaenopsis-style orchids in a ceramic vase: arching sprays of five-petal blooms. */
function Orchids({ x, y, z }: { x: number; y: number; z: number }) {
  const M = mats();
  const parts = useMemo(() => {
    const r = seeded(7);
    const stems: { curve: THREE.QuadraticBezierCurve3 }[] = [];
    const blooms: { p: THREE.Vector3; rot: THREE.Euler; s: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r() * 0.6;
      const lean = 0.12 + r() * 0.16;
      const h = 0.55 + r() * 0.25;
      const start = new THREE.Vector3(0, 0.26, 0);
      const ctrl = new THREE.Vector3(Math.cos(a) * lean * 0.3, 0.26 + h, Math.sin(a) * lean * 0.3);
      const end = new THREE.Vector3(Math.cos(a) * lean, 0.26 + h * 0.82, Math.sin(a) * lean);
      const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
      stems.push({ curve });
      for (let k = 0; k < 5; k++) {
        const t = 0.62 + k * 0.08;
        const p = curve.getPoint(Math.min(0.98, t));
        blooms.push({ p, rot: new THREE.Euler(r() * 0.6 - 0.3, a + Math.PI / 2 + r() * 0.4, 0.2), s: 0.9 - k * 0.08 });
      }
    }
    return { stems, blooms };
  }, []);
  const vase = useMemo(() => new THREE.LatheGeometry(
    [[0, 0], [0.085, 0], [0.1, 0.05], [0.095, 0.16], [0.07, 0.24], [0.065, 0.26], [0, 0.26]].map(([a, b]) => new THREE.Vector2(a, b)), 48,
  ), []);
  return (
    <group position={[x, y, z]}>
      <mesh geometry={vase} material={M.ceramic} />
      {parts.stems.map(({ curve }, i) => (
        <mesh key={i} material={M.stem}><tubeGeometry args={[curve, 24, 0.0035, 6, false]} /></mesh>
      ))}
      {parts.blooms.map(({ p, rot, s }, i) => (
        <group key={i} position={p} rotation={rot} scale={s}>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k / 5) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0]} rotation={[0, 0, a]} scale={[1.25, 0.9, 0.18]} material={M.petal}>
                <sphereGeometry args={[0.02, 10, 8]} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 0.006]} material={M.petalHeart}><sphereGeometry args={[0.008, 8, 6]} /></mesh>
        </group>
      ))}
      {/* Broad leaves at the rim. */}
      {[0, 2.1, 4.2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.1, 0.27, Math.sin(a) * 0.1]} rotation={[0.2, -a, 0.9]} scale={[1, 0.12, 0.35]} material={M.leaf}>
          <sphereGeometry args={[0.12, 16, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Console() {
  const c = CONSOLE;
  const w = c.x1 - c.x0, d = c.z1 - c.z0, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
  return (
    <group>
      <Box size={[w, 0.05, d]} pos={[cx, c.h - 0.025, cz]} mat="travertine" />
      <Box size={[w - 0.06, c.h - 0.05, d - 0.06]} pos={[cx, (c.h - 0.05) / 2, cz]} mat="blackSatin" />
      <Orchids x={cx + 0.02} y={c.h} z={cz - 0.18} />
      {/* A short stack of books and a small brass-toned tray. */}
      <Box size={[0.2, 0.03, 0.26]} pos={[cx, c.h + 0.015, cz + 0.28]} mat="linen" />
      <Box size={[0.19, 0.025, 0.24]} pos={[cx, c.h + 0.043, cz + 0.28]} mat="blackSatin" />
    </group>
  );
}

function Artwork() {
  const a = ARTWORK;
  const tex = useMemo(artworkTexture, []);
  return (
    <group position={[a.x, a.y, a.z]} rotation={[0, -Math.PI / 2, 0]}>
      <Box size={[a.w + 0.08, a.h + 0.08, 0.04]} pos={[0, 0, 0.02]} mat="blackSatin" />
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[a.w, a.h]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* Picture light. */}
      <Box size={[0.5, 0.03, 0.03]} pos={[0, a.h / 2 + 0.12, 0.12]} mat="blackMetal" />
      <Box size={[0.012, 0.012, 0.1]} pos={[0, a.h / 2 + 0.08, 0.07]} mat="blackMetal" />
      <mesh position={[0, a.h / 2 + 0.104, 0.12]} rotation={[Math.PI / 2, 0, 0]} material={mats().lightStrip}>
        <planeGeometry args={[0.46, 0.012]} />
      </mesh>
    </group>
  );
}

function Downlights() {
  const M = mats();
  return (
    <group>
      {DOWNLIGHTS.map((d, i) => (
        <group key={i} position={[d.x, ceilingAt(d.x, d.z, CEILING) - 0.004, d.z]}>
          <mesh material={M.downlightTrim}><cylinderGeometry args={[0.075, 0.075, 0.008, 24]} /></mesh>
          <mesh position={[0, -0.0045, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.downlightLens}><circleGeometry args={[0.05, 24]} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Static decor; rendered inside a <Merged> group so it costs roughly one draw call per material. */
export default function Decor() {
  return (
    <group>
      <Console />
      <Artwork />
      <Downlights />
      <Furniture />
    </group>
  );
}
