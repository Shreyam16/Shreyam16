'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mats } from './materials';
import { Box } from './Architecture';
import { ARMCHAIRS, CHANDELIER, FLOOR_MIRRORS, FLOOR_MIRROR_SIZE, RUG, SIDE_TABLE } from './features';

/** Two-tier statement chandelier over the combos table: bronze frame, candle sleeves, crystal drops. */
function Chandelier() {
  const M = mats();
  const c = CHANDELIER;
  const tiers = [
    { y: c.bottom + 0.2, r: c.r, arms: 10 },
    { y: c.bottom + 0.48, r: c.r * 0.62, arms: 6 },
  ];
  const drop = useMemo(() => new THREE.OctahedronGeometry(0.018, 0), []);
  return (
    <group position={[c.x, 0, c.z]}>
      {/* Ceiling rose and stem. */}
      <mesh position={[0, c.top - 0.02, 0]} material={M.bronze}><cylinderGeometry args={[0.12, 0.14, 0.04, 32]} /></mesh>
      <mesh position={[0, (c.top + c.bottom + 0.2) / 2, 0]} material={M.bronze}><cylinderGeometry args={[0.012, 0.012, c.top - c.bottom - 0.2, 12]} /></mesh>
      {tiers.map((t, ti) => (
        <group key={ti} position={[0, t.y, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={M.bronze}><torusGeometry args={[t.r, 0.01, 8, 64]} /></mesh>
          {Array.from({ length: t.arms }, (_, i) => {
            const a = (i / t.arms) * Math.PI * 2 + ti * 0.3;
            const x = Math.cos(a) * t.r, z = Math.sin(a) * t.r;
            return (
              <group key={i} position={[x, 0, z]}>
                <mesh position={[-x / 2, 0, -z / 2]} rotation={[0, -a, Math.PI / 2]} material={M.bronze}>
                  <cylinderGeometry args={[0.006, 0.006, t.r, 6]} />
                </mesh>
                <mesh position={[0, 0.02, 0]} material={M.bronze}><cylinderGeometry args={[0.028, 0.02, 0.03, 16]} /></mesh>
                <mesh position={[0, 0.075, 0]} material={M.ceramic}><cylinderGeometry args={[0.012, 0.012, 0.08, 12]} /></mesh>
                <mesh position={[0, 0.13, 0]} material={M.candle}><sphereGeometry args={[0.016, 12, 8]} /></mesh>
                {[0.06, 0.12].map((d) => (
                  <mesh key={d} geometry={drop} position={[0, -d, 0]} scale={[0.8, 1.6, 0.8]} material={M.crystal} />
                ))}
              </group>
            );
          })}
        </group>
      ))}
      {/* Finial of crystals under the lower tier. */}
      {[0, 0.07, 0.14].map((d, i) => (
        <mesh key={i} geometry={drop} position={[0, c.bottom + 0.14 - d, 0]} scale={1.4 - i * 0.3} material={M.crystal} />
      ))}
    </group>
  );
}

function Armchair({ x, z, rotY, w, d }: (typeof ARMCHAIRS)[number]) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* Bronze sled base, ivory boucle body, walnut arm caps. Front faces +z before rotation. */}
      <Box size={[w - 0.04, 0.02, 0.03]} pos={[0, 0.01, d / 2 - 0.06]} mat="bronze" />
      <Box size={[w - 0.04, 0.02, 0.03]} pos={[0, 0.01, -d / 2 + 0.06]} mat="bronze" />
      <Box size={[0.03, 0.12, d - 0.1]} pos={[-w / 2 + 0.06, 0.07, 0]} mat="bronze" />
      <Box size={[0.03, 0.12, d - 0.1]} pos={[w / 2 - 0.06, 0.07, 0]} mat="bronze" />
      <Box size={[w - 0.16, 0.16, d - 0.14]} pos={[0, 0.24, 0.02]} mat="boucle" />
      <Box size={[w - 0.18, 0.1, d - 0.2]} pos={[0, 0.37, 0.04]} mat="boucle" />
      <Box size={[w - 0.08, 0.5, 0.14]} pos={[0, 0.49, -d / 2 + 0.09]} mat="boucle" rot={[-0.12, 0, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.1, 0.36, d - 0.1]} pos={[s * (w / 2 - 0.07), 0.34, 0]} mat="boucle" />
          <Box size={[0.11, 0.02, d - 0.08]} pos={[s * (w / 2 - 0.07), 0.53, 0]} mat="walnut" />
        </group>
      ))}
    </group>
  );
}

/** Round walnut side table with a bronze tray, teapot and two cups. */
function SideTable() {
  const M = mats();
  const t = SIDE_TABLE;
  const pot = useMemo(() => new THREE.LatheGeometry(
    [[0, 0], [0.05, 0], [0.065, 0.03], [0.062, 0.07], [0.04, 0.095], [0.015, 0.1], [0.018, 0.115], [0, 0.118]].map(([a, b]) => new THREE.Vector2(a, b)), 24,
  ), []);
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh position={[0, 0.015, 0]} material={M.bronze}><cylinderGeometry args={[0.16, 0.18, 0.03, 32]} /></mesh>
      <mesh position={[0, t.h / 2, 0]} material={M.bronze}><cylinderGeometry args={[0.025, 0.025, t.h, 12]} /></mesh>
      <mesh position={[0, t.h, 0]} material={M.walnut}><cylinderGeometry args={[t.r, t.r, 0.03, 40]} /></mesh>
      <group position={[0, t.h + 0.015, 0]}>
        <mesh position={[0, 0.006, 0]} material={M.brass}><cylinderGeometry args={[0.17, 0.17, 0.012, 40]} /></mesh>
        <mesh geometry={pot} position={[-0.05, 0.012, -0.02]} material={M.ceramic} />
        <mesh position={[0.015, 0.07, -0.02]} rotation={[0, 0, -0.9]} material={M.ceramic}><cylinderGeometry args={[0.006, 0.01, 0.07, 8]} /></mesh>
        {[[0.08, 0.05], [0.07, -0.08]].map(([x, z]) => (
          <group key={x} position={[x, 0.012, z]}>
            <mesh position={[0, 0.002, 0]} material={M.ceramic}><cylinderGeometry args={[0.04, 0.035, 0.005, 24]} /></mesh>
            <mesh position={[0, 0.025, 0]} material={M.ceramic}><cylinderGeometry args={[0.03, 0.022, 0.045, 20, 1, true]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Rug() {
  return (
    <mesh position={[RUG.x, 0.006, RUG.z]} rotation={[-Math.PI / 2, 0, 0]} material={mats().rug}>
      <planeGeometry args={[RUG.w, RUG.d]} />
    </mesh>
  );
}

/** Cheval try-on mirror: walnut frame on bronze feet, glass is an environment reflection. */
function FloorMirror({ x, z, rotY }: (typeof FLOOR_MIRRORS)[number]) {
  const { w, h } = FLOOR_MIRROR_SIZE;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Box size={[w, 0.02, 0.26]} pos={[0, 0.01, 0]} mat="bronze" />
      <group position={[0, 0.12, -0.05]} rotation={[-0.08, 0, 0]}>
        <Box size={[w, h - 0.12, 0.03]} pos={[0, (h - 0.12) / 2, 0]} mat="walnut" />
        <mesh position={[0, (h - 0.12) / 2, 0.0155]} material={mats().mirror}>
          <planeGeometry args={[w - 0.06, h - 0.18]} />
        </mesh>
      </group>
    </group>
  );
}

/** Static furniture; rendered inside <Merged>, so it costs about one draw call per material. */
export default function Furniture() {
  return (
    <group>
      <Chandelier />
      {ARMCHAIRS.map((a) => <Armchair key={a.x} {...a} />)}
      <SideTable />
      <Rug />
      {FLOOR_MIRRORS.map((m) => <FloorMirror key={`${m.x}${m.z}`} {...m} />)}
    </group>
  );
}
