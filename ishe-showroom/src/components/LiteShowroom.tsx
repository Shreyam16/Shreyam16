'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PRODUCTS, PRODUCT_BY_SKU, ROOMS, formatINR } from '@/data/catalogue';
import { NODES, nearestClearNode, focusPose, type NodeId } from '@/scene/layout';
import { useShowroom, type View } from '@/store/showroom';
import { ProductImage } from './ui/primitives';

/**
 * Lite showroom for browsers without WebGL or low-power devices. It uses still frames captured
 * from the real-time scene (public/lite) with the same scroll entrance, rooms, panels and cashier.
 */
const ENTRANCE_FRAMES: [number, string][] = [
  [0, '/lite/entrance-0.webp'], [0.3, '/lite/entrance-30.webp'], [0.45, '/lite/entrance-45.webp'],
  [0.6, '/lite/entrance-60.webp'], [0.8, '/lite/entrance-80.webp'], [0.97, '/lite/room-junction.webp'],
];

const BACKDROP: Partial<Record<NodeId, string>> = {
  junction: 'junction', leftDoor: 'left', left: 'left', left2: 'left', leftBack: 'leftBack', leftMid: 'leftBack', leftBack2: 'leftBack',
  centre: 'centre', centreL: 'centre', centreL2: 'centre', centreR: 'centre', centreR2: 'centre', cashier: 'cashier',
  rightDoor: 'right', right: 'right', right2: 'right', rightBack: 'rightBack', rightBack2: 'rightBack',
};

function backdropFor(view: View): string {
  if (view.kind === 'cashier') return 'cashier';
  if (view.kind === 'combos') return 'centre';
  if (view.kind === 'staff') return view.id === 'left' ? 'left' : view.id === 'right' ? 'right' : 'cashier';
  if (view.kind === 'product') {
    const f = focusPose(view.sku);
    return BACKDROP[nearestClearNode(f.x, f.z)] ?? 'junction';
  }
  return BACKDROP[view.node] ?? 'junction';
}

function EntranceStage() {
  const p = useShowroom((s) => s.entrance);
  const ready = () => { const s = useShowroom.getState(); s.setLoadProgress(1); s.setSceneReady(); };
  // Each frame owns a span of the scroll; neighbours cross-fade only briefly at the boundary.
  const n = ENTRANCE_FRAMES.length;
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1b2330]" aria-hidden>
      {ENTRANCE_FRAMES.map(([at, src], i) => {
        const start = i === 0 ? -1 : (ENTRANCE_FRAMES[i - 1][0] + at) / 2;
        const end = i === n - 1 ? 2 : (at + ENTRANCE_FRAMES[i + 1][0]) / 2;
        const w = 0.035;
        const fadeIn = Math.min(1, Math.max(0, (p - (start - w)) / (2 * w)));
        const fadeOut = Math.min(1, Math.max(0, ((end + w) - p) / (2 * w)));
        const opacity = i === 0 ? fadeOut : i === n - 1 ? fadeIn : Math.min(fadeIn, fadeOut);
        const local = Math.min(1, Math.max(0, (p - start) / Math.max(0.01, Math.min(end, 1) - Math.max(start, 0))));
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" onLoad={i === 0 ? ready : undefined} onError={i === 0 ? ready : undefined} className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{ opacity, transform: `scale(${1 + local * 0.06})`, zIndex: i }} />
        );
      })}
    </div>
  );
}

function Rail() {
  const room = useShowroom((s) => s.room);
  const view = useShowroom((s) => s.view);
  const goTo = useShowroom((s) => s.goTo);
  const panelOpen = view.kind === 'product' || view.kind === 'combos';
  if (room === 'foyer' || view.kind === 'cashier') return null;
  const items = PRODUCTS.filter((p) => p.room === room);
  return (
    <section aria-label={`Vitrines in ${ROOMS[room].label}`} className={`pointer-events-auto fixed inset-x-0 top-20 z-[15] md:top-28 ${panelOpen ? 'hidden md:block md:right-[440px]' : ''}`} data-testid="lite-rail">
      <ul className="flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:px-8">
        {items.map((p) => {
          const active = view.kind === 'product' && view.sku === p.sku;
          return (
            <li key={p.sku} className="snap-start">
              <button type="button" onClick={() => goTo({ kind: 'product', sku: p.sku })} data-testid={`lite-display-${p.sku}`}
                className={`group block w-[168px] bg-ink p-2 text-left text-bone shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] outline-offset-2 md:w-[196px] ${active ? 'ring-2 ring-bone' : ''}`}>
                <div className="border border-bone/10 bg-[#efeae1] p-1">
                  <ProductImage product={p} className="aspect-[4/3] w-full" />
                </div>
                <span className="editorial mt-2 block text-[17px] leading-tight">{p.name}</span>
                <span className="font-ui text-[10px] tracking-[0.14em] text-bone/60">{p.sku} · {formatINR(p.priceINR)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function LiteShowroom() {
  const phase = useShowroom((s) => s.phase);
  const view = useShowroom((s) => s.view);
  const setRoom = useShowroom((s) => s.setRoom);
  const evening = useShowroom((s) => s.evening);

  // In 3D the camera rig reports the room; here it follows the requested view.
  useEffect(() => {
    if (view.kind === 'node') setRoom(NODES[view.node].room);
    else if (view.kind === 'product') setRoom(PRODUCT_BY_SKU[view.sku].room);
    else if (view.kind === 'staff') setRoom(view.id === 'left' || view.id === 'right' ? view.id : 'centre');
    else setRoom('centre');
  }, [view, setRoom]);

  const bg = backdropFor(view);
  return (
    <div data-testid="lite-showroom">
      {phase === 'outside' ? (
        <EntranceStage />
      ) : (
        <div className="fixed inset-0 overflow-hidden bg-[#e9e6e0]" aria-hidden>
          <AnimatePresence initial={false}>
            <motion.img key={bg} src={`/lite/room-${bg}.webp`} alt=""
              initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-cover" />
          </AnimatePresence>
        </div>
      )}
      {/* Stills are captured in daylight; evening is approximated with a dusk tint. */}
      <div aria-hidden data-testid="lite-evening"
        className={`pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(14,18,40,0.62),rgba(70,44,40,0.4))] mix-blend-multiply transition-opacity duration-700 ${evening ? 'opacity-100' : 'opacity-0'}`} />
      {phase === 'inside' && <Rail />}
    </div>
  );
}
