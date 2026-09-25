'use client';
import { PRODUCT_BY_SKU, formatINR } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';
import { Button, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';

/** Pieces from a shared Jewel Box link. Nothing is added until the visitor chooses to. */
export default function SharedPanel({ announce }: { announce: (m: string) => void }) {
  const shared = useShowroom((s) => s.shared);
  const setShared = useShowroom((s) => s.setShared);
  const addShared = useShowroom((s) => s.addShared);
  const goTo = useShowroom((s) => s.goTo);
  if (!shared?.length) return null;
  const close = () => setShared(null);
  return (
    <Sheet label="Shared selection" onClose={close} testId="shared-panel">
      <SheetHeader eyebrow="Someone shared" title="Shared selection" onClose={close} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <ul className="mt-2 divide-y divide-ink/10">
          {shared.map((l) => {
            const p = PRODUCT_BY_SKU[l.sku];
            return (
              <li key={l.sku} className="flex items-center gap-3 py-3" data-testid={`shared-${l.sku}`}>
                <ProductImage product={p} className="h-16 w-16 shrink-0" />
                <div className="flex-1">
                  <p className="editorial text-[18px] leading-tight">{p.name}</p>
                  <p className="font-ui text-[11px] tracking-[0.1em] text-ink/55">{p.sku} · Qty {l.qty} · {formatINR(p.priceINR)} <SampleTag /></p>
                </div>
                <Button variant="ghost" onClick={() => { setShared(null); goTo({ kind: 'product', sku: l.sku }); }}>View</Button>
              </li>
            );
          })}
        </ul>
        <Button variant="primary" size="lg" className="mt-4 w-full" data-testid="shared-add"
          onClick={() => { addShared(); announce('Shared pieces added to your Jewel Box'); }}>
          Add all to my Jewel Box
        </Button>
        <p className="mt-3 font-ui text-[11px] text-ink/50">Share links carry only piece codes and quantities: no names, prices or personal details.</p>
      </div>
    </Sheet>
  );
}
