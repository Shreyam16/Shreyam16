'use client';
import { useState } from 'react';
import { PRODUCT_BY_SKU, formatINR } from '@/data/catalogue';
import { cartCount, useShowroom } from '@/store/showroom';
import { shareMessage, shareUrl, whatsappShareLink } from '@/lib/share';
import { whatsappLink } from '@/lib/appointment';
import { track } from '@/lib/analytics';
import { Button, Icon, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';

export default function JewelBoxDrawer({ announce }: { announce: (m: string) => void }) {
  const s = useShowroom();
  const [tab, setTab] = useState<'box' | 'saved'>('box');
  const [link, setLink] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ishe-showroom.vercel.app';
  const storeWa = whatsappLink(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, shareMessage(s.cart, shareUrl(origin, s.cart), true));
  async function share() {
    const url = shareUrl(window.location.origin, s.cart);
    setLink(url);
    track('share_box', { lines: s.cart.length });
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'My ISHÉ Jewel Box', url }); return; }
      await navigator.clipboard.writeText(url);
      announce('Share link copied');
    } catch { /* the link stays visible to copy by hand */ }
  }
  const close = () => s.openDrawer(null);
  const subtotal = s.cart.reduce((n, l) => n + (PRODUCT_BY_SKU[l.sku]?.priceINR ?? 0) * l.qty, 0);
  return (
    <Sheet label="Jewel Box" onClose={close} testId="jewel-box">
      <SheetHeader eyebrow="Your selection" title="Jewel Box" onClose={close} />
      <div role="tablist" aria-label="Jewel Box sections" className="flex border-b border-ink/10 px-5">
        {(['box', 'saved'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`min-h-[44px] px-3 font-ui text-[11px] uppercase tracking-[0.2em] ${tab === t ? 'border-b-2 border-ink text-ink' : 'text-ink/50'}`}>
            {t === 'box' ? `Jewel Box (${cartCount(s.cart)})` : `Saved (${s.saved.length})`}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5" role="tabpanel">
        {tab === 'box' ? (
          s.cart.length ? (
            <>
              <ul className="divide-y divide-ink/10">
                {s.cart.map((l) => {
                  const p = PRODUCT_BY_SKU[l.sku];
                  if (!p) return null;
                  return (
                    <li key={l.sku} className="flex items-center gap-3 py-3" data-testid={`box-line-${l.sku}`}>
                      <ProductImage product={p} className="h-16 w-16 shrink-0" />
                      <div className="flex-1">
                        <p className="editorial text-[18px] leading-tight">{p.name}</p>
                        <p className="font-ui text-[11px] tracking-[0.1em] text-ink/55">{p.sku} · {formatINR(p.priceINR)}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <button type="button" aria-label={`Decrease quantity of ${p.name}`} onClick={() => s.setQty(l.sku, l.qty - 1)} className="h-9 w-9 border border-ink/20">−</button>
                          <span className="w-8 text-center font-ui text-[13px]" aria-label="Quantity">{l.qty}</span>
                          <button type="button" aria-label={`Increase quantity of ${p.name}`} onClick={() => s.setQty(l.sku, l.qty + 1)} className="h-9 w-9 border border-ink/20">+</button>
                          <button type="button" onClick={() => { s.removeFromCart(l.sku); announce(`${p.name} removed`); }} className="ml-2 min-h-[36px] px-2 font-ui text-[10px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink">Remove</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex items-baseline justify-between border-t border-ink pt-3">
                <span className="plaque-label">Subtotal <SampleTag>Sample</SampleTag></span>
                <span className="editorial text-[24px]">{formatINR(subtotal)}</span>
              </div>
              <Button variant="primary" size="lg" className="mt-4 w-full" disabled={s.phase !== 'inside'} data-testid="box-checkout"
                onClick={() => s.startCheckout({ lines: s.cart.map((l) => ({ ...l })), source: 'jewelBox' })}>
                Take to the cashier
              </Button>
              <Button variant="secondary" className="mt-2 w-full" onClick={share} data-testid="box-share">
                <Icon name="share" className="h-4 w-4" /> Share this Jewel Box
              </Button>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <a href={whatsappShareLink(shareMessage(s.cart, shareUrl(origin, s.cart)))} target="_blank" rel="noopener noreferrer" data-testid="box-whatsapp-share"
                  onClick={() => track('whatsapp_click', { kind: 'share_box' })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-ink/30 px-3 font-ui text-[11px] uppercase tracking-[0.18em] hover:border-ink">
                  <Icon name="chat" className="h-4 w-4" /> Send on WhatsApp
                </a>
                {storeWa ? (
                  <a href={storeWa} target="_blank" rel="noopener noreferrer" data-testid="box-whatsapp-store" onClick={() => track('whatsapp_click', { kind: 'ask_store' })}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-ink/30 px-3 font-ui text-[11px] uppercase tracking-[0.18em] hover:border-ink">
                    Ask ISHÉ about these
                  </a>
                ) : (
                  <p className="grid min-h-[44px] place-items-center px-2 text-center font-ui text-[11px] text-ink/55" data-testid="box-whatsapp-store-unconfigured">Store WhatsApp: not configured</p>
                )}
              </div>
              {link && (
                <div className="mt-2">
                  <label htmlFor="share-link" className="font-ui text-[11px] text-ink/60">Link to this selection (pieces and quantities only)</label>
                  <input id="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="share-link"
                    className="mt-1 block min-h-[40px] w-full border border-ink/25 bg-paper px-2 font-ui text-[12px]" />
                </div>
              )}
            </>
          ) : (
            <p className="editorial mt-6 text-[19px] italic text-ink/60">Your Jewel Box is empty. Choose “Add to Jewel Box” at any display.</p>
          )
        ) : s.saved.length ? (
          <ul className="divide-y divide-ink/10">
            {s.saved.map((sku) => {
              const p = PRODUCT_BY_SKU[sku];
              if (!p) return null;
              return (
                <li key={sku} className="flex items-center gap-3 py-3">
                  <ProductImage product={p} className="h-16 w-16 shrink-0" />
                  <div className="flex-1">
                    <p className="editorial text-[18px] leading-tight">{p.name}</p>
                    <p className="font-ui text-[11px] tracking-[0.1em] text-ink/55">{p.sku}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => s.goTo({ kind: 'product', sku })} disabled={s.phase !== 'inside'}>View</Button>
                      <Button variant="ghost" onClick={() => { s.addToCart(sku); announce(`${p.name} added to your Jewel Box`); }}>Add</Button>
                      <button type="button" aria-label={`Unsave ${p.name}`} onClick={() => s.toggleSaved(sku)} className="grid h-11 w-11 place-items-center"><Icon name="heart" filled /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="editorial mt-6 text-[19px] italic text-ink/60">Nothing saved yet. Use the heart on any piece.</p>
        )}
        <p className="mt-6 font-ui text-[11px] text-ink/45">Your Jewel Box and saved pieces are kept on this device only.</p>
      </div>
    </Sheet>
  );
}
