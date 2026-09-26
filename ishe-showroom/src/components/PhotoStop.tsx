'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useShowroom } from '@/store/showroom';

interface Manifest { v: string; stops: string[] }

/**
 * Photo stops: when the camera rests at a room stop at dusk, a Blender Cycles still of the same
 * view (bake/render_stops.py, rendered from the live scene with the same pose and field of view)
 * fades in over the 3D, and disappears the instant the visitor moves or looks around. The still
 * sits under the interface and lets every click through to the 3D below.
 *
 * Landscape stills are 2.4:1 at the live 52° vertical field of view and portrait ones 0.8:1 at 68°,
 * so cropping the centre (object-fit: cover) lines up with the 3D on any screen from 0.8:1 to
 * 2.4:1 and on any phone held upright. Wider screens keep the live 3D.
 */
export default function PhotoStop() {
  const still = useShowroom((s) => s.still);
  const evening = useShowroom((s) => s.evening);
  const reduced = useShowroom((s) => s.reducedMotion);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [variant, setVariant] = useState<'land' | 'port' | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    fetch('/stops/manifest.json').then((r) => (r.ok ? r.json() : null)).then(setManifest).catch(() => setManifest(null));
    const fit = () => {
      const a = window.innerWidth / window.innerHeight;
      setVariant(a < 0.8 ? 'port' : a <= 2.4 ? 'land' : null);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // The still goes the instant the visitor starts to move or look (a movement key, or pressing on
  // the 3D view), even before the next frame is drawn; it can return at the next stop.
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    const now = () => setDismissed(useShowroom.getState().still);
    const onKey = (e: KeyboardEvent) => { if (MOVE.has(e.code)) now(); };
    const onPointer = (e: PointerEvent) => { if ((e.target as HTMLElement | null)?.tagName === 'CANVAS') now(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer); };
  }, []);
  // Arriving anywhere else (or back after moving away) clears the dismissal.
  useEffect(() => { if (still !== dismissed) setDismissed(null); }, [still, dismissed]);

  const key = still && still !== dismissed && evening && variant && manifest?.stops.includes(still) ? still : null;
  const src = key && manifest ? `/stops/${key}.${variant}.webp?v=${manifest.v}` : null;

  useEffect(() => {
    setShown(null);
    if (!src) return;
    let live = true;
    const img = new Image();
    img.src = src;
    // Only show a fully decoded still: never a half-loaded image over the room.
    img.decode().then(() => { if (live) setShown(src); }).catch(() => {});
    return () => { live = false; };
  }, [src]);

  if (!shown || shown !== src) return null;
  return (
    <motion.img
      key={shown}
      src={shown}
      alt=""
      aria-hidden
      draggable={false}
      data-testid="photo-stop"
      data-stop={key ?? undefined}
      className="pointer-events-none fixed inset-0 z-[5] h-full w-full select-none object-cover"
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.2, ease: 'easeOut' }}
    />
  );
}
