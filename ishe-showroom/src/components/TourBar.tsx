'use client';
import { PRODUCT_BY_SKU } from '@/data/catalogue';
import { TOURS } from '@/scene/layout';
import { useShowroom } from '@/store/showroom';
import { Icon } from './ui/primitives';

/** Guided-tour controls: where we are, Previous / Next, Stop. Arrow keys are not captured. */
export default function TourBar() {
  const tour = useShowroom((s) => s.tour);
  const moving = useShowroom((s) => s.moving);
  const step = useShowroom((s) => s.tourStep);
  const stop = useShowroom((s) => s.stopTour);
  if (!tour) return null;
  const stop0 = tour.stops[tour.index];
  const last = tour.index === tour.stops.length - 1;
  const caption = stop0.kind === 'product' ? PRODUCT_BY_SKU[stop0.sku].name : stop0.kind === 'combos' ? 'The combos table: curated pairings.' : stop0.caption;
  const btn = 'inline-flex min-h-[44px] items-center gap-1.5 px-3 font-ui text-[11px] uppercase tracking-[0.18em] disabled:opacity-40';
  return (
    <section aria-label={`${TOURS[tour.id].label} tour`} data-testid="tour-bar"
      className="glass-panel pointer-events-auto fixed left-1/2 top-16 z-[35] w-[94vw] -translate-x-1/2 px-3 py-2 md:left-4 md:top-24 md:w-[min(560px,calc(100vw-470px))] md:translate-x-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="plaque-label text-ink/60">{TOURS[tour.id].label} tour · <span data-testid="tour-progress">{tour.index + 1} of {tour.stops.length}</span></p>
          <p className="editorial truncate text-[17px] leading-tight" data-testid="tour-caption">{caption}</p>
        </div>
        <button type="button" className={btn} onClick={() => step(-1)} disabled={moving || tour.index === 0} aria-label="Previous stop">
          <Icon name="arrowLeft" className="h-4 w-4" />
        </button>
        {!last ? (
          <button type="button" className={`${btn} bg-ink text-bone`} onClick={() => step(1)} disabled={moving} data-testid="tour-next">
            Next <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        ) : (
          <span className="px-2 font-ui text-[11px] uppercase tracking-[0.18em] text-ink/60">Last stop</span>
        )}
        <button type="button" className={`${btn} border border-ink/30`} onClick={stop} data-testid="tour-stop">Stop</button>
      </div>
    </section>
  );
}
