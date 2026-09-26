'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShowroom } from '@/store/showroom';
import { caseLid, chime } from '@/lib/sound';
import TopBar from './TopBar';
import EntranceHUD from './EntranceHUD';
import { JunctionChooser, MovePad, RoomNav } from './Wayfinder';
import ProductPanel from './ProductPanel';
import CombosPanel from './CombosPanel';
import CashierPanel from './CashierPanel';
import FinderDrawer from './FinderDrawer';
import JewelBoxDrawer from './JewelBoxDrawer';
import HelpDialog from './HelpDialog';
import StaffPanel from './StaffPanel';
import TourBar from './TourBar';
import AppointmentDrawer from './AppointmentDrawer';
import dynamic from 'next/dynamic';
import SharedPanel from './SharedPanel';

// three.js and the camera code load only when a visitor opens the try-on.
const TryOnDialog = dynamic(() => import('./TryOnDialog'), { ssr: false });

export default function Overlay({ slow, onDismissSlow }: { slow: boolean; onDismissSlow: () => void }) {
  const phase = useShowroom((s) => s.phase);
  const view = useShowroom((s) => s.view);
  const moving = useShowroom((s) => s.moving);
  const drawer = useShowroom((s) => s.drawer);
  const mode = useShowroom((s) => s.renderMode);
  const liteReason = useShowroom((s) => s.liteReason);
  const sound = useShowroom((s) => s.sound);
  const tryOn = useShowroom((s) => s.tryOn);
  const shared = useShowroom((s) => s.shared);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);
  const [showReason, setShowReason] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const announce = useCallback((m: string) => {
    setMessage(m);
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => { setCoarse(window.matchMedia('(pointer: coarse)').matches); }, []);
  useEffect(() => {
    if (!liteReason) return;
    const t = setTimeout(() => setShowReason(false), 7000);
    return () => clearTimeout(t);
  }, [liteReason]);
  // Arriving at a case: the glass lid lifts, then a quiet ting as the piece comes into view.
  useEffect(() => {
    if (view.kind !== 'product' || moving || !sound) return;
    caseLid();
    const t = setTimeout(chime, 220);
    return () => clearTimeout(t);
  }, [view, moving, sound]);

  const inside = phase === 'inside';
  const atJunction = inside && view.kind === 'node' && view.node === 'junction' && !moving;
  const detailOpen = view.kind !== 'node';

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <TopBar />
      {!inside && <EntranceHUD />}

      {inside && (
        <>
          <AnimatePresence>{atJunction && !drawer && <JunctionChooser key="jc" />}</AnimatePresence>
          {!atJunction && !detailOpen && <RoomNav />}
          {mode === '3d' && coarse && view.kind === 'node' && !drawer && !atJunction && <MovePad />}
          {mode === '3d' && !coarse && view.kind === 'node' && !moving && !drawer && (
            <p className="pointer-events-none fixed bottom-4 right-4 z-10 hidden bg-paper/80 px-3 py-2 font-ui text-[11px] tracking-[0.08em] text-ink/70 md:block">
              Drag to look · W A S D to walk · Select a vitrine to step closer
            </p>
          )}
        </>
      )}

      <AnimatePresence>
        {inside && view.kind === 'product' && !tryOn && <ProductPanel key={`p-${view.sku}`} sku={view.sku} announce={announce} />}
        {inside && tryOn && <TryOnDialog key={`t-${tryOn}`} sku={tryOn} />}
        {inside && view.kind === 'staff' && !moving && <StaffPanel key={`s-${view.id}`} id={view.id} />}
        {inside && shared && view.kind === 'node' && !moving && !drawer && <SharedPanel key="shared" announce={announce} />}
        {drawer === 'appointment' && <AppointmentDrawer key="appointment" />}
        {inside && view.kind === 'combos' && !moving && <CombosPanel key="combos" announce={announce} />}
        {inside && view.kind === 'cashier' && !moving && <CashierPanel key="cashier" />}
        {drawer === 'finder' && <FinderDrawer key="finder" />}
        {drawer === 'jewelBox' && <JewelBoxDrawer key="box" announce={announce} />}
        {drawer === 'help' && <HelpDialog key="help" />}
      </AnimatePresence>

      {inside && <TourBar />}

      {inside && view.kind === 'cashier' && moving && (
        <p role="status" className="glass-panel fixed left-1/2 top-20 z-30 -translate-x-1/2 px-4 py-2 font-ui text-[12px] uppercase tracking-[0.2em]" data-testid="walking-to-cashier">
          Walking you to the cashier
        </p>
      )}

      <AnimatePresence>
        {toast && (
          <motion.p key={toast} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed left-1/2 top-20 z-50 -translate-x-1/2 bg-ink px-4 py-2 font-ui text-[12px] tracking-[0.08em] text-bone" aria-hidden>
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

      {(slow || (mode === 'lite' && liteReason && showReason)) && (
        <div className="pointer-events-auto fixed left-1/2 top-20 z-40 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 bg-paper px-4 py-2 font-ui text-[12px] shadow-lg" role="status">
          <span>{slow ? 'This device seems to be struggling with the 3D view.' : liteReason}</span>
          {slow && <a href="?mode=lite" className="underline underline-offset-4">Open lite showroom</a>}
          <button type="button" className="min-h-[36px] px-2 uppercase tracking-[0.18em] text-ink/60" onClick={() => { onDismissSlow(); setShowReason(false); }}>Dismiss</button>
        </div>
      )}

      <div className="sr-only" aria-live="polite" data-testid="live-region">{message}</div>
    </div>
  );
}
