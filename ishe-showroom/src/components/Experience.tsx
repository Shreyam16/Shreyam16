'use client';
import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { useShowroom } from '@/store/showroom';
import { detectRenderMode } from '@/lib/capabilities';
import Entrance from './Entrance';
import Overlay from './Overlay';
import LoadingScreen from './LoadingScreen';
import { decodeBox } from '@/lib/share';
import { startDwellTracking } from '@/lib/analytics';
import { startHistorySync } from '@/lib/history';

const Showroom3D = dynamic(() => import('@/scene/Showroom3D'), { ssr: false });
const LiteShowroom = dynamic(() => import('./LiteShowroom'), { ssr: false });

/** If the 3D view fails for any reason (driver, shader, asset), fall back to the lite showroom instead of a blank page. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) {
    console.warn('3D showroom unavailable, switching to lite', e);
    useShowroom.getState().setRenderMode('lite', 'The 3D view could not start on this device, so we switched to the lite showroom.');
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function Experience() {
  const mode = useShowroom((s) => s.renderMode);
  const setRenderMode = useShowroom((s) => s.setRenderMode);
  const setReducedMotion = useShowroom((s) => s.setReducedMotion);
  const [slow, setSlow] = useState(false);
  const [capture, setCapture] = useState(false);

  useEffect(() => {
    // Exposed for automated QA (e2e/run.mjs); read-only use.
    (window as unknown as { __ishe?: typeof useShowroom }).__ishe = useShowroom;
    // QA-only logs of what voice lines and analytics batches were sent (read by e2e/run.mjs).
    Object.assign(window, { __isheVoiceLog: [], __isheAnalytics: [], __isheSfx: [] });
    const stopDwell = startDwellTracking();
    const stopHistory = startHistorySync();
    // `?capture=1` hides the interface so scripts/render-lite-backdrops.mjs can grab clean frames.
    const params = new URLSearchParams(window.location.search);
    setCapture(params.get('capture') === '1');
    // A shared Jewel Box link is shown after the entrance; nothing is added automatically.
    const shared = decodeBox(params.get('box'));
    if (shared.length) useShowroom.getState().setShared(shared);
    const d = detectRenderMode(window.location.search);
    setRenderMode(d.mode, d.reason);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => { mq.removeEventListener('change', on); stopDwell(); stopHistory(); };
  }, [setRenderMode, setReducedMotion]);

  return (
    <main className="relative min-h-screen" data-render-mode={mode}>
      {!capture && <LoadingScreen />}
      {mode === '3d' && (
        <>
          <SceneBoundary>
            <Showroom3D onSlow={() => setSlow(true)} />
          </SceneBoundary>
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
