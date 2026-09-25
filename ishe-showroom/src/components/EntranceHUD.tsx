'use client';
import { motion } from 'framer-motion';
import { useShowroom } from '@/store/showroom';
import { playEntrance } from './Entrance';
import { Button } from './ui/primitives';

export default function EntranceHUD() {
  const p = useShowroom((s) => s.entrance);
  const reduced = useShowroom((s) => s.reducedMotion);
  const fade = Math.max(0, 1 - p * 3.2);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[rgba(10,12,16,0.78)] via-[rgba(10,12,16,0.45)] to-transparent p-4 pt-24 md:p-8 md:pt-32" id="main-controls">
      <motion.div style={{ opacity: fade }} className="max-w-md" aria-hidden={fade < 0.05}>
        <p className="plaque-label text-bone/80">Private showroom · by appointment</p>
        <h1 className="editorial mt-2 text-[44px] font-medium italic leading-[0.95] text-bone md:text-[64px]">Step inside.</h1>
        <p className="mt-3 max-w-sm font-ui text-[14px] leading-relaxed text-bone/80">
          Scroll to approach the doors. Once inside, choose a room and take your time at each vitrine.
        </p>
      </motion.div>
      <div className="mt-6 flex items-center gap-4">
        <Button variant="onDark" size="lg" className="pointer-events-auto bg-ink/40 backdrop-blur" onClick={playEntrance} data-testid="enter-button">
          {reduced ? 'Enter the showroom' : 'Walk me in'}
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
