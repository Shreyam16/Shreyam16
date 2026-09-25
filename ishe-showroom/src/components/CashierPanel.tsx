'use client';
import { useEffect, useId, useState } from 'react';
import { STAFF_BY_ID } from '@/scene/features';
import { PRODUCT_BY_SKU, formatINR } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';
import { Button, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';

type Status = { configured: boolean; mappedVariants: number; totalProducts: number } | null;
type Outcome = { kind: 'idle' } | { kind: 'working' } | { kind: 'demo'; reason: string } | { kind: 'error'; message: string } | { kind: 'redirecting' };

export default function CashierPanel() {
  const checkout = useShowroom((s) => s.checkout);
  const moving = useShowroom((s) => s.moving);
  const back = useShowroom((s) => s.back);
  const [status, setStatus] = useState<Status>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftNote, setGiftNote] = useState('');
  const [engraving, setEngraving] = useState('');
  const uid = useId();
  const mode = useShowroom((s) => s.renderMode);

  useEffect(() => {
    let alive = true;
    fetch('/api/checkout', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setStatus(j))
      .catch(() => alive && setStatus(null));
    return () => { alive = false; };
  }, []);

  if (!checkout) return null;
  const lines = checkout.lines.filter((l) => PRODUCT_BY_SKU[l.sku]);
  const subtotal = lines.reduce((n, l) => n + PRODUCT_BY_SKU[l.sku].priceINR * l.qty, 0);
  const live = status?.configured === true;

  async function proceed() {
    setOutcome({ kind: 'working' });
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: lines.map((l) => ({ sku: l.sku, quantity: l.qty })), extras: { giftWrap, giftNote, engraving } }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.mode === 'live' && typeof json.checkoutUrl === 'string' && json.checkoutUrl.startsWith('https://')) {
        setOutcome({ kind: 'redirecting' });
        window.location.assign(json.checkoutUrl);
        return;
      }
      if (json.mode === 'demo') { setOutcome({ kind: 'demo', reason: json.reason }); return; }
      setOutcome({ kind: 'error', message: json.message ?? 'Checkout is unavailable right now.' });
    } catch {
      setOutcome({ kind: 'error', message: 'Checkout is unavailable right now. Please check your connection.' });
    }
  }

  return (
    <Sheet label="Cashier and order summary" onClose={back} wide testId="cashier-panel">
      <SheetHeader eyebrow="Cashier" title="Your order" onClose={back} closeLabel="Return" />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {moving && <p className="mt-4 font-ui text-[12px] text-ink/60" role="status">Walking you to the cashier counter…</p>}
        <p className="editorial mt-4 text-[19px] italic leading-snug text-ink/80" data-testid="cashier-greeting">
          {mode === '3d' ? <span className="plaque-label not-italic text-ink/60">{STAFF_BY_ID.cashier.role} · </span> : null}“{STAFF_BY_ID.cashier.greeting}”
        </p>

        {!live && (
          <div className="mt-4 border border-ink/80 bg-paper p-3" data-testid="demo-banner">
            <p className="plaque-label text-ink">Demo checkout</p>
            <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">
              Shopify is not connected on this deployment. Continuing will not create an order, reserve stock or take payment.
            </p>
          </div>
        )}

        <ul className="mt-4 divide-y divide-ink/10" aria-label="Items">
          {lines.map((l) => {
            const p = PRODUCT_BY_SKU[l.sku];
            return (
              <li key={l.sku} className="flex items-center gap-3 py-3">
                <ProductImage product={p} className="h-16 w-16 shrink-0" />
                <div className="flex-1">
                  <p className="editorial text-[19px] leading-tight">{p.name}</p>
                  <p className="font-ui text-[11px] tracking-[0.12em] text-ink/55">{p.sku} · Qty {l.qty}</p>
                </div>
                <p className="font-ui text-[13px]">{formatINR(p.priceINR * l.qty)}</p>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between border-t border-ink pt-3">
          <span className="plaque-label">Subtotal <SampleTag>Sample prices</SampleTag></span>
          <span className="editorial text-[26px]" data-testid="subtotal">{formatINR(subtotal)}</span>
        </div>
        <p className="mt-1 font-ui text-[11px] text-ink/55">Taxes, shipping and final prices are confirmed by Shopify at checkout.</p>

        <section className="mt-5 space-y-3 border-t border-ink/10 pt-4" aria-labelledby={`${uid}-extras`} data-testid="cashier-extras">
          <h3 id={`${uid}-extras`} className="plaque-label text-ink/60">Finishing touches</h3>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 font-ui text-[14px]">
            <span>Gift wrapping</span>
            <input type="checkbox" role="switch" aria-checked={giftWrap} checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="h-5 w-5 accent-ink" data-testid="gift-wrap" />
          </label>
          <div>
            <label htmlFor={`${uid}-note`} className="font-ui text-[13px] text-ink/80">Gift note <span className="text-ink/50">(optional, up to 240 characters)</span></label>
            <textarea id={`${uid}-note`} rows={2} maxLength={240} value={giftNote} onChange={(e) => setGiftNote(e.target.value)} data-testid="gift-note"
              className="mt-1 block w-full border border-ink/25 bg-paper px-3 py-2 font-ui text-[14px] focus:border-ink" />
          </div>
          <div>
            <label htmlFor={`${uid}-engrave`} className="font-ui text-[13px] text-ink/80">Engraving <span className="text-ink/50">(optional, up to 30 characters)</span></label>
            <input id={`${uid}-engrave`} maxLength={30} value={engraving} onChange={(e) => setEngraving(e.target.value)} aria-describedby={`${uid}-engrave-help`} data-testid="engraving"
              className="mt-1 block min-h-[44px] w-full border border-ink/25 bg-paper px-3 font-ui text-[14px] focus:border-ink" />
            <p id={`${uid}-engrave-help`} className="mt-1 font-ui text-[11px] text-ink/55">A request only: the store confirms whether and how a piece can be engraved before anything is done.</p>
          </div>
          <a href="/ring-size-guide" target="_blank" rel="noopener" className="inline-flex min-h-[40px] items-center gap-2 font-ui text-[12px] underline underline-offset-4" data-testid="ring-size-link">
            Ring size guide (printable, approximate)
          </a>
        </section>

        <div className="mt-5 grid gap-2">
          <Button variant="primary" size="lg" onClick={proceed} disabled={moving || outcome.kind === 'working' || outcome.kind === 'redirecting' || !lines.length} data-testid="proceed-checkout">
            {outcome.kind === 'working' ? 'Preparing checkout…' : outcome.kind === 'redirecting' ? 'Opening Shopify checkout…' : live ? 'Continue to secure checkout' : 'Continue (demo)'}
          </Button>
          <Button variant="secondary" onClick={back}>Return to the showroom</Button>
        </div>

        <div aria-live="polite" className="mt-4" data-testid="checkout-outcome">
          {outcome.kind === 'demo' && (
            <div className="border-l-2 border-ink pl-3">
              <p className="plaque-label">Demo mode · no purchase made</p>
              <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">{outcome.reason}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-ui text-[12px] text-ink/80" data-testid="demo-extras">
                <dt className="text-ink/55">Gift wrap</dt><dd>{giftWrap ? 'Yes' : 'No'}</dd>
                <dt className="text-ink/55">Gift note</dt><dd className="break-words">{giftNote.trim() || 'None'}</dd>
                <dt className="text-ink/55">Engraving</dt><dd className="break-words">{engraving.trim() ? `“${engraving.trim()}” (request, confirmed by the store)` : 'None'}</dd>
              </dl>
              <p className="mt-1 font-ui text-[11px] text-ink/50">With Shopify connected, these go to the order as cart notes for the store.</p>
            </div>
          )}
          {outcome.kind === 'error' && (
            <div className="border-l-2 border-[#8f1426] pl-3">
              <p className="plaque-label text-[#8f1426]">Checkout unavailable</p>
              <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">{outcome.message}</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
