'use client';
import { PRODUCT_BY_SKU, formatINR } from '@/data/catalogue';
import type { CartLine, Ceremony } from '@/store/showroom';

/**
 * Receipt for the demo ceremony. It is visibly and repeatedly marked as a SAMPLE: no payment was
 * taken, no order exists, and it is not a tax invoice. It must never be styled as a real receipt.
 */
export default function Receipt({ lines, ceremony }: { lines: CartLine[]; ceremony: Ceremony }) {
  const items = lines.filter((l) => PRODUCT_BY_SKU[l.sku]);
  const subtotal = items.reduce((n, l) => n + PRODUCT_BY_SKU[l.sku].priceINR * l.qty, 0);
  return (
    <div className="print-receipt relative mt-4 overflow-hidden border border-ink/30 bg-paper px-5 py-5 font-ui text-[13px] text-ink" data-testid="receipt" aria-label="Sample receipt">
      <p aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-center font-ui text-[42px] font-medium uppercase tracking-[0.2em] text-ink/[0.07] [transform:rotate(-24deg)]">Sample</p>
      <div className="relative">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ishe-wordmark-black.png" alt="ISHÉ" className="h-6 w-auto" />
          <p className="border border-ink px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">Sample receipt</p>
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-ink/60">Private showroom · demo</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[12px] text-ink/70">
          <dt>Reference</dt><dd data-testid="receipt-ref">{ceremony.ref}</dd>
          <dt>Date</dt><dd>{ceremony.at}</dd>
          <dt>Payment</dt><dd>None taken (demo terminal)</dd>
        </dl>
        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead><tr className="border-b border-ink/40 text-left"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Qty</th><th className="py-1 text-right font-medium">Sample price</th></tr></thead>
          <tbody>
            {items.map((l) => {
              const p = PRODUCT_BY_SKU[l.sku];
              return (
                <tr key={l.sku} className="border-b border-ink/10">
                  <td className="py-1.5">{p.name}<br /><span className="text-[10px] tracking-[0.12em] text-ink/55">{p.sku}</span></td>
                  <td className="py-1.5 text-right">{l.qty}</td>
                  <td className="py-1.5 text-right">{formatINR(p.priceINR * l.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between border-t border-ink pt-2 text-[13px]"><span>Subtotal (sample)</span><span>{formatINR(subtotal)}</span></div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px] text-ink/75" data-testid="receipt-extras">
          <dt>Gift wrap</dt><dd>{ceremony.giftWrap ? 'Yes' : 'No'}</dd>
          {ceremony.giftNote && <><dt>Gift note</dt><dd className="break-words">{ceremony.giftNote}</dd></>}
          {ceremony.engraving && <><dt>Engraving</dt><dd className="break-words">“{ceremony.engraving}” (request, confirmed by the store)</dd></>}
        </dl>
        <p className="mt-4 border-t border-dashed border-ink/40 pt-3 text-[11px] leading-snug text-ink/70" data-testid="receipt-disclaimer">
          Demo only. No payment was taken and no order was placed. This is not a tax invoice or proof of purchase.
          Prices are sample values.
        </p>
      </div>
    </div>
  );
}
