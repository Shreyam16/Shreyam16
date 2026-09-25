'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useShowroom } from '@/store/showroom';
import { detectRenderMode } from '@/lib/capabilities';
import Entrance from './Entrance';
import Overlay from './Overlay';

const Showroom3D = dynamic(() => import('@/scene/Showroom3D'), { ssr: false });
const LiteShowroom = dynamic(() => import('./LiteShowroom'), { ssr: false });

export default function Experience() {
  const mode = useShowroom((s) => s.renderMode);
  const setRenderMode = useShowroom((s) => s.setRenderMode);
  const setReducedMotion = useShowroom((s) => s.setReducedMotion);
  const [slow, setSlow] = useState(false);
  const [capture, setCapture] = useState(false);

  useEffect(() => {
    // Exposed for automated QA (e2e/run.mjs); read-only use.
    (window as unknown as { __ishe?: typeof useShowroom }).__ishe = useShowroom;
    // `?capture=1` hides the interface so scripts/render-lite-backdrops.mjs can grab clean frames.
    setCapture(new URLSearchParams(window.location.search).get('capture') === '1');
    const d = detectRenderMode(window.location.search);
    setRenderMode(d.mode, d.reason);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [setRenderMode, setReducedMotion]);

  return (
    <main className="relative min-h-screen" data-render-mode={mode}>
      {mode === 'detecting' && (
        <div className="fixed inset-0 grid place-items-center bg-[#1b2330]">
          <p className="plaque-label text-bone/70">Preparing the showroom</p>
        </div>
      )}
      {mode === '3d' && (
        <>
          <Showroom3D onSlow={() => setSlow(true)} />
          <Entrance />
        </>
      )}
      {mode === 'lite' && (
        <>
          <LiteShowroom />
          <Entrance />
        </>
      )}
      {mode !== 'detecting' && !capture && <Overlay slow={slow} onDismissSlow={() => setSlow(false)} />}
    </main>
  );
}
