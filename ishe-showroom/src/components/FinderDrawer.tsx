'use client';
import { useMemo, useState } from 'react';
import { CATEGORY_LABEL, OCCASION_LABEL, ROOMS, formatINR, searchProducts, type Category, type Occasion } from '@/data/catalogue';
import { useShowroom } from '@/store/showroom';
import { Chip, Icon, ProductImage, Sheet, SheetHeader } from './ui/primitives';

export default function FinderDrawer() {
  const openDrawer = useShowroom((s) => s.openDrawer);
  const goTo = useShowroom((s) => s.goTo);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [occ, setOcc] = useState<Occasion | 'all'>('all');
  const results = useMemo(() => searchProducts(q, { category: cat, occasion: occ }), [q, cat, occ]);
  const close = () => openDrawer(null);
  return (
    <Sheet label="Find a piece" onClose={close} side="left" testId="finder">
      <SheetHeader eyebrow="Find" title="Search the showroom" onClose={close} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <label className="mt-4 flex items-center gap-2 border-b border-ink pb-2">
          <Icon name="search" className="h-4 w-4 text-ink/60" />
          <span className="sr-only">Search by name, SKU or type</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or type" data-autofocus
            className="w-full bg-transparent font-ui text-[15px] outline-none placeholder:text-ink/40" data-testid="finder-input" />
        </label>
        <fieldset className="mt-4">
          <legend className="plaque-label text-ink/60">Type</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="plaque-label text-ink/60">Occasion finder</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip active={occ === 'all'} onClick={() => setOcc('all')}>Any</Chip>
            {(Object.keys(OCCASION_LABEL) as Occasion[]).map((o) => (
              <Chip key={o} active={occ === o} onClick={() => setOcc(o)} data-testid={`occasion-${o}`}>{OCCASION_LABEL[o]}</Chip>
            ))}
          </div>
        </fieldset>
        <p className="mt-4 font-ui text-[12px] text-ink/60" aria-live="polite">{results.length} {results.length === 1 ? 'piece' : 'pieces'}</p>
        <ul className="mt-2 divide-y divide-ink/10">
          {results.map((p) => (
            <li key={p.sku}>
              <button type="button" onClick={() => goTo({ kind: 'product', sku: p.sku })} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-ink/[0.03]" data-testid={`result-${p.sku}`}>
                <ProductImage product={p} className="h-14 w-14 shrink-0" />
                <span className="flex-1">
                  <span className="editorial block text-[18px] leading-tight">{p.name}</span>
                  <span className="font-ui text-[11px] tracking-[0.1em] text-ink/55">{p.sku} · {ROOMS[p.room].label}</span>
                </span>
                <span className="font-ui text-[12px] text-ink/70">{formatINR(p.priceINR)}</span>
              </button>
            </li>
          ))}
        </ul>
        {!results.length && <p className="editorial mt-3 text-[18px] italic text-ink/60">Nothing matches yet. Try another word or occasion.</p>}
        <p className="mt-4 font-ui text-[11px] text-ink/45">Prices shown are sample demo prices.</p>
      </div>
    </Sheet>
  );
}
