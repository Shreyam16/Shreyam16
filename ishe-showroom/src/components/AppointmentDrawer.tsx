'use client';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { PRODUCT_BY_SKU } from '@/data/catalogue';
import { TIME_SLOTS, appointmentSummary, validateAppointment, whatsappLink } from '@/lib/appointment';
import { useShowroom } from '@/store/showroom';
import { Button, Icon, Sheet, SheetHeader } from './ui/primitives';
import { track } from '@/lib/analytics';

type Outcome =
  | { kind: 'idle' } | { kind: 'sending' }
  | { kind: 'demo'; message: string } | { kind: 'received'; message: string }
  | { kind: 'invalid'; errors: Record<string, string> } | { kind: 'error'; message: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export default function AppointmentDrawer() {
  const openDrawer = useShowroom((s) => s.openDrawer);
  const cart = useShowroom((s) => s.cart);
  const saved = useShowroom((s) => s.saved);
  const close = () => openDrawer(null);
  const uid = useId();
  const candidates = useMemo(() => [...new Set([...cart.map((l) => l.sku), ...saved])].filter((s) => PRODUCT_BY_SKU[s]), [cart, saved]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [form, setForm] = useState({ date: '', slot: '', name: '', phone: '', email: '', notes: '', skus: candidates });
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const today = useMemo(() => new Date(), []);
  const max = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 120); return d; }, [today]);

  useEffect(() => {
    let alive = true;
    fetch('/api/appointment', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => alive && setConfigured(j?.configured === true)).catch(() => alive && setConfigured(false));
    return () => { alive = false; };
  }, []);

  const errors = outcome.kind === 'invalid' ? outcome.errors : {};
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSku = (sku: string) => setForm((f) => ({ ...f, skus: f.skus.includes(sku) ? f.skus.filter((s) => s !== sku) : [...f.skus, sku] }));
  const wa = whatsappLink(WHATSAPP, appointmentSummary({ ...form, date: form.date || 'flexible', slot: (form.slot || 'any time') as never, name: form.name || '(name)' }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Same rules as the server; an incomplete form never leaves the browser.
    const v = validateAppointment(form);
    if (!v.ok) { setOutcome({ kind: 'invalid', errors: v.errors }); return; }
    setOutcome({ kind: 'sending' });
    try {
      const res = await fetch('/api/appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await res.json().catch(() => ({}));
      track('appointment_submit', { mode: String(j.mode ?? 'error'), pieces: form.skus.length });
      if (j.mode === 'invalid') setOutcome({ kind: 'invalid', errors: j.errors ?? {} });
      else if (j.mode === 'demo') setOutcome({ kind: 'demo', message: j.message });
      else if (j.mode === 'received') setOutcome({ kind: 'received', message: j.message });
      else setOutcome({ kind: 'error', message: j.message ?? 'The request could not be sent.' });
    } catch {
      setOutcome({ kind: 'error', message: 'The request could not be sent. Please check your connection.' });
    }
  }

  const field = 'mt-1 block min-h-[44px] w-full border border-ink/25 bg-paper px-3 font-ui text-[14px] focus:border-ink';
  const label = 'plaque-label text-ink/70';
  const err = (k: string) => errors[k] ? <p id={`${uid}-${k}-err`} className="mt-1 font-ui text-[12px] text-[#8f1426]">{errors[k]}</p> : null;
  const aria = (k: string) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined });

  return (
    <Sheet label="Book a private appointment" onClose={close} wide testId="appointment">
      <SheetHeader eyebrow="By appointment" title="Book a private appointment" onClose={close} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {configured === false && (
          <div className="mt-4 border border-ink/80 bg-paper p-3" data-testid="appointment-demo-banner">
            <p className="plaque-label text-ink">Demo mode</p>
            <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">Appointment requests are not sent or stored on this deployment. Nothing will be booked.</p>
          </div>
        )}
        <form onSubmit={submit} noValidate className="mt-4 space-y-4" data-testid="appointment-form">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-date`} className={label}>Date</label>
              <input id={`${uid}-date`} type="date" required min={iso(today)} max={iso(max)} value={form.date} onChange={(e) => set('date')(e.target.value)} className={field} data-testid="appt-date" {...aria('date')} />
              {err('date')}
            </div>
            <fieldset {...aria('slot')}>
              <legend className={label}>Time</legend>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {TIME_SLOTS.map((t) => (
                  <label key={t} className={`flex min-h-[40px] cursor-pointer items-center justify-center border font-ui text-[12px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${form.slot === t ? 'border-ink bg-ink text-bone' : 'border-ink/25'}`}>
                    <input type="radio" name={`${uid}-slot`} value={t} checked={form.slot === t} onChange={() => set('slot')(t)} className="sr-only" data-testid={`appt-slot-${t}`} />
                    {t}
                  </label>
                ))}
              </div>
              {err('slot')}
            </fieldset>
          </div>
          <fieldset>
            <legend className={label}>Pieces of interest</legend>
            {candidates.length ? (
              <ul className="mt-1 grid gap-1">
                {candidates.map((sku) => (
                  <li key={sku}>
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-3 font-ui text-[13px]">
                      <input type="checkbox" checked={form.skus.includes(sku)} onChange={() => toggleSku(sku)} className="h-4 w-4 accent-ink" />
                      <span><span className="editorial text-[17px]">{PRODUCT_BY_SKU[sku].name}</span> <span className="text-ink/50">{sku}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 font-ui text-[13px] text-ink/60">Add pieces to your Jewel Box or save them, and they will appear here. You can also describe them in the notes.</p>
            )}
          </fieldset>
          <div>
            <label htmlFor={`${uid}-name`} className={label}>Name</label>
            <input id={`${uid}-name`} autoComplete="name" required value={form.name} onChange={(e) => set('name')(e.target.value)} className={field} data-testid="appt-name" {...aria('name')} />
            {err('name')}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-phone`} className={label}>Phone</label>
              <input id={`${uid}-phone`} type="tel" autoComplete="tel" required placeholder="+91 …" value={form.phone} onChange={(e) => set('phone')(e.target.value)} className={field} data-testid="appt-phone" {...aria('phone')} />
              {err('phone')}
            </div>
            <div>
              <label htmlFor={`${uid}-email`} className={label}>Email</label>
              <input id={`${uid}-email`} type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email')(e.target.value)} className={field} data-testid="appt-email" {...aria('email')} />
              {err('email')}
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-notes`} className={label}>Notes <span className="normal-case tracking-normal text-ink/50">(optional)</span></label>
            <textarea id={`${uid}-notes`} rows={3} maxLength={600} value={form.notes} onChange={(e) => set('notes')(e.target.value)} className={`${field} py-2`} />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={outcome.kind === 'sending'} data-testid="appt-submit">
            {outcome.kind === 'sending' ? 'Sending…' : configured ? 'Request this appointment' : 'Request this appointment (demo)'}
          </Button>
        </form>

        <div aria-live="polite" className="mt-4" data-testid="appointment-outcome">
          {outcome.kind === 'demo' && (
            <div className="border-l-2 border-ink pl-3">
              <p className="plaque-label">Demo mode · not sent, not booked</p>
              <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">{outcome.message}</p>
            </div>
          )}
          {outcome.kind === 'received' && (
            <div className="border-l-2 border-ink pl-3">
              <p className="plaque-label">Request received · awaiting confirmation</p>
              <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">{outcome.message}</p>
            </div>
          )}
          {outcome.kind === 'invalid' && <p className="font-ui text-[13px] text-[#8f1426]">Please check the highlighted fields.</p>}
          {outcome.kind === 'error' && <p className="font-ui text-[13px] text-[#8f1426]">{outcome.message}</p>}
        </div>

        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="plaque-label text-ink/60">Prefer to message?</p>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-link" onClick={() => track('whatsapp_click', { kind: 'appointment' })}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-ink/80 font-ui text-[11px] uppercase tracking-[0.22em] hover:bg-ink hover:text-bone">
              <Icon name="chat" className="h-4 w-4" /> WhatsApp concierge
            </a>
          ) : (
            <p className="mt-2 font-ui text-[13px] text-ink/60" data-testid="whatsapp-unconfigured">WhatsApp concierge: not configured on this deployment.</p>
          )}
          <p className="mt-2 font-ui text-[11px] text-ink/50">WhatsApp opens with your details prefilled; nothing is sent until you press send there.</p>
        </div>
      </div>
    </Sheet>
  );
}
