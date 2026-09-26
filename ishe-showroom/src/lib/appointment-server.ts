import 'server-only';
import { appointmentSummary, validateAppointment, type AppointmentRequest } from './appointment';

export type AppointmentResult =
  | { mode: 'received'; channel: 'email' | 'webhook'; message: string }
  | { mode: 'demo'; message: string }
  | { mode: 'invalid'; errors: Record<string, string> }
  | { mode: 'error'; message: string };

type Env = NodeJS.ProcessEnv;

export function appointmentChannel(env: Env = process.env): 'email' | 'webhook' | null {
  if (env.RESEND_API_KEY?.trim() && env.APPOINTMENT_EMAIL_TO?.trim()) return 'email';
  if (/^https:\/\//.test(env.APPOINTMENT_WEBHOOK_URL?.trim() ?? '')) return 'webhook';
  return null;
}

const RECEIVED = 'Request received. The store will contact you to confirm a time. This is not yet a confirmed appointment.';

/**
 * Sends an appointment request to the store only when a channel is configured (email via Resend,
 * or a JSON webhook, e.g. a spreadsheet or CRM automation). Otherwise nothing leaves the server and
 * the visitor is told plainly that this is a demo.
 */
export async function submitAppointment(input: unknown, opts: { env?: Env; fetchImpl?: typeof fetch } = {}): Promise<AppointmentResult> {
  const env = opts.env ?? process.env;
  const v = validateAppointment(input);
  if (!v.ok) return { mode: 'invalid', errors: v.errors };
  const channel = appointmentChannel(env);
  if (!channel) {
    return { mode: 'demo', message: 'Appointments are in demo mode on this deployment. Your request was not sent or stored, and no appointment has been booked.' };
  }
  const a: AppointmentRequest = v.value;
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = channel === 'email'
      ? await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.APPOINTMENT_EMAIL_FROM?.trim() || 'ISHÉ Showroom <onboarding@resend.dev>',
          to: env.APPOINTMENT_EMAIL_TO!.split(',').map((s) => s.trim()).filter(Boolean),
          reply_to: a.email,
          subject: `Appointment request: ${a.name}, ${a.date} ${a.slot}`,
          text: appointmentSummary(a),
        }),
        cache: 'no-store',
      })
      : await doFetch(env.APPOINTMENT_WEBHOOK_URL!.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'appointment_request', receivedAt: new Date().toISOString(), ...a, summary: appointmentSummary(a) }),
        cache: 'no-store',
      });
    if (!res.ok) return { mode: 'error', message: 'The request could not be sent. Please try again, or use WhatsApp.' };
  } catch {
    return { mode: 'error', message: 'The request could not be sent. Please try again, or use WhatsApp.' };
  }
  return { mode: 'received', channel, message: RECEIVED };
}
