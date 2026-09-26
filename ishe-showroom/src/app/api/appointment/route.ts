import { NextResponse } from 'next/server';
import { appointmentChannel, submitAppointment } from '@/lib/appointment-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ configured: appointmentChannel() !== null });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ mode: 'error', message: 'Invalid request.' }, { status: 400 }); }
  const result = await submitAppointment(body);
  const status = result.mode === 'invalid' ? 400 : result.mode === 'error' ? 502 : 200;
  return NextResponse.json(result, { status });
}
