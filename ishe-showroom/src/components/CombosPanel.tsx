'use client';
import { COMBOS, PRODUCT_BY_SKU, formatINR } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';
import { Button, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';

export default function CombosPanel({ announce }: { announce: (m: string) => void }) {
  const back = useShowroom((s) => s.back);
  const goTo = useShowroom((s) => s.goTo);
  const addToCart = useShowroom((s) => s.addToCart);
  return (
    <Sheet label="Combos" onClose={back} wide testId="combos-panel">
      <SheetHeader eyebrow="Rings & Combos" title="Curated pairings" onClose={back} closeLabel="Back" />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <p className="editorial mt-4 text-[18px] leading-snug text-ink/80">
          Each combo pairs two pieces already on display in the showroom. Visit either piece, or add both to your Jewel Box.
        </p>
        <ul className="mt-4 space-y-5">
          {COMBOS.map((c) => {
            const [a, b] = c.skus.map((s) => PRODUCT_BY_SKU[s]);
            return (
              <li key={c.id} className="border-t border-ink/10 pt-4" data-testid={`combo-${c.id}`}>
                <h3 className="editorial text-[22px] leading-tight">{c.name}</h3>
                <p className="font-ui text-[12px] text-ink/60">{c.note}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[a, b].map((p) => (
                    <button key={p.sku} type="button" onClick={() => goTo({ kind: 'product', sku: p.sku }, { remember: false })} className="text-left">
                      <ProductImage product={p} className="aspect-square w-full" />
                      <span className="editorial mt-1 block text-[16px] leading-tight">{p.name}</span>
                      <span className="font-ui text-[10px] tracking-[0.12em] text-ink/55">{p.sku} · {formatINR(p.priceINR)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-ui text-[12px]">Together {formatINR(a.priceINR + b.priceINR)} <SampleTag /></span>
                  <Button variant="secondary" onClick={() => { addToCart(a.sku); addToCart(b.sku); announce(`${c.name} added to your Jewel Box`); }}>
                    Add both
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
