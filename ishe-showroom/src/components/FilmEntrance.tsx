'use client';
import { useEffect, useRef, useState } from 'react';
import { useShowroom } from '@/store/showroom';

/** Frames of the reference film (12 fps), with the supplied ISHÉ plaque on its sign. */
export const FILM_FRAMES = 181;
const src = (i: number) => `/film/f${String(i).padStart(3, '0')}.webp`;

/**
 * The street, the doors and the walk-in at dusk are the reference film itself, scrubbed by the
 * visitor's scroll (frame = entrance progress), so the approach looks exactly as it does in the
 * film. Crossing the threshold, the film dissolves into the live showroom at the junction, whose
 * photo stop continues the same look. Daylight keeps the 3D street; reduced motion swaps
 * instantly. Frames load progressively: the nearest loaded frame is always shown.
 */
export default function FilmEntrance() {
  const phase = useShowroom((s) => s.phase);
  const evening = useShowroom((s) => s.evening);
  const reduced = useShowroom((s) => s.reducedMotion);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useRef<(HTMLImageElement | null)[]>(Array(FILM_FRAMES).fill(null));
  const drawn = useRef(-1);
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);

  // Load the first frame, then a coarse pass, then the rest.
  useEffect(() => {
    let alive = true;
    const order: number[] = [];
    for (const step of [45, 15, 5, 1]) for (let i = 0; i < FILM_FRAMES; i += step) if (!order.includes(i)) order.push(i);
    (async () => {
      for (let k = 0; k < order.length && alive; k += 6) {
        await Promise.all(order.slice(k, k + 6).map((i) => new Promise<void>((done) => {
          const im = new Image();
          im.decoding = 'async';
          im.onload = () => { frames.current[i] = im; drawn.current = -1; done(); };
          im.onerror = () => done();
          im.src = src(i);
        })));
      }
    })();
    return () => { alive = false; };
  }, []);

  // Draw the frame for the current scroll position (cover-fit, centred) on every animation frame.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; drawn.current = -1; }
      const s = useShowroom.getState();
      const want = Math.round(Math.min(1, s.entrance) * (FILM_FRAMES - 1));
      // Nearest loaded frame (prefer earlier frames so the film never jumps ahead).
      let i = want;
      for (let d = 0; d < FILM_FRAMES; d++) {
        if (frames.current[want - d]) { i = want - d; break; }
        if (frames.current[want + d]) { i = want + d; break; }
      }
      const im = frames.current[i];
      if (!im || i === drawn.current) return;
      const ctx = c.getContext('2d')!;
      const k = Math.max(w / im.width, h / im.height);
      const dw = im.width * k, dh = im.height * k;
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      drawn.current = i;
      c.dataset.frame = String(i);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Inside: dissolve into the live showroom (instantly with reduced motion).
  useEffect(() => {
    if (phase !== 'inside') { setGone(false); setFading(false); return; }
    if (reduced) { setGone(true); return; }
    setFading(true);
    const t = setTimeout(() => setGone(true), 1100);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  if (!evening || gone) return null;
  return (
    <canvas
      ref={canvas}
      aria-hidden
      data-testid="film-entrance"
      className="pointer-events-none fixed inset-0 z-[4] h-full w-full"
      style={{ opacity: fading ? 0 : 1, transition: fading ? 'opacity 1.1s ease-in-out' : 'none' }}
    />
  );
}
