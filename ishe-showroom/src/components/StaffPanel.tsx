'use client';
import { STAFF_BY_ID, type StaffId } from '@/scene/features';
import { TOURS, type TourId } from '@/scene/layout';
import { cartCount, useShowroom } from '@/store/showroom';
import { Button, Icon, Sheet, SheetHeader } from './ui/primitives';

const TOUR_ORDER: TourId[] = ['bridal', 'everyday', 'gifting', 'festive', 'around'];

/** Greeting from a member of staff, with guided-tour choices. Keyboard and screen-reader friendly. */
export default function StaffPanel({ id }: { id: StaffId }) {
  const spot = STAFF_BY_ID[id];
  const back = useShowroom((s) => s.back);
  const startTour = useShowroom((s) => s.startTour);
  const openDrawer = useShowroom((s) => s.openDrawer);
  const startCheckout = useShowroom((s) => s.startCheckout);
  const cart = useShowroom((s) => s.cart);
  const mode = useShowroom((s) => s.renderMode);
  const moving = useShowroom((s) => s.moving);
  const lite = mode === 'lite';
  return (
    <Sheet label={`${lite ? 'Concierge' : spot.role}: greeting`} onClose={back} testId="staff-panel">
      <SheetHeader eyebrow={lite ? 'Concierge' : spot.role} title="Welcome to ISHÉ" onClose={back} closeLabel="Back" />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <p className="editorial mt-4 text-[20px] italic leading-snug text-ink/85" data-testid="staff-greeting">“{spot.greeting}”</p>
        {id === 'cashier' ? (
          <div className="mt-5 grid gap-2">
            <Button variant="primary" disabled={!cart.length || moving} data-testid="staff-to-counter"
              onClick={() => startCheckout({ lines: cart.map((l) => ({ ...l })), source: 'jewelBox' })}>
              {cart.length ? `Take my Jewel Box (${cartCount(cart)}) to the counter` : 'Your Jewel Box is empty'}
            </Button>
          </div>
        ) : (
          <section className="mt-5" aria-labelledby="tour-heading">
            <h3 id="tour-heading" className="plaque-label text-ink/60">Would you like a guided tour?</h3>
            <ul className="mt-3 grid gap-2">
              {TOUR_ORDER.map((t) => (
                <li key={t}>
                  <button type="button" disabled={moving} onClick={() => startTour(t)} data-testid={`tour-${t}`}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 border border-ink/20 px-4 text-left hover:border-ink disabled:opacity-40">
                    <span>
                      <span className="editorial block text-[20px] leading-tight">{TOURS[t].label}</span>
                      <span className="font-ui text-[12px] text-ink/60">{TOURS[t].blurb}</span>
                    </span>
                    <Icon name="arrowRight" className="h-4 w-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-6 border-t border-ink/10 pt-4">
          <Button variant="secondary" className="w-full" onClick={() => openDrawer('appointment')} data-testid="staff-book">
            <Icon name="calendar" className="h-4 w-4" /> Book a private appointment
          </Button>
        </div>
        <p className="mt-4 font-ui text-[11px] leading-snug text-ink/50">
          {lite ? 'Tours move through the showroom stills.' : 'Staff are illustrative 3D figures.'} Recommendations use sample demo data.
        </p>
      </div>
    </Sheet>
  );
}
