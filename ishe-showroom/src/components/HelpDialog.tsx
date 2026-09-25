'use client';
import { useShowroom } from '@/store/showroom';
import { Sheet, SheetHeader } from './ui/primitives';

export default function HelpDialog() {
  const openDrawer = useShowroom((s) => s.openDrawer);
  const mode = useShowroom((s) => s.renderMode);
  const close = () => openDrawer(null);
  const switchTo = mode === '3d' ? 'lite' : '3d';
  return (
    <Sheet label="Help and controls" onClose={close} testId="help">
      <SheetHeader eyebrow="Help" title="Moving through the showroom" onClose={close} />
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-4 font-ui text-[14px] leading-relaxed text-ink/85">
        <section>
          <h3 className="plaque-label text-ink/60">Getting around</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the room buttons at the bottom, or the plan, to walk to any room. The route avoids walls and cases.</li>
            <li>Select a vitrine (click, tap, or “Displays here”) to step up to it and open its details.</li>
            <li>“Back” returns you to exactly where you were standing.</li>
            {mode === '3d' && <li>Desktop: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys to walk, <kbd>Q</kbd>/<kbd>E</kbd> to turn, drag to look around.</li>}
            {mode === '3d' && <li>Phones: hold the arrow pad to walk and turn; drag the view to look around.</li>}
            <li><kbd>Esc</kbd> closes any panel.</li>
          </ul>
        </section>
        <section>
          <h3 className="plaque-label text-ink/60">Ways to explore</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{mode === '3d' ? 'Select an attendant, or use “Ask the attendant”,' : 'Use “Guided tour”'} for a Bridal, Everyday, Gifting or Festive tour, or a walk through every room. Use Next and Stop to move through it.</li>
            <li>Earrings, necklaces and pendants have “Try on with your camera”. The camera starts only when you ask, and nothing leaves your device.</li>
            <li>The calendar icon books a private appointment. The moon icon switches to evening.</li>
            <li>Share your Jewel Box from the Jewel Box panel: the link carries piece codes and quantities only.</li>
          </ul>
        </section>
        <section>
          <h3 className="plaque-label text-ink/60">About this demo</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Product names and SKUs are ISHÉ’s. Prices, descriptions and images are sample demo content.</li>
            <li>The jewellery in the showroom and its product images are stylised 3D renders, not photographs.</li>
            <li>Checkout only goes to Shopify when the store is connected; otherwise it stays in labelled demo mode.</li>
          </ul>
        </section>
        <section>
          <h3 className="plaque-label text-ink/60">Display</h3>
          <p className="mt-2">You are viewing the {mode === '3d' ? '3D' : 'lite'} showroom.</p>
          <a className="mt-2 inline-flex min-h-[44px] items-center border border-ink px-4 font-ui text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-bone"
            href={`?mode=${switchTo}`} data-testid="switch-mode">
            Switch to the {switchTo === '3d' ? '3D' : 'lite'} showroom
          </a>
          <p className="mt-2 text-[12px] text-ink/60">Motion follows your system’s reduced-motion setting.</p>
        </section>
      </div>
    </Sheet>
  );
}
