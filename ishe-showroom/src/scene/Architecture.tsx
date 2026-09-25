'use client';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { mats, textPlaque, type MatKey } from './materials';
import { CEILING, COLUMN, DEPTH, FAR_END_Z, FRONT_DOOR, HALF_W } from './layout';
import { useShowroom } from '@/store/showroom';
import { CURTAINS, PILASTER, PILASTER_Z, SALON, THRESHOLDS } from './features';
import { DISPLAYS } from './layout';
import Merged from './Merged';
import Decor from './Decor';
import BakedSurfaces from './BakedSurfaces';
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

/** The official wordmark recoloured white (same artwork, alpha kept), for dark signs and walls. */
function whiteWordmark(src: THREE.Texture) {
  const img = src.image as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const WORDMARK_ASPECT = 315 / 774;

/** Rusticated limestone: shallow horizontal joints every 45 cm across a facade panel. */
function Joints({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  const rows: number[] = [];
  for (let y = Math.ceil((y0 + 0.05) / 0.45) * 0.45; y < y1 - 0.05; y += 0.45) rows.push(y);
  return (
    <group>
      {rows.map((y) => <Box key={y} size={[Math.abs(x1 - x0), 0.014, 0.01]} pos={[(x0 + x1) / 2, y, 0.103]} mat="limestoneJoint" />)}
    </group>
  );
}

function Facade({ logo }: { logo: THREE.Texture }) {
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
          <Joints x0={s * hw} x1={s * (WIN.x1 + 0.04)} y0={0.3} y1={FACADE_H - 0.1} />
          <Joints x0={s * (WIN.x0 - 0.04)} x1={s * (dw + 0.1)} y0={0.3} y1={FACADE_H - 0.1} />
          <Joints x0={s * (WIN.x1 + 0.04)} x1={s * (WIN.x0 - 0.04)} y0={WIN.y1 + 0.04} y1={FACADE_H - 0.1} />
          {/* Window glass and black frame. */}
          <mesh position={[s * (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, 0]} material={mats().doorGlass}>
            <planeGeometry args={[WIN.x1 - WIN.x0, WIN.y1 - WIN.y0]} />
          </mesh>
          <Frame x={s * (WIN.x0 + WIN.x1) / 2} y={(WIN.y0 + WIN.y1) / 2} w={WIN.x1 - WIN.x0} h={WIN.y1 - WIN.y0} t={0.07} z={0.1} />
          <Box size={[0.05, WIN.y1 - WIN.y0, 0.08]} pos={[s * (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, 0.06]} mat="blackMetal" />
          {/* Tall linear sconce on each pier beside the door: dark bronze body, warm glowing lens. */}
          <Box size={[0.1, 0.62, 0.1]} pos={[s * 1.65, 2.35, 0.16]} mat="blackMetal" />
          <Box size={[0.05, 0.52, 0.02]} pos={[s * 1.65, 2.35, 0.215]} mat="sconce" />
          {/* Square tapered black planter with a clipped boxwood ball. */}
          <mesh position={[s * 1.75, 0.38, 0.55]} rotation={[0, Math.PI / 4, 0]} material={mats().planter}>
            <cylinderGeometry args={[0.36, 0.28, 0.76, 4]} />
          </mesh>
          <mesh position={[s * 1.75, 1.08, 0.55]} material={mats().plant} scale={[1, 1.05, 1]}>
            <icosahedronGeometry args={[0.36, 3]} />
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
      {/* Sign: the official ISHÉ wordmark in white on a black lacquered fascia with a bronze edge. */}
      <group position={[0, 3.62, 0.13]}>
        <Box size={[2.5, 1.1, 0.07]} pos={[0, 0, 0]} mat="bronze" />
        <Box size={[2.42, 1.02, 0.08]} pos={[0, 0, 0.002]} mat="ebony" />
        <mesh position={[0, 0, 0.043]}>
          <planeGeometry args={[1.9, 1.9 * WORDMARK_ASPECT]} />
          <meshBasicMaterial map={logo} transparent toneMapped={false} />
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
        <mesh key={z} position={[dir * (w - 0.16), 1.1, z]} material={mats().bronze}>
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
      <Box size={[1.36, 0.36, 0.03]} pos={[0, 0, -0.018]} mat="bronze" />
      <mesh>
        <planeGeometry args={[1.3, 0.325]} />
        <meshBasicMaterial map={t} toneMapped={false} />
      </mesh>
    </group>
  );
  return (
    <group>
      {/* Hung between the first two columns on each side, facing the aisle; readable from the junction. */}
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          {[-0.5, 0.5].map((dz) => (
            <mesh key={dz} position={[s * COLUMN.x, 3.55, -3.7 + dz]} material={mats().bronze}>
              <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
            </mesh>
          ))}
          {sign(s < 0 ? tex.left : tex.right, [s * COLUMN.x, 3.15, -3.7], s < 0 ? Math.PI / 2 : -Math.PI / 2)}
        </group>
      ))}
      {/* Hanging over the aisle where it opens into the far end. */}
      <group>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 3.55, FAR_END_Z + 0.2]} material={mats().bronze}>
            <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
          </mesh>
        ))}
        {sign(tex.centre, [0, 3.15, FAR_END_Z + 0.2], 0)}
      </group>
    </group>
  );
}

function Interior({ logoWall }: { logoWall: THREE.Texture }) {
  const M = mats();
  const hw = HALF_W;
  const wallH = CEILING;
  return (
    <group>
      {/* Floor and ceiling surfaces with baked light live in BakedSurfaces.tsx. */}
      {/* Perimeter walls (interior faces). */}
      <Span a={[-hw - 0.1, 0, -DEPTH - 0.1]} b={[-hw + 0.1, wallH, 0]} mat="wall" />
      <Span a={[hw - 0.1, 0, -DEPTH - 0.1]} b={[hw + 0.1, wallH, 0]} mat="wall" />
      <Span a={[-hw, 0, -DEPTH - 0.1]} b={[hw, wallH, -DEPTH + 0.1]} mat="wall" />
      {/* Black skirting. */}
      <Span a={[-hw + 0.1, 0, -DEPTH]} b={[-hw + 0.12, 0.1, 0]} mat="blackSatin" />
      <Span a={[hw - 0.12, 0, -DEPTH]} b={[hw - 0.1, 0.1, 0]} mat="blackSatin" />
      <Span a={[-hw, 0, -DEPTH + 0.1]} b={[hw, 0.1, -DEPTH + 0.12]} mat="blackSatin" />
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* White pilasters on the outer walls, each with a tall brass linear sconce. */}
          {PILASTER_Z[s < 0 ? 'left' : 'right'].map((z) => (
            <group key={z}>
              <Box size={[PILASTER.d, wallH, PILASTER.w]} pos={[s * (hw - 0.1 - PILASTER.d / 2), wallH / 2, z]} mat="wall" />
              <Box size={[PILASTER.d + 0.01, 0.1, PILASTER.w + 0.01]} pos={[s * (hw - 0.1 - PILASTER.d / 2), 0.05, z]} mat="blackSatin" />
              <Box size={[0.03, 0.62, 0.07]} pos={[s * (hw - 0.1 - PILASTER.d - 0.015), 2.25, z]} mat="brass" />
              <Box size={[0.01, 0.54, 0.035]} pos={[s * (hw - 0.1 - PILASTER.d - 0.032), 2.25, z]} mat="sconce" />
            </group>
          ))}
          {/* The colonnade: square white columns on black bases, a brass linear sconce facing the aisle. */}
          {COLUMN.z.map((z) => (
            <group key={z} position={[s * COLUMN.x, 0, z]}>
              <Box size={[COLUMN.size, wallH, COLUMN.size]} pos={[0, wallH / 2, 0]} mat="wall" />
              <Box size={[COLUMN.size + 0.02, 0.12, COLUMN.size + 0.02]} pos={[0, 0.06, 0]} mat="blackSatin" />
              <Box size={[COLUMN.size + 0.06, 0.08, COLUMN.size + 0.06]} pos={[0, wallH - 0.04, 0]} mat="wall" />
              {[-1, 1].map((f) => (
                <group key={f}>
                  <Box size={[0.03, 0.62, 0.07]} pos={[f * (COLUMN.size / 2 + 0.015), 2.25, 0]} mat="brass" />
                  <Box size={[0.01, 0.54, 0.035]} pos={[f * (COLUMN.size / 2 + 0.032), 2.25, 0]} mat="sconce" />
                </group>
              ))}
            </group>
          ))}
          {/* Linear light slots in the ceiling along the aisle, as in a gallery. */}
          <mesh position={[s * 1.25, CEILING - 0.006, (FAR_END_Z - 0.6) / 2]} rotation={[Math.PI / 2, 0, 0]} material={M.lightStrip}>
            <planeGeometry args={[0.04, -FAR_END_Z - 0.6]} />
          </mesh>
        </group>
      ))}
      <Atmosphere />
      {/* The wordmark in white on the black feature wall, above the hero pedestal. */}
      <mesh position={[0, 2.75, -DEPTH + 0.14]}>
        <planeGeometry args={[1.5, 1.5 * WORDMARK_ASPECT]} />
        <meshBasicMaterial map={logoWall} transparent toneMapped={false} />
      </mesh>
      <SalonWalls />
    </group>
  );
}

/** Warm wall-washes above each vitrine and the lit cove along the ceiling (on top of the bake). */
function Atmosphere() {
  const M = mats();
  return (
    <group>
      {/* Warm washes on the linen panels above each arm vitrine. */}
      {DISPLAYS.filter((d) => d.style === 'tall' && Math.abs(d.x) > 5).map((d) => {
        const s = Math.sign(d.x);
        return (
          <mesh key={d.sku} position={[s * (HALF_W - 0.135), 2.25, d.z]} rotation={[0, -s * Math.PI / 2, 0]} material={M.wash}>
            <planeGeometry args={[1.3, 2.2]} />
          </mesh>
        );
      })}
      {/* Wash on the feature wall behind the hero pedestal. */}
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

/**
 * Rings & Combos salon: a black lacquered feature wall with thin warm light slits and a slim brass
 * frame round the wordmark, under a lowered white tray edged with a warm cove.
 */
function SalonWalls() {
  const z = -DEPTH + 0.1;
  const t = SALON.trayY;
  const slits = [-1.9, -1.08, 1.08, 1.9];
  return (
    <group>
      <Span a={[-2.6, 0.1, z]} b={[2.6, t, z + 0.03]} mat="ebony" />
      {slits.map((x) => <Span key={x} a={[x - 0.006, 0.25, z + 0.03]} b={[x + 0.006, t - 0.15, z + 0.034]} mat="lightStrip" />)}
      {/* Brass frame round the wordmark panel. */}
      <Span a={[-1.02, 2.3, z + 0.03]} b={[1.02, 2.32, z + 0.036]} mat="brass" />
      <Span a={[-1.02, 3.18, z + 0.03]} b={[1.02, 3.2, z + 0.036]} mat="brass" />
      <Span a={[-1.02, 2.3, z + 0.03]} b={[-1.0, 3.2, z + 0.036]} mat="brass" />
      <Span a={[1.0, 2.3, z + 0.03]} b={[1.02, 3.2, z + 0.036]} mat="brass" />
      <Span a={[-2.6, t - 0.03, z]} b={[2.6, t, z + 0.05]} mat="brass" />
      {/* Lowered tray: white soffit and fascia, warm cove light along its edge. */}
      <mesh position={[0, t, (SALON.z0 + SALON.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats().bronzeCeiling}>
        <planeGeometry args={[SALON.x1 - SALON.x0, SALON.z1 - SALON.z0]} />
      </mesh>
      <Span a={[SALON.x0, t - 0.02, SALON.z1 - 0.02]} b={[SALON.x1, CEILING, SALON.z1]} mat="wall" />
      <Span a={[SALON.x0 - 0.02, t - 0.02, SALON.z0]} b={[SALON.x0, CEILING, SALON.z1]} mat="wall" />
      <Span a={[SALON.x1, t - 0.02, SALON.z0]} b={[SALON.x1 + 0.02, CEILING, SALON.z1]} mat="wall" />
      <mesh position={[0, t - 0.021, SALON.z1 - 0.06]} rotation={[Math.PI / 2, 0, 0]} material={mats().cove}>
        <planeGeometry args={[SALON.x1 - SALON.x0 - 0.1, 0.03]} />
      </mesh>
      {[SALON.x0 + 0.06, SALON.x1 - 0.06].map((x) => (
        <mesh key={x} position={[x, t - 0.021, (SALON.z0 + SALON.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats().cove}>
          <planeGeometry args={[0.03, SALON.z1 - SALON.z0 - 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

/** Crown moulding along every wall head: two stepped ivory profiles. */
function Moulding() {
  const runs: { axis: 'x' | 'z'; at: number; from: number; to: number; out: 1 | -1 }[] = [
    { axis: 'x', at: -HALF_W + 0.1, from: -DEPTH + 0.1, to: -0.1, out: 1 },
    { axis: 'x', at: HALF_W - 0.1, from: -DEPTH + 0.1, to: -0.1, out: -1 },
    { axis: 'z', at: -DEPTH + 0.1, from: -HALF_W + 0.1, to: SALON.x0, out: 1 },
    { axis: 'z', at: -DEPTH + 0.1, from: SALON.x1, to: HALF_W - 0.1, out: 1 },
    { axis: 'z', at: -0.1, from: -HALF_W + 0.1, to: HALF_W - 0.1, out: -1 },
  ];
  return (
    <group>
      {runs.flatMap((r, i) => [[0.07, 0.05, 0], [0.035, 0.035, 0.05]].map(([depth, h, drop], k) => {
        const y = CEILING - drop - h / 2;
        const c = r.at + (r.out * depth) / 2;
        const len = r.to - r.from, mid = (r.from + r.to) / 2;
        return r.axis === 'x'
          ? <Box key={`${i}-${k}`} size={[depth, h, len]} pos={[c, y, mid]} mat="wall" />
          : <Box key={`${i}-${k}`} size={[len, h, depth]} pos={[mid, y, c]} mat="wall" />;
      }))}
    </group>
  );
}

/** Brass inlay strips at each doorway threshold (flush with the stone). */
function Thresholds() {
  return (
    <group>
      {THRESHOLDS.map((b, i) => (
        <Box key={i} size={[b.x1 - b.x0, 0.004, b.z1 - b.z0]} pos={[(b.x0 + b.x1) / 2, 0.004, (b.z0 + b.z1) / 2]} mat="brass" />
      ))}
    </group>
  );
}

/** Sheer curtains drawn to either side of each shop window, on a slim bronze rod. */
function Curtains() {
  return (
    <group>
      {CURTAINS.map((c) => (
        <group key={c.x0}>
          <Box size={[c.x1 - c.x0 - 0.02, 0.02, 0.02]} pos={[(c.x0 + c.x1) / 2, 3.28, -0.24]} mat="bronze" />
          {[c.x0 + 0.65, c.x1 - 0.65].map((x) => (
            <mesh key={x} position={[x, 1.75, -0.24]} material={mats().sheer}>
              <planeGeometry args={[1.3, 3.05]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function Architecture() {
  // Load textures here so nothing below suspends while it is being merged.
  const wordmark = useLoader(THREE.TextureLoader, '/brand/ishe-wordmark-black.png');
  const logo = useMemo(() => whiteWordmark(wordmark), [wordmark]);
  const fontsReady = useFontsReady();
  return (
    <group>
      {fontsReady && <Merged>
        <Street />
        <Facade logo={logo} />
        <Interior logoWall={logo} />
        <Wayfinding />
        <Moulding />
        <Thresholds />
        <Curtains />
        <Decor />
      </Merged>}
      <BakedSurfaces />
      <Doors />
    </group>
  );
}
