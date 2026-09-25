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
import { useFontsReady } from './fonts';
import Merged from './Merged';

const HIT = new THREE.MeshBasicMaterial({ visible: false });

const TALL_TOP = 0.9;
const TABLE_TOP = 0.85;

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
      <Box size={[w, 0.012, d]} pos={[0, top - 0.006, 0]} mat="taupeVelvet" />
      {tall && <Box size={[gw - 0.02, glassH, 0.01]} pos={[0, top + glassH / 2, -gd / 2 + 0.012]} mat="taupeVelvet" />}
      <GlassPanes w={gw} d={gd} y0={top + 0.001} y1={glassTop} top={!tall} />
      {posts.map(([x, z], i) => (
        <Box key={i} size={[tall ? 0.012 : 0.007, glassH, tall ? 0.012 : 0.007]} pos={[x, top + glassH / 2, z]} mat="bronze" />
      ))}
      {tall ? (
        <>
          <Box size={[w, 0.08, d]} pos={[0, h - 0.04, 0]} mat="blackSatin" />
          <mesh position={[0, h - 0.081, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.lightStrip}>
            <planeGeometry args={[w * 0.7, 0.03]} />
          </mesh>
        </>
      ) : (
        // Slim black frame on the back and sides of the lid; the front edge is frameless so the
        // visitor's line of sight onto the piece stays clear.
        <>
          <Box size={[gw + 0.007, 0.007, 0.007]} pos={[0, glassTop, -gd / 2]} mat="bronze" />
          <Box size={[0.007, 0.007, gd]} pos={[gw / 2, glassTop, 0]} mat="bronze" />
          <Box size={[0.007, 0.007, gd]} pos={[-gw / 2, glassTop, 0]} mat="bronze" />
          <TableMirror x={gw / 2 - 0.07} y={glassTop} z={-gd / 2 + 0.07} />
        </>
      )}
      {/* Warm pool of light on the deck. */}
      <mesh position={[0, top + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.pool}>
        <planeGeometry args={[w * 0.9, d * 0.9]} />
      </mesh>
    </group>
  );
}

/** Small stand try-on mirror on the glass lid of a table vitrine (tilted toward the visitor). */
function TableMirror({ x, y, z }: { x: number; y: number; z: number }) {
  const M = mats();
  return (
    <group position={[x, y, z]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.006, 0]} material={M.bronze}><cylinderGeometry args={[0.035, 0.04, 0.012, 24]} /></mesh>
      <mesh position={[0, 0.05, 0]} material={M.bronze}><cylinderGeometry args={[0.004, 0.004, 0.08, 8]} /></mesh>
      <group position={[0, 0.14, 0]} rotation={[-0.12, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[0.075, 1, 0.1]} material={M.bronze}><cylinderGeometry args={[1, 1, 0.01, 32]} /></mesh>
        <mesh position={[0, 0, 0.006]} scale={[0.066, 0.09, 1]} material={M.mirror}><circleGeometry args={[1, 32]} /></mesh>
      </group>
    </group>
  );
}

function Display({ spec, fontsReady }: { spec: DisplaySpec; fontsReady: boolean }) {
  const product = PRODUCT_BY_SKU[spec.sku];
  const top = spec.style === 'tall' ? TALL_TOP : TABLE_TOP;
  const piece = useMemo(() => buildPiece(product, { riser: spec.style === 'tall' && spec.kind === 'earringStand' ? 0.2 : 0 }), [product, spec]);
  const [hover, setHover] = useState(false);
  const selected = useShowroom((s) => s.view.kind === 'product' && s.view.sku === spec.sku);
  const highlight = useMemo(() => mats().highlight.clone(), []);

  const [glow, setGlow] = useState<THREE.Mesh | null>(null);
  useFrame((_, dt) => {
    const target = selected ? 0.55 : hover ? 0.4 : 0;
    highlight.opacity += (target - highlight.opacity) * Math.min(1, dt * 6);
    if (glow) glow.visible = highlight.opacity > 0.01;
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
      {/* Invisible hit volume: the case itself is merged into static geometry. */}
      <mesh position={[0, spec.h / 2, 0]} material={HIT}>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
      </mesh>
      <primitive object={piece} position={[0, top, 0]} />
      {/* Floor glow that rises on hover / selection. */}
      <mesh ref={setGlow} visible={false} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={highlight}>
        <planeGeometry args={[spec.w * 2.2, spec.d * 2.2]} />
      </mesh>
      {fontsReady && <Plaque sku={spec.sku} width={Math.min(0.5, spec.w * 0.8)} y={spec.style === 'tall' ? 0.72 : 0.68} z={spec.d / 2 + 0.004} />}
    </group>
  );
}

function comboTexture() {
  return textPlaque([
    { text: 'Combos', font: '500 96px "Cormorant Garamond"' },
    { text: `${COMBOS.length} CURATED PAIRINGS`, font: '400 32px Jost', color: '#b9b2a4' },
  ], { w: 1024, h: 300 });
}

function ComboTableStatic() {
  const M = mats();
  const tex = useMemo(comboTexture, []);
  return (
    <group position={[COMBO_TABLE.x, 0, COMBO_TABLE.z]}>
      <mesh position={[0, 0.03, 0]} material={M.blackMetal}><cylinderGeometry args={[0.3, 0.34, 0.06, 48]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h / 2, 0]} material={M.blackSatin}><cylinderGeometry args={[0.07, 0.07, COMBO_TABLE.h, 24]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h, 0]} material={M.blackSatin}><cylinderGeometry args={[COMBO_TABLE.r, COMBO_TABLE.r, 0.04, 64]} /></mesh>
      <mesh position={[0, COMBO_TABLE.h + 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.linen}><circleGeometry args={[COMBO_TABLE.r - 0.04, 64]} /></mesh>
      {/* Five velvet trays, one per combo, each holding tokens in the paired pieces' tones. */}
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
      {/* Tent card at the front edge of the table. */}
      <group position={[0, COMBO_TABLE.h + 0.075, COMBO_TABLE.r - 0.05]} rotation={[-0.25, 0, 0]}>
        <Box size={[0.3, 0.095, 0.008]} pos={[0, 0, -0.006]} mat="blackMetal" />
        <mesh><planeGeometry args={[0.29, 0.087]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

function ComboTableHit() {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (pointerWasDrag()) return;
    const s = useShowroom.getState();
    if (s.phase === 'inside' && !s.moving) s.goTo({ kind: 'combos' });
  };
  return (
    <mesh position={[COMBO_TABLE.x, 0.55, COMBO_TABLE.z]} material={HIT} onClick={onClick} name="display-combos"
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <cylinderGeometry args={[COMBO_TABLE.r, COMBO_TABLE.r, 1.1, 16]} />
    </mesh>
  );
}

function CashierStatic() {
  const M = mats();
  return (
    <group position={[CASHIER.x, 0, CASHIER.z]}>
      {/* Counter: black body, white stone top, lit kick strip. */}
      <Box size={[CASHIER.w, CASHIER.h - 0.04, CASHIER.d]} pos={[0, (CASHIER.h - 0.04) / 2, 0]} mat="blackSatin" />
      <Box size={[CASHIER.w + 0.06, 0.04, CASHIER.d + 0.06]} pos={[0, CASHIER.h - 0.02, 0]} mat="travertine" />
      <Box size={[CASHIER.w - 0.1, 0.05, 0.02]} pos={[0, 0.9, CASHIER.d / 2 + 0.005]} mat="lightStrip" />
      {/* Card terminal and a closed ledger. */}
      <Box size={[0.08, 0.02, 0.16]} pos={[0.95, CASHIER.h + 0.01, -0.05]} mat="blackMetal" />
      <Box size={[0.07, 0.12, 0.012]} pos={[0.95, CASHIER.h + 0.07, -0.1]} rot={[-0.35, 0, 0]} mat="blackMetal" />
      <Box size={[0.3, 0.025, 0.22]} pos={[-0.85, CASHIER.h + 0.012, -0.05]} mat="linen" />
      {/* Presentation tray: the selected piece is placed here during checkout. */}
      <Box size={[0.42, 0.02, 0.3]} pos={[0, CASHIER.h + 0.01, 0.02]} mat="taupeVelvet" />
      <mesh position={[0, CASHIER.h + 0.021, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={M.pool}><planeGeometry args={[0.5, 0.4]} /></mesh>
      {/* Staff-side back shelf against the brand wall. */}
      <Box size={[CASHIER.w + 0.8, 0.9, 0.26]} pos={[0, 0.45, -0.92]} mat="blackSatin" />
    </group>
  );
}

const BOX_WRAP = new THREE.MeshStandardMaterial({ color: '#efe7da', roughness: 0.85 });
const BOX_BLACK = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.45, metalness: 0.1 });
const RIBBON = new THREE.MeshStandardMaterial({ color: '#8f6c46', roughness: 0.4, metalness: 0.6 });
const PAPER = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.95 });
const SCREEN = new THREE.MeshStandardMaterial({ color: '#0a0f14', emissive: '#7fd6ff', emissiveIntensity: 0 });

/**
 * The counter during checkout: the piece is laid on the tray; in the demo ceremony the card
 * terminal lights up, the piece is boxed (gift-wrapped if asked), slid across to the visitor, and a
 * receipt slip appears. Purely visual: nothing here takes payment.
 */
function CashierTray() {
  const checkout = useShowroom((s) => s.checkout);
  const ceremony = useShowroom((s) => s.ceremony);
  const first = checkout?.lines[0] ? PRODUCT_BY_SKU[checkout.lines[0].sku] : null;
  const piece = useMemo(() => (first ? buildPiece(first) : null), [first]);
  const box = useRef<THREE.Group>(null);
  const slip = useRef<THREE.Mesh>(null);
  const t = useRef({ box: 0, slide: 0, slip: 0 });
  useFrame((state, dtRaw) => {
    const s = useShowroom.getState();
    const c = s.ceremony;
    const k = s.reducedMotion ? 1 : Math.min(1, dtRaw * 2.2);
    const boxed = !!c && (c.stage === 'wrapping' || c.stage === 'handover' || c.stage === 'receipt');
    const slid = !!c && (c.stage === 'handover' || c.stage === 'receipt');
    t.current.box += ((boxed ? 1 : 0) - t.current.box) * k;
    t.current.slide += ((slid ? 1 : 0) - t.current.slide) * k;
    t.current.slip += ((c?.stage === 'receipt' ? 1 : 0) - t.current.slip) * k;
    if (box.current) {
      box.current.visible = t.current.box > 0.02;
      box.current.scale.setScalar(Math.max(0.001, t.current.box));
      box.current.position.z = CASHIER.z + 0.02 + t.current.slide * 0.22;
    }
    if (slip.current) { slip.current.visible = t.current.slip > 0.02; slip.current.scale.set(1, Math.max(0.001, t.current.slip), 1); }
    SCREEN.emissiveIntensity = c?.stage === 'terminal' ? 1.2 + (s.reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 3) * 0.4) : 0.15;
  });
  if (!piece || !first) return null;
  const wrap = ceremony?.giftWrap;
  const y = CASHIER.h + 0.02;
  return (
    <group>
      {/* Hidden once boxed. */}
      {!(ceremony && ceremony.stage !== 'terminal') && (
        <primitive object={piece} position={[CASHIER.x, y, CASHIER.z + 0.02]} scale={first.category === 'necklace' || first.category === 'pendant' ? 0.55 : 1} />
      )}
      <group ref={box} position={[CASHIER.x, y, CASHIER.z + 0.02]} visible={false}>
        <mesh position={[0, 0.045, 0]} material={wrap ? BOX_WRAP : BOX_BLACK}><boxGeometry args={[0.2, 0.09, 0.16]} /></mesh>
        <mesh position={[0, 0.045, 0]} material={RIBBON}><boxGeometry args={[0.022, 0.092, 0.162]} /></mesh>
        <mesh position={[0, 0.045, 0]} material={RIBBON}><boxGeometry args={[0.202, 0.092, 0.022]} /></mesh>
        {wrap && <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={RIBBON}><torusGeometry args={[0.022, 0.006, 8, 24]} /></mesh>}
      </group>
      {/* Card terminal screen (the terminal body is part of the merged counter). */}
      <mesh position={[CASHIER.x + 0.95, CASHIER.h + 0.075, CASHIER.z - 0.093]} rotation={[-0.35, 0, 0]} material={SCREEN}>
        <planeGeometry args={[0.058, 0.08]} />
      </mesh>
      <mesh ref={slip} position={[CASHIER.x + 0.42, CASHIER.h + 0.003, CASHIER.z + 0.12]} rotation={[-Math.PI / 2, 0, 0.12]} material={PAPER} visible={false}>
        <planeGeometry args={[0.08, 0.18]} />
      </mesh>
    </group>
  );
}

export default function Displays() {
  const fontsReady = useFontsReady();
  return (
    <group>
      {fontsReady && (
        <Merged>
          {DISPLAYS.map((d) => (
            <group key={d.sku} position={[d.x, 0, d.z]} rotation={[0, d.rotY, 0]}><Case spec={d} /></group>
          ))}
          <ComboTableStatic />
          <CashierStatic />
        </Merged>
      )}
      {DISPLAYS.map((d) => <Display key={d.sku} spec={d} fontsReady={fontsReady} />)}
      <ComboTableHit />
      <CashierTray />
    </group>
  );
}
