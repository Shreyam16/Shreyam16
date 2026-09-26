'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useShowroom } from '@/store/showroom';
import { playEntrance } from './Entrance';
import { Button } from './ui/primitives';

const SEEN_KEY = 'ishe-welcome-seen';

/** Whether this browser has seen the welcome before (storage can be unavailable: treat as first visit). */
function seenBefore() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

/** Show the welcome again on the next visit to the street (Help → "Replay the welcome"). */
export function replayWelcome() {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* storage unavailable: the welcome shows anyway */ }
  window.location.assign(window.location.pathname + window.location.search);
}

/**
 * The welcome on the street: who we are, one clear "Enter the showroom" action, and, on a first
 * visit, three short lines on how to move once inside. It fades as the visitor scrolls toward the
 * doors, and never covers the storefront itself.
 */
export default function EntranceHUD() {
  const p = useShowroom((s) => s.entrance);
  const [first, setFirst] = useState(false);
  useEffect(() => {
    const f = !seenBefore();
    setFirst(f);
    if (f) { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* noop */ } }
  }, []);
  const fade = Math.max(0, 1 - p * 3.2);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[rgba(10,12,16,0.62)] via-[rgba(10,12,16,0.25)] to-transparent p-4 pt-20 md:p-8 md:pt-24" id="main-controls">
      <motion.div style={{ opacity: fade }} className="max-w-md" aria-hidden={fade < 0.05} data-testid="welcome">
        <p className="plaque-label text-bone/80">Private atelier · by appointment</p>
        <h1 className="editorial mt-2 text-[34px] font-medium italic leading-[1] text-bone md:text-[46px]">Welcome to ISHÉ.</h1>
        <p className="mt-3 max-w-sm font-ui text-[14px] leading-relaxed text-bone/80">
          Scroll to walk up to the doors, or enter now. Take your time at each vitrine.
        </p>
        {first && (
          <ul className="mt-3 max-w-sm space-y-1 font-ui text-[13px] leading-snug text-bone/75" data-testid="welcome-orientation">
            <li>Inside, choose <span className="text-bone">left</span>, <span className="text-bone">straight</span> or <span className="text-bone">right</span>.</li>
            <li>Drag to look around; walk with <kbd className="text-bone">W A S D</kbd> or the arrow keys, or the pad on a phone.</li>
            <li>Select a vitrine to step up to it; “Back to room” returns you to where you stood.</li>
          </ul>
        )}
      </motion.div>
      <div className="mt-5 flex items-center gap-4">
        <Button variant="onDark" size="lg" className="pointer-events-auto bg-ink/40 backdrop-blur" onClick={playEntrance} data-testid="enter-button">
          Enter the showroom
        </Button>
        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-px w-24 bg-bone/30 md:w-40">
            <div className="h-px bg-bone" style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span className="plaque-label text-bone/70">{p < 0.02 ? 'Scroll' : `${Math.round(p * 100)}%`}</span>
        </div>
      </div>
    </div>
  );
}
