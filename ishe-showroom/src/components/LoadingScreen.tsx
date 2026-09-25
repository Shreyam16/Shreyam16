'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShowroom } from '@/store/showroom';

/**
 * Branded loading screen: the ISHÉ plaque and a thin line driven by real asset loading
 * (three.js loading manager in 3D, the first still in the lite showroom). It fades calmly into
 * the street view once the first frame is on screen.
 */
export default function LoadingScreen() {
  const progress = useShowroom((s) => s.loadProgress);
  const ready = useShowroom((s) => s.sceneReady);
  const mode = useShowroom((s) => s.renderMode);
  const reduced = useShowroom((s) => s.reducedMotion);
  const [gaveUp, setGaveUp] = useState(false);
  // Never trap a visitor behind the loader if something stalls.
  useEffect(() => { const t = setTimeout(() => setGaveUp(true), 30000); return () => clearTimeout(t); }, []);
  const show = !(ready || gaveUp);
  const pct = Math.round((mode === 'detecting' ? 0 : progress) * 100);
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] grid place-items-center bg-[#1b2330]" data-testid="loading-screen" role="status" aria-label="Loading the showroom">
          <div className="flex w-[min(72vw,320px)] flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ishe-logo-plaque.png" alt="ISHÉ" width={1099} height={599} className="h-auto w-40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] md:w-48" />
            <div className="mt-10 h-px w-full bg-bone/20" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-testid="loading-progress">
              <div className="h-px bg-bone transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="plaque-label mt-4 text-bone/60">Private showroom · by appointment</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
