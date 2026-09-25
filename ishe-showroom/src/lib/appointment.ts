import { PRODUCT_BY_SKU } from '@/data/catalogue';

export const TIME_SLOTS = ['11:00', '12:30', '14:00', '15:30', '17:00', '18:30'] as const;

export interface AppointmentRequest {
  date: string;
  slot: (typeof TIME_SLOTS)[number];
  skus: string[];
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

/** Validates an appointment request. Returns field errors, or the cleaned request. */
export function validateAppointment(input: unknown, today = new Date()): { ok: true; value: AppointmentRequest } | { ok: false; errors: Record<string, string> } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const date = clean(raw.date, 10);
  const slot = clean(raw.slot, 5) as AppointmentRequest['slot'];
  const name = clean(raw.name, 80);
  const phone = clean(raw.phone, 24);
  const email = clean(raw.email, 120);
  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 600) : '';
  const skus = Array.isArray(raw.skus) ? [...new Set(raw.skus.filter((s): s is string => typeof s === 'string' && !!PRODUCT_BY_SKU[s]))].slice(0, 24) : [];

  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const max = new Date(start); max.setDate(max.getDate() + 120);
  if (!d || Number.isNaN(d.getTime())) errors.date = 'Choose a date.';
  else if (d < start) errors.date = 'Choose a date from today onwards.';
  else if (d > max) errors.date = 'Choose a date within the next four months.';
  if (!TIME_SLOTS.includes(slot)) errors.slot = 'Choose a time.';
  if (name.length < 2) errors.name = 'Enter your name.';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15 || /[^\d\s+()-]/.test(phone)) errors.phone = 'Enter a phone number with country code.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { date, slot, skus, name, phone, email, notes } };
}

/** Plain-text summary used for the store's email and the WhatsApp message. */
export function appointmentSummary(a: Pick<AppointmentRequest, 'date' | 'slot' | 'skus' | 'name' | 'notes'> & Partial<AppointmentRequest>): string {
  const pieces = a.skus.map((s) => `${PRODUCT_BY_SKU[s]?.name ?? s} (${s})`).join(', ') || 'None selected';
  return [
    'Private appointment request (ISHÉ showroom)',
    `Name: ${a.name}`,
    a.phone ? `Phone: ${a.phone}` : '',
    a.email ? `Email: ${a.email}` : '',
    `Preferred: ${a.date} at ${a.slot}`,
    `Pieces of interest: ${pieces}`,
    a.notes ? `Notes: ${a.notes}` : '',
  ].filter(Boolean).join('\n');
}

/** wa.me link with a prefilled message, or null when no number is configured. */
export function whatsappLink(number: string | undefined, text: string): string | null {
  const digits = (number ?? '').replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
