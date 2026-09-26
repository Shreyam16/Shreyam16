import { NextResponse } from 'next/server';
import { cleanBatch } from '@/lib/analytics-schema';

export const dynamic = 'force-dynamic';

/**
 * Receives anonymous showroom events. Forwarded as JSON to ANALYTICS_WEBHOOK_URL (for example a
 * spreadsheet, warehouse or automation) when configured; otherwise accepted and discarded.
 */
export async function POST(req: Request) {
  const text = await req.text().catch(() => '');
  if (text.length > 64_000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const batch = cleanBatch(body);
  if (!batch) return NextResponse.json({ ok: false }, { status: 400 });
  const url = process.env.ANALYTICS_WEBHOOK_URL?.trim();
  if (!url || !/^https:\/\//.test(url)) return NextResponse.json({ ok: true, stored: false, accepted: batch.events.length });
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ishe_showroom_events', receivedAt: new Date().toISOString(), ...batch }), cache: 'no-store' });
  } catch { /* analytics must never break the showroom */ }
  return NextResponse.json({ ok: true, stored: true, accepted: batch.events.length });
}
