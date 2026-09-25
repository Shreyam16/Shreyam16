import { NextResponse } from 'next/server';
import { createCheckout, shopifyStatus, validateLines } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(shopifyStatus());
}

export async function POST(req: Request) {
  let body: { lines?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ mode: 'error', message: 'Invalid request.' }, { status: 400 }); }
  const lines = validateLines(body.lines);
  if (typeof lines === 'string') return NextResponse.json({ mode: 'error', message: lines }, { status: 400 });
  const buyerIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const result = await createCheckout(lines, { buyerIp });
  if (result.mode === 'error') return NextResponse.json({ mode: 'error', message: result.message }, { status: result.status });
  return NextResponse.json(result);
}
