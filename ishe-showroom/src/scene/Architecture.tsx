'use client';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { mats, textPlaque, type MatKey } from './materials';
import {
  BENCHES, CEILING, DEPTH, FRONT_DOOR, HALF_W, PARTITION_END_Z, PARTITION_X, SIDE_DOOR, CASHIER,
} from './layout';
import { useShowroom } from '@/store/showroom';
import { DISPLAYS } from './layout';
import Merged from './Merged';
import { useFontsReady } from './fonts';

type V3 = [number, number, number];

export function Box({ size, pos, mat, rot }: { size: V3; pos: V3; mat: MatKey; rot?: V3 }) {
  const M = mats();
  return (
    <mesh position={pos} rotation={rot} material={M[mat] as THREE.Material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** Box spanning two corners, handy for walls. */
function Span({ a, b, mat }: { a: V3; b: V3; mat: MatKey }) {
  const size: V3 = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])];
  const pos: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return <Box size={size} pos={pos} mat={mat} />;
}

const FACADE_H = 4.7;
const WIN = { x0: 2.2, x1: 6.5, y0: 0.45, y1: 3.1 };

function Facade({ plaque }: { plaque: THREE.Texture }) {
  const hw = HALF_W + 0.1;
  const dw = FRONT_DOOR.halfWidth;
  const z0 = -0.1, z1 = 0.1;
  return (
    <group>
      {/* Piers and spandrels around two shop windows and the door. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Span a={[s * hw, 0, z0]} b={[s * WIN.x1, FACADE_H, z1]} mat="wallExterior" />
          <Span a={[s * WIN.x0, 0, z0]} b={[s * dw, FACADE_H, z1]} mat="wallExterior" />
          <Span a={[s * WIN.x1, 0, z0]} b={[s * WIN.x0, WIN.y0, z1]} mat="wallExterior" />
          <Span a={[s * WIN.x1, WIN.y1, z0]} b={[s * WIN.x0, FACADE_H, z1]} mat="wallExterior" />
          {/* Window glass and black frame. */}
          <mesh position={[s * (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, 0]} material={mats().doorGlass}>
            <planeGeometry args={[WIN.x1 - WIN.x0, WIN.y1 - WIN.y0]} />
          </mesh>
          <Frame x={s * (WIN.x0 + WIN.x1) / 2} y={(WIN.y0 + WIN.y1) / 2} w={WIN.x1 - WIN.x0} h={WIN.y1 - WIN.y0} t={0.07} z={0.1} />
          <Box size={[0.05, WIN.y1 - WIN.y0, 0.08]} pos={[s * (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, 0.06]} mat="blackMetal" />
          {/* Sconce beside the door. */}
          <Box size={[0.08, 0.34, 0.1]} pos={[s * 1.65, 2.2, 0.16]} mat="blackMetal" />
          <Box size={[0.05, 0.26, 0.02]} pos={[s * 1.65, 2.2, 0.215]} mat="sconce" />
          {/* Planter. */}
          <mesh position={[s * 1.75, 0.35, 0.55]} material={mats().planter}>
            <cylinderGeometry args={[0.28, 0.24, 0.7, 32]} />
          </mesh>
          <mesh position={[s * 1.75, 0.95, 0.55]} material={mats().plant} scale={[1, 1.15, 1]}>
            <icosahedronGeometry args={[0.36, 2]} />
          </mesh>
        </group>
      ))}
      <Span a={[-dw, FRONT_DOOR.height, z0]} b={[dw, FACADE_H, z1]} mat="wallExterior" />
      {/* Black portal around the doorway. */}
      <Frame x={0} y={FRONT_DOOR.height / 2} w={dw * 2} h={FRONT_DOOR.height} t={0.09} z={0.12} noBottom />
      {/* Dark stone plinth band. */}
      <Span a={[-hw, 0, 0.1]} b={[-dw - 0.09, 0.3, 0.14]} mat="plinth" />
      <Span a={[dw + 0.09, 0, 0.1]} b={[hw, 0.3, 0.14]} mat="plinth" />
      {/* Cornice. */}
      <Span a={[-hw - 0.05, FACADE_H - 0.1, -0.1]} b={[hw + 0.05, FACADE_H + 0.05, 0.25]} mat="wallExterior" />
      {/* Sign: official ISHÉ wordmark on a white rectangular plaque. */}
      <group position={[0, 3.62, 0.13]}>
        <Box size={[2.3, 1.27, 0.06]} pos={[0, 0, 0]} mat="blackMetal" />
        <mesh position={[0, 0, 0.032]}>
          <planeGeometry args={[2.2, 1.2]} />
          <meshBasicMaterial map={plaque} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Frame({ x, y, w, h, t, z, noBottom }: { x: number; y: number; w: number; h: number; t: number; z: number; noBottom?: boolean }) {
  return (
    <group position={[x, y, z]}>
      <Box size={[w + t, t, t]} pos={[0, h / 2, 0]} mat="blackMetal" />
      {!noBottom && <Box size={[w + t, t, t]} pos={[0, -h / 2, 0]} mat="blackMetal" />}
      <Box size={[t, h, t]} pos={[-w / 2, 0, 0]} mat="blackMetal" />
      <Box size={[t, h, t]} pos={[w / 2, 0, 0]} mat="blackMetal" />
    </group>
  );
}

/** One glass door leaf with a black frame and a long pull handle. */
function DoorLeaf({ side }: { side: -1 | 1 }) {
  const w = FRONT_DOOR.halfWidth - 0.02, h = FRONT_DOOR.height - 0.02;
  const dir = -side; // leaf extends from the hinge toward the centre
  const cx = (dir * w) / 2;
  return (
    <group>
      <mesh position={[cx, h / 2, 0]} material={mats().doorGlass}>
        <planeGeometry args={[w - 0.1, h - 0.16]} />
      </mesh>
      <Box size={[0.06, h, 0.05]} pos={[dir * 0.03, h / 2, 0]} mat="blackMetal" />
      <Box size={[0.06, h, 0.05]} pos={[dir * (w - 0.03), h / 2, 0]} mat="blackMetal" />
      <Box size={[w, 0.08, 0.05]} pos={[cx, h - 0.04, 0]} mat="blackMetal" />
      <Box size={[w, 0.14, 0.05]} pos={[cx, 0.07, 0]} mat="blackMetal" />
      {/* Pull handles on both faces. */}
      {[0.07, -0.07].map((z) => (
        <mesh key={z} position={[dir * (w - 0.16), 1.1, z]} material={mats().blackMetal}>
          <cylinderGeometry args={[0.014, 0.014, 1.1, 16]} />
        </mesh>
      ))}
    </group>
  );
}

function Doors() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = useShowroom.getState();
    const p = s.phase === 'inside' ? 1 : s.entrance;
    // Doors swing inward between 20% and 62% of the entrance scroll, eased.
    const t = THREE.MathUtils.smoothstep(p, 0.2, 0.62);
    const open = s.phase === 'inside' ? 0 : t * 1.45; // closed again behind the visitor once inside
    if (left.current) left.current.rotation.y = open;
    if (right.current) right.current.rotation.y = -open;
  });
  return (
    <group>
      <group ref={left} position={[-FRONT_DOOR.halfWidth, 0, 0]}>
        <DoorLeaf side={-1} />
      </group>
      <group ref={right} position={[FRONT_DOOR.halfWidth, 0, 0]}>
        <DoorLeaf side={1} />
      </group>
    </group>
  );
}

function Street() {
  const M = mats();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 2.6]} material={M.paving}>
        <planeGeometry args={[40, 5.2]} />
      </mesh>
      <Box size={[40, 0.14, 0.25]} pos={[0, 0.07, 5.3]} mat="kerb" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 12]} material={M.asphalt}>
        <planeGeometry args={[60, 14]} />
      </mesh>
      {/* Neighbouring buildings frame the storefront. */}
      <Span a={[-20, 0, -14]} b={[-HALF_W - 0.1, 9, 0.05]} mat="neighbourA" />
      <Span a={[HALF_W + 0.1, 0, -14]} b={[20, 11, 0.05]} mat="neighbourB" />
      {[-15.5, -11.5].map((x) => [1.5, 4.5, 7.2].map((y) => (
        <Box key={`${x}${y}`} size={[1.6, 1.8, 0.05]} pos={[x, y, 0.07]} mat={y < 2 ? 'warmWindow' : 'darkWindow'} />
      )))}
      {[11.2, 15.2].map((x) => [1.6, 4.6, 7.6].map((y) => (
        <Box key={`${x}${y}`} size={[1.5, 2, 0.05]} pos={[x, y, 0.07]} mat="darkWindow" />
      )))}
      {/* Upper storey above the showroom. */}
      <Span a={[-HALF_W - 0.1, FACADE_H + 0.05, -1]} b={[HALF_W + 0.1, 9.5, -0.1]} mat="neighbourA" />
      {[-5, -1.7, 1.7, 5].map((x) => (
        <Box key={x} size={[1.3, 1.9, 0.05]} pos={[x, 6.9, -0.07]} mat="darkWindow" />
      ))}
      <mesh position={[0, 0, 0]} material={M.sky}>
        <sphereGeometry args={[80, 24, 16]} />
      </mesh>
    </group>
  );
}

function Wayfinding() {
  const tex = useMemo(() => {
    const f = (t: string) => ({ text: t, font: '500 88px "Cormorant Garamond"', color: '#111' });
    const s = (t: string) => ({ text: t, font: '400 34px Jost', color: '#555' });
    return {
      left: textPlaque([f('←  Necklaces & Bracelets'), s('LEFT')], { bg: '#ffffff' }),
      right: textPlaque([f('Earrings & Pendants  →'), s('RIGHT')], { bg: '#ffffff' }),
      centre: textPlaque([f('Rings & Combos'), s('STRAIGHT AHEAD')], { bg: '#ffffff' }),
    };
  }, []);
  const sign = (t: THREE.Texture, pos: V3, rotY: number) => (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Box size={[1.36, 0.36, 0.03]} pos={[0, 0, -0.018]} mat="blackMetal" />
      <mesh>
        <planeGeometry args={[1.3, 0.325]} />
        <meshBasicMaterial map={t} toneMapped={false} />
      </mesh>
    </group>
  );
  return (
    <group>
      {/* Above each side doorway, readable from the junction. */}
      {sign(tex.left, [-PARTITION_X + 0.12, 3.3, (SIDE_DOOR.z0 + SIDE_DOOR.z1) / 2], Math.PI / 2)}
      {sign(tex.right, [PARTITION_X - 0.12, 3.3, (SIDE_DOOR.z0 + SIDE_DOOR.z1) / 2], -Math.PI / 2)}
      {/* Hanging over the way into the salon. */}
      <group>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 3.55, PARTITION_END_Z + 0.4]} material={mats().blackMetal}>
            <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
          </mesh>
        ))}
        {sign(tex.centre, [0, 3.15, PARTITION_END_Z + 0.4], 0)}
      </group>
    </group>
  );
}

function Interior({ logoWall }: { logoWall: THREE.Texture }) {
  const M = mats();
  const hw = HALF_W;
  const wallH = CEILING;
  const panels = useMemo(() => {
    const out: V3[] = [];
    for (let x = -6; x <= 6; x += 3) for (let z = -1.5; z >= -13; z -= 2.8) out.push([x, CEILING - 0.005, z]);
    return out;
  }, []);
  return (
    <group>
      {/* Floor and ceiling. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -DEPTH / 2]} material={M.floor}>
        <planeGeometry args={[hw * 2, DEPTH]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING, -DEPTH / 2]} material={M.ceiling}>
        <planeGeometry args={[hw * 2, DEPTH]} />
      </mesh>
      {panels.map((p, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={p} material={M.ceilingPanel}>
          <planeGeometry args={[1.4, 0.18]} />
        </mesh>
      ))}
      {/* Perimeter walls (interior faces). */}
      <Span a={[-hw - 0.1, 0, -DEPTH - 0.1]} b={[-hw + 0.1, wallH, 0]} mat="wall" />
      <Span a={[hw - 0.1, 0, -DEPTH - 0.1]} b={[hw + 0.1, wallH, 0]} mat="wall" />
      <Span a={[-hw, 0, -DEPTH - 0.1]} b={[hw, wallH, -DEPTH + 0.1]} mat="wall" />
      {/* Black skirting. */}
      <Span a={[-hw + 0.1, 0, -DEPTH]} b={[-hw + 0.12, 0.1, 0]} mat="blackSatin" />
      <Span a={[hw - 0.12, 0, -DEPTH]} b={[hw - 0.1, 0.1, 0]} mat="blackSatin" />
      <Span a={[-hw, 0, -DEPTH + 0.1]} b={[hw, 0.1, -DEPTH + 0.12]} mat="blackSatin" />
      {/* Partitions forming the U, with side doorways off the junction. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Span a={[s * PARTITION_X - 0.1, 0, SIDE_DOOR.z1]} b={[s * PARTITION_X + 0.1, wallH, -0.1]} mat="wall" />
          <Span a={[s * PARTITION_X - 0.1, 0, PARTITION_END_Z]} b={[s * PARTITION_X + 0.1, wallH, SIDE_DOOR.z0]} mat="wall" />
          <Span a={[s * PARTITION_X - 0.1, SIDE_DOOR.lintel, SIDE_DOOR.z0]} b={[s * PARTITION_X + 0.1, wallH, SIDE_DOOR.z1]} mat="wall" />
          {/* Black reveal around the side doorway. */}
          <Span a={[s * PARTITION_X - 0.14, 0, SIDE_DOOR.z0 - 0.04]} b={[s * PARTITION_X + 0.14, SIDE_DOOR.lintel, SIDE_DOOR.z0]} mat="blackMetal" />
          <Span a={[s * PARTITION_X - 0.14, 0, SIDE_DOOR.z1]} b={[s * PARTITION_X + 0.14, SIDE_DOOR.lintel, SIDE_DOOR.z1 + 0.04]} mat="blackMetal" />
          <Span a={[s * PARTITION_X - 0.14, SIDE_DOOR.lintel, SIDE_DOOR.z0 - 0.04]} b={[s * PARTITION_X + 0.14, SIDE_DOOR.lintel + 0.04, SIDE_DOOR.z1 + 0.04]} mat="blackMetal" />
          {/* Rounded black end column where each arm opens into the salon. */}
          <mesh position={[s * PARTITION_X, wallH / 2, PARTITION_END_Z]} material={M.blackSatin}>
            <cylinderGeometry args={[0.16, 0.16, wallH, 32]} />
          </mesh>
          {/* Linen wall panel behind the arm vitrines. */}
          <Span a={[s * (hw - 0.1), 0.1, -8.2]} b={[s * (hw - 0.12), 3.1, -1.0]} mat="linen" />
          {/* Long bench along the foyer-side of each arm. */}
          {BENCHES.filter((b) => Math.sign(b.x0) === s).map((b) => (
            <Box key={b.z0} size={[b.x1 - b.x0, 0.42, b.z1 - b.z0]} pos={[(b.x0 + b.x1) / 2, 0.21, (b.z0 + b.z1) / 2]} mat="velvet" />
          ))}
        </group>
      ))}
      <Atmosphere />
      {/* Brand wall behind the cashier. */}
      <mesh position={[0, 2.35, -DEPTH + 0.115]}>
        <planeGeometry args={[1.5, 0.61]} />
        <meshBasicMaterial map={logoWall} transparent toneMapped={false} />
      </mesh>
      <Span a={[CASHIER.x - 2.2, 0.1, -DEPTH + 0.1]} b={[CASHIER.x + 2.2, 3.5, -DEPTH + 0.11]} mat="linen" />
    </group>
  );
}

/**
 * Cheap lighting cues instead of extra real-time lights: ambient-occlusion gradients where walls
 * meet the floor, warm wall-washes above each vitrine and a lit cove along the ceiling.
 */
function Atmosphere() {
  const M = mats();
  const strips = useMemo(() => {
    // [x, z, length, rotationY] for floor-level AO along each wall run.
    const hw = HALF_W - 0.1;
    const list: [number, number, number, number][] = [
      [-hw, -DEPTH / 2, DEPTH, Math.PI / 2], [hw, -DEPTH / 2, DEPTH, -Math.PI / 2], [0, -DEPTH + 0.1, HALF_W * 2, 0],
      [0, -0.1, HALF_W * 2, Math.PI],
    ];
    for (const s of [-1, 1]) {
      list.push([s * (PARTITION_X + 0.1), (PARTITION_END_Z + SIDE_DOOR.z0) / 2, SIDE_DOOR.z0 - PARTITION_END_Z, s * Math.PI / 2]);
      list.push([s * (PARTITION_X - 0.1), (PARTITION_END_Z + SIDE_DOOR.z0) / 2, SIDE_DOOR.z0 - PARTITION_END_Z, -s * Math.PI / 2]);
      list.push([s * (PARTITION_X + 0.1), SIDE_DOOR.z1 / 2, -SIDE_DOOR.z1, s * Math.PI / 2]);
      list.push([s * (PARTITION_X - 0.1), SIDE_DOOR.z1 / 2, -SIDE_DOOR.z1, -s * Math.PI / 2]);
    }
    return list;
  }, []);
  return (
    <group>
      {strips.map(([x, z, len, ry], i) => (
        // Plane lies on the floor, dark edge against the wall, fading into the room.
        <group key={i} position={[x, 0.003, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0, 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={M.ao}>
            <planeGeometry args={[len, 0.6]} />
          </mesh>
        </group>
      ))}
      {/* Warm washes on the linen panels above each arm vitrine. */}
      {DISPLAYS.filter((d) => d.style === 'tall').map((d) => {
        const s = Math.sign(d.x);
        return (
          <mesh key={d.sku} position={[s * (HALF_W - 0.125), 2.25, d.z]} rotation={[0, -s * Math.PI / 2, 0]} material={M.wash}>
            <planeGeometry args={[1.3, 2.2]} />
          </mesh>
        );
      })}
      {/* Wash behind the cashier and brand wall. */}
      <mesh position={[0, 2.4, -DEPTH + 0.12]} material={M.wash}>
        <planeGeometry args={[4.2, 2.6]} />
      </mesh>
      {/* Ceiling cove along the perimeter. */}
      <Span a={[-HALF_W + 0.1, CEILING - 0.14, -DEPTH + 0.1]} b={[-HALF_W + 0.16, CEILING - 0.1, -0.2]} mat="cove" />
      <Span a={[HALF_W - 0.16, CEILING - 0.14, -DEPTH + 0.1]} b={[HALF_W - 0.1, CEILING - 0.1, -0.2]} mat="cove" />
      <Span a={[-HALF_W + 0.1, CEILING - 0.14, -DEPTH + 0.1]} b={[HALF_W - 0.1, CEILING - 0.1, -DEPTH + 0.16]} mat="cove" />
    </group>
  );
}

export default function Architecture() {
  // Load textures here so nothing below suspends while it is being merged.
  const [plaque, logoWall] = useLoader(THREE.TextureLoader, ['/brand/ishe-logo-plaque.png', '/brand/ishe-wordmark-black.png']);
  for (const t of [plaque, logoWall]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  const fontsReady = useFontsReady();
  return (
    <group>
      {fontsReady && <Merged>
        <Street />
        <Facade plaque={plaque} />
        <Interior logoWall={logoWall} />
        <Wayfinding />
      </Merged>}
      <Doors />
    </group>
  );
}
