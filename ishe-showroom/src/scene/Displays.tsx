'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { PRODUCT_BY_SKU, COMBOS, formatINR } from '@/data/catalogue';
import { DISPLAYS, COMBO_TABLE, CASHIER, type DisplaySpec } from './layout';
import { buildPiece } from './jewellery';
import { mats, textPlaque } from './materials';
import { Box } from './Architecture';
import { useShowroom } from '@/store/showroom';
import { pointerWasDrag } from './input';

const TALL_TOP = 0.9;
const TABLE_TOP = 0.85;

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fonts = document.fonts;
    Promise.all([
      fonts.load('500 60px "Cormorant Garamond"'),
      fonts.load('400 30px Jost'),
    ]).catch(() => undefined).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  return ready;
}

function Plaque({ sku, width, y, z }: { sku: string; width: number; y: number; z: number }) {
  const p = PRODUCT_BY_SKU[sku];
  const tex = useMemo(
    () => textPlaque([
      { text: p.name, font: '500 64px "Cormorant Garamond"' },
      { text: `${p.sku}  ·  ${formatINR(p.priceINR)} SAMPLE`, font: '400 30px Jost', color: '#b9b2a4' },
    ], { w: 1024, h: 220 }),
    [p],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, y, z]} rotation={[-0.12, 0, 0]}>
      <planeGeometry args={[width, width * (220 / 1024)]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** Glass as separate panes (no bottom face) so nothing z-fights with the deck. */
function GlassPanes({ w, d, y0, y1, top }: { w: number; d: number; y0: number; y1: number; top: boolean }) {
  const M = mats();
  const h = y1 - y0, cy = (y0 + y1) / 2;
  return (
    <group>
      <mesh position={[0, cy, d / 2]} material={M.glass}><planeGeometry args={[w, h]} /></mesh>
      <mesh position={[0, cy, -d / 2]} material={M.glass}><planeGeometry args={[w, h]} /></mesh>
      <mesh position={[w / 2, cy, 0]} rotation={[0, Math.PI / 2, 0]} material={M.glass}><planeGeometry args={[d, h]} /></mesh>
      <mesh position={[-w / 2, cy, 0]} rotation={[0, Math.PI / 2, 0]} material={M.glass}><planeGeometry args={[d, h]} /></mesh>
      {top && <mesh position={[0, y1, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.glass}><planeGeometry args={[w, d]} /></mesh>}
    </group>
  );
}

function Case({ spec }: { spec: DisplaySpec }) {
  const M = mats();
  const { w, d, h } = spec;
  const tall = spec.style === 'tall';
  const top = tall ? TALL_TOP : TABLE_TOP;
  const glassTop = tall ? h - 0.08 : h;
  const glassH = glassTop - top;
  const gw = w - 0.02, gd = d - 0.02;
  const posts: [number, number][] = [[-gw / 2, -gd / 2], [gw / 2, -gd / 2], [-gw / 2, gd / 2], [gw / 2, gd / 2]];
  return (
    <group>
      {/* Base cabinet on a recessed black plinth. */}
      <Box size={[w, top - 0.07, d]} pos={[0, (top - 0.07) / 2 + 0.06, 0]} mat="blackSatin" />
      <Box size={[w - 0.06, 0.06, d - 0.06]} pos={[0, 0.03, 0]} mat="blackMetal" />
      {/* Deck the jewellery sits on. */}
      <Box size={[w, 0.012, d]} pos={[0, top - 0.006, 0]} mat={tall ? 'linen' : 'blackSatin'} />
      {tall && <Box size={[gw - 0.02, glassH, 0.01]} pos={[0, top + glassH / 2, -gd / 2 + 0.012]} mat="linen" />}
      <GlassPanes w={gw} d={gd} y0={top + 0.001} y1={glassTop} top={!tall} />
      {posts.map(([x, z], i) => (
        <Box key={i} size={[0.012, glassH, 0.012]} pos={[x, top + glassH / 2, z]} mat="blackMetal" />
      ))}
      {tall ? (
        <>
          <Box size={[w, 0.08, d]} pos={[0, h - 0.04, 0]} mat="blackSatin" />
          <mesh position={[0, h - 0.081, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.lightStrip}>
            <planeGeometry args={[w * 0.7, 0.03]} />
          </mesh>
        </>
      ) : (
        // Slim black frame around the glass lid.
        <>
          <Box size={[gw + 0.012, 0.012, 0.012]} pos={[0, glassTop, gd / 2]} mat="blackMetal" />
          <Box size={[gw + 0.012, 0.012, 0.012]} pos={[0, glassTop, -gd / 2]} mat="blackMetal" />
          <Box size={[0.012, 0.012, gd]} pos={[gw / 2, glassTop, 0]} mat="blackMetal" />
          <Box size={[0.012, 0.012, gd]} pos={[-gw / 2, glassTop, 0]} mat="blackMetal" />
        </>
      )}
      {/* Faked contact shadow. */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.shadow}>
        <planeGeometry args={[w * 1.9, d * 1.9]} />
      </mesh>
    </group>
  );
}

function Display({ spec, fontsReady }: { spec: DisplaySpec; fontsReady: boolean }) {
  const product = PRODUCT_BY_SKU[spec.sku];
  const top = spec.style === 'tall' ? TALL_TOP : TABLE_TOP;
  const piece = useMemo(() => buildPiece(product, { riser: spec.style === 'tall' && spec.kind === 'earringStand' ? 0.2 : 0 }), [product, spec]);
  const glow = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const selected = useShowroom((s) => s.view.kind === 'product' && s.view.sku === spec.sku);
  const highlight = useMemo(() => mats().highlight.clone(), []);

  useFrame((_, dt) => {
    const target = selected ? 0.55 : hover ? 0.4 : 0;
    highlight.opacity += (target - highlight.opacity) * Math.min(1, dt * 6);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (pointerWasDrag()) return;
    const s = useShowroom.getState();
    if (s.phase !== 'inside' || s.moving) return;
    s.goTo({ kind: 'product', sku: spec.sku });
  };

  return (
    <group
      position={[spec.x, 0, spec.z]}
      rotation={[0, spec.rotY, 0]}
      onClick={onClick}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      name={`display-${spec.sku}`}
    >
      <Case spec={spec} />
      <primitive object={piece} position={[0, top, 0]} />
      {/* Warm pool of light on the deck; brightens on hover/selection. */}
      <mesh position={[0, top + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats().pool}>
        <planeGeometry args={[spec.w * 0.9, spec.d * 0.9]} />
      </mesh>
      <mesh ref={glow} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={highlight}>
        <planeGeometry args={[spec.w * 2.2, spec.d * 2.2]} />
      </mesh>
      {fontsReady && <Plaque sku={spec.sku} width={Math.min(0.5, spec.w * 0.8)} y={spec.style === 'tall' ? 0.72 : 0.68} z={spec.d / 2 + 0.004} />}
    </group>
  );
}

function ComboTable({ fontsReady }: { fontsReady: boolean }) {
  const M = mats();
  const pieces = useMemo(() => {
    // Small tokens of each paired item's tone laid out in pairs; the full pieces live in their rooms.
    const tex = fontsReady
      ? textPlaque([
          { text: 'Combos', font: '500 96px "Cormorant Garamond"' },
          { text: `${COMBOS.length} CURATED PAIRINGS`, font: '400 32px Jost', color: '#b9b2a4' },
        ], { w: 1024, h: 300 })
      : null;
    return { tex };
  }, [fontsReady]);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (pointerWasDrag()) return;
    const s = useShowroom.getState();
    if (s.phase === 'inside' && !s.moving) s.goTo({ kind: 'combos' });
  };
  return (
    <group position={[COMBO_TABLE.x, 0, COMBO_TABLE.z]} onClick={onClick} name="display-combos"
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <mesh position={[0, 0.03, 0]} material={M.blackMetal}><cylinderGeometry args={[0.3, 0.34, 0.06, 48]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h / 2, 0]} material={M.blackSatin}><cylinderGeometry args={[0.07, 0.07, COMBO_TABLE.h, 24]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h, 0]} material={M.blackSatin}><cylinderGeometry args={[COMBO_TABLE.r, COMBO_TABLE.r, 0.04, 64]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h + 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.linen}><circleGeometry args={[COMBO_TABLE.r - 0.04, 64]} /></mesh>
      {/* Five paired trays, one per combo. */}
      {COMBOS.map((c, i) => {
        const a = (i / COMBOS.length) * Math.PI * 2 + Math.PI / 2;
        const r = 0.24;
        return (
          <group key={c.id} position={[Math.cos(a) * r, COMBO_TABLE.h + 0.03, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <Box size={[0.1, 0.01, 0.16]} pos={[0, 0, 0]} mat="velvet" />
            {c.skus.map((sku, k) => {
              const tone = PRODUCT_BY_SKU[sku].tone;
              return (
                <mesh key={sku} position={[0, 0.012, k ? 0.04 : -0.04]} rotation={[Math.PI / 2, 0, 0]} material={tone === 'silver-tone' ? M.silver : tone === 'rose-tone' ? M.rose : M.gold}>
                  <torusGeometry args={[0.022, 0.004, 10, 40]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {pieces.tex && (
        // Tent card at the front edge of the table.
        <group position={[0, COMBO_TABLE.h + 0.075, COMBO_TABLE.r - 0.05]} rotation={[-0.25, 0, 0]}>
          <Box size={[0.3, 0.095, 0.008]} pos={[0, 0, -0.006]} mat="blackMetal" />
          <mesh><planeGeometry args={[0.29, 0.087]} /><meshBasicMaterial map={pieces.tex} toneMapped={false} /></mesh>
        </group>
      )}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.shadow}><circleGeometry args={[0.8, 32]} /></mesh>
    </group>
  );
}

function Cashier() {
  const M = mats();
  const checkout = useShowroom((s) => s.checkout);
  const first = checkout?.lines[0] ? PRODUCT_BY_SKU[checkout.lines[0].sku] : null;
  const piece = useMemo(() => (first ? buildPiece(first) : null), [first]);
  return (
    <group position={[CASHIER.x, 0, CASHIER.z]} name="cashier-counter">
      {/* Counter: black body, white stone top, brass-free minimal detailing. */}
      <Box size={[CASHIER.w, CASHIER.h - 0.04, CASHIER.d]} pos={[0, (CASHIER.h - 0.04) / 2, 0]} mat="blackSatin" />
      <Box size={[CASHIER.w + 0.06, 0.04, CASHIER.d + 0.06]} pos={[0, CASHIER.h - 0.02, 0]} mat="wall" />
      <Box size={[CASHIER.w - 0.1, 0.05, 0.02]} pos={[0, 0.9, CASHIER.d / 2 + 0.005]} mat="lightStrip" />
      {/* Card terminal and a closed ledger. */}
      <Box size={[0.08, 0.02, 0.16]} pos={[0.95, CASHIER.h + 0.01, -0.05]} mat="blackMetal" />
      <Box size={[0.07, 0.12, 0.012]} pos={[0.95, CASHIER.h + 0.07, -0.1]} rot={[-0.35, 0, 0]} mat="blackMetal" />
      <Box size={[0.3, 0.025, 0.22]} pos={[-0.85, CASHIER.h + 0.012, -0.05]} mat="linen" />
      {/* Presentation tray: the selected piece is placed here during checkout. */}
      <Box size={[0.42, 0.02, 0.3]} pos={[0, CASHIER.h + 0.01, 0.02]} mat="velvet" />
      {piece && <primitive object={piece} position={[0, CASHIER.h + 0.02, 0.02]} rotation={[0, 0, 0]} scale={first?.category === 'necklace' ? 0.55 : 1} />}
      <mesh position={[0, CASHIER.h + 0.021, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={M.pool}><planeGeometry args={[0.5, 0.4]} /></mesh>
      {/* Staff-side back shelf against the brand wall. */}
      <Box size={[CASHIER.w + 0.8, 0.9, 0.26]} pos={[0, 0.45, -0.92]} mat="blackSatin" />
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.shadow}><planeGeometry args={[CASHIER.w * 1.4, 1.6]} /></mesh>
    </group>
  );
}

export default function Displays() {
  const fontsReady = useFontsReady();
  return (
    <group>
      {DISPLAYS.map((d) => <Display key={d.sku} spec={d} fontsReady={fontsReady} />)}
      <ComboTable fontsReady={fontsReady} />
      <Cashier />
    </group>
  );
}
