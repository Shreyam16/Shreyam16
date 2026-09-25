'use client';
import { useMemo } from 'react';
import { CATEGORY_LABEL, OCCASION_LABEL, PRODUCTS, PRODUCT_BY_SKU, ROOMS, formatINR } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';
import { Button, Icon, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';
import { isTryOnCategory } from '@/lib/tryon';
import { track } from '@/lib/analytics';
import { whatsappLink } from '@/lib/appointment';

export default function ProductPanel({ sku, announce }: { sku: string; announce: (msg: string) => void }) {
  const product = PRODUCT_BY_SKU[sku];
  const back = useShowroom((s) => s.back);
  const goTo = useShowroom((s) => s.goTo);
  const addToCart = useShowroom((s) => s.addToCart);
  const toggleSaved = useShowroom((s) => s.toggleSaved);
  const saved = useShowroom((s) => s.saved.includes(sku));
  const startCheckout = useShowroom((s) => s.startCheckout);
  const moving = useShowroom((s) => s.moving);
  const openTryOn = useShowroom((s) => s.openTryOn);

  const roomItems = useMemo(() => PRODUCTS.filter((p) => p.room === product.room), [product.room]);
  const idx = roomItems.findIndex((p) => p.sku === sku);
  const prev = roomItems[(idx - 1 + roomItems.length) % roomItems.length];
  const next = roomItems[(idx + 1) % roomItems.length];

  return (
    <Sheet label={`${product.name} details`} onClose={back} testId="product-panel">
      <SheetHeader eyebrow={<>{CATEGORY_LABEL[product.category]} · {ROOMS[product.room].direction} room</>} title={<span data-testid="product-name">{product.name}</span>} onClose={back} closeLabel="Back" />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <figure className="mt-4">
          <ProductImage product={product} className="aspect-[4/3] w-full" />
          <figcaption className="mt-2 flex items-center gap-2 font-ui text-[11px] text-ink/60">
            <SampleTag>Sample image</SampleTag> Illustrative render, not a photograph of the piece.
          </figcaption>
        </figure>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 font-ui text-[13px]">
          <dt className="text-ink/60">SKU</dt>
          <dd className="text-right tracking-[0.12em]" data-testid="product-sku">{product.sku}</dd>
          <dt className="text-ink/60">Price</dt>
          <dd className="text-right"><span className="editorial text-[22px] leading-none">{formatINR(product.priceINR)}</span> <SampleTag>Sample price</SampleTag></dd>
        </dl>

        <p className="editorial mt-4 text-[19px] leading-snug text-ink/85">{product.description}</p>
        <p className="mt-2 font-ui text-[11px] text-ink/50">Demo copy. Materials and specifications to be confirmed by ISHÉ.</p>

        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Occasions">
          {product.occasions.map((o) => (
            <li key={o} className="border border-ink/15 px-2 py-1 font-ui text-[10px] uppercase tracking-[0.18em] text-ink/70">{OCCASION_LABEL[o]}</li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button variant="secondary" onClick={() => { addToCart(sku); track('add_to_box', { sku }); announce(`${product.name} added to your Jewel Box`); }} data-testid="add-to-box">
            Add to Jewel Box
          </Button>
          <Button variant="primary" disabled={moving} onClick={() => startCheckout({ lines: [{ sku, qty: 1 }], source: 'buyNow' })} data-testid="buy-now">
            Buy Now
          </Button>
          <button type="button" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save for later'} title={saved ? 'Saved' : 'Save'}
            onClick={() => { toggleSaved(sku); if (!saved) track('save_piece', { sku }); announce(saved ? 'Removed from saved' : `${product.name} saved`); }}
            className="grid h-11 w-11 place-items-center border border-ink/25 hover:border-ink" data-testid="save-toggle">
            <Icon name="heart" filled={saved} />
          </button>
        </div>

        {isTryOnCategory(product.category) && (
          <Button variant="ghost" className="mt-2 w-full border border-ink/15" onClick={() => { openTryOn(sku); track('try_on_open', { sku }); }} data-testid="try-on-open">
            <Icon name="camera" className="h-4 w-4" /> Try on with your camera
          </Button>
        )}

        {(() => {
          const wa = whatsappLink(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, `Hello ISHÉ, I would like to know more about the ${product.name} (${product.sku}).`);
          return wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track('whatsapp_click', { kind: 'ask_piece', sku })} data-testid="piece-whatsapp"
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 font-ui text-[11px] uppercase tracking-[0.18em] text-ink/80 hover:text-ink">
              <Icon name="chat" className="h-4 w-4" /> Ask about this piece on WhatsApp
            </a>
          ) : null;
        })()}

        <section className="mt-7" aria-labelledby="pair-heading">
          <h3 id="pair-heading" className="plaque-label text-ink/60">Pair it with</h3>
          <ul className="mt-3 space-y-2">
            {product.pairsWith.map((ps) => {
              const p = PRODUCT_BY_SKU[ps];
              return (
                <li key={ps}>
                  <button type="button" disabled={moving} onClick={() => goTo({ kind: 'product', sku: ps }, { remember: false })}
                    className="group flex w-full items-center gap-3 border border-transparent p-1 text-left hover:border-ink/15" data-testid={`pair-${ps}`}>
                    <ProductImage product={p} className="h-14 w-14 shrink-0" />
                    <span className="flex-1">
                      <span className="editorial block text-[18px] leading-tight">{p.name}</span>
                      <span className="font-ui text-[11px] tracking-[0.12em] text-ink/55">{p.sku} · {ROOMS[p.room].label}</span>
                    </span>
                    <span className="font-ui text-[10px] uppercase tracking-[0.2em] text-ink/60 group-hover:text-ink">Visit</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <nav className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4" aria-label="Displays in this room">
          <Button variant="ghost" disabled={moving} onClick={() => goTo({ kind: 'product', sku: prev.sku }, { remember: false })}>
            <Icon name="arrowLeft" className="h-4 w-4" /> Previous
          </Button>
          <span className="font-ui text-[11px] text-ink/50">{idx + 1} / {roomItems.length}</span>
          <Button variant="ghost" disabled={moving} onClick={() => goTo({ kind: 'product', sku: next.sku }, { remember: false })}>
            Next <Icon name="arrowRight" className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </Sheet>
  );
}
