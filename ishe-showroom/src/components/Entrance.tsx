'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useShowroom } from '@/store/showroom';

gsap.registerPlugin(ScrollTrigger);

let lenisRef: Lenis | null = null;

/** Scroll the visitor through the doors automatically (used by the "Enter" button). */
export function playEntrance() {
  const s = useShowroom.getState();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (s.reducedMotion || !lenisRef) {
    if (s.reducedMotion) { s.setEntrance(1); s.enter(); return; }
    window.scrollTo({ top: max, behavior: 'smooth' });
    return;
  }
  // A slow, even glide (sine in-out) at close to the reference film's own pace.
  lenisRef.scrollTo(max, { duration: 13, easing: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2 });
}

/**
 * Scroll track for the exterior approach. GSAP ScrollTrigger maps scroll to 0..1; Lenis smooths
 * wheel/touch scrolling. Both are torn down once the visitor is inside.
 */
export default function Entrance() {
  const track = useRef<HTMLDivElement>(null);
  const phase = useShowroom((s) => s.phase);
  const reduced = useShowroom((s) => s.reducedMotion);

  useEffect(() => {
    if (phase !== 'outside' || !track.current) return;
    window.scrollTo(0, 0);
    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.075, smoothWheel: true, syncTouch: false });
      lenisRef = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      tick = (t: number) => lenis?.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reduced ? true : 0.6,
      onUpdate: (self) => {
        const s = useShowroom.getState();
        s.setEntrance(self.progress);
        if (self.progress >= 0.995 && s.phase === 'outside') s.enter();
      },
    });
    return () => {
      st.kill();
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef = null;
    };
  }, [phase, reduced]);

  useEffect(() => {
    document.documentElement.classList.toggle('inside', phase === 'inside');
    if (phase === 'inside') window.scrollTo(0, 0);
  }, [phase]);

  if (phase !== 'outside') return null;
  return <div ref={track} data-testid="entrance-track" style={{ height: '520vh' }} aria-hidden="true" />;
}
