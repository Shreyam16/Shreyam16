/**
 * Showroom analytics events: what was looked at and for how long, never who. No names, contact
 * details, free text or IP addresses are collected; the session id is random per browser tab.
 */
export const EVENT_NAMES = [
  'session_start', 'room_dwell', 'piece_dwell', 'add_to_box', 'save_piece', 'try_on_open', 'try_on_result',
  'tour_start', 'staff_greeting', 'appointment_submit', 'checkout_start', 'share_box', 'whatsapp_click',
  'evening_toggle', 'sound_toggle',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export type EventProps = Record<string, string | number | boolean>;
export interface AnalyticsEvent { name: EventName; t: number; props?: EventProps }
export interface AnalyticsBatch { session: string; mode: string; events: AnalyticsEvent[] }

const PROP_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const SAFE_STRING = /^[A-Za-z0-9 _\-.:/]{0,64}$/;

/** Validates a batch; drops anything that is not an allowed event or a short, safe value. */
export function cleanBatch(input: unknown): AnalyticsBatch | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const session = typeof raw.session === 'string' && /^[a-z0-9]{8,32}$/.test(raw.session) ? raw.session : null;
  if (!session || !Array.isArray(raw.events)) return null;
  const mode = raw.mode === '3d' || raw.mode === 'lite' ? raw.mode : 'unknown';
  const events: AnalyticsEvent[] = [];
  for (const e of raw.events.slice(0, 100)) {
    const ev = (e ?? {}) as Record<string, unknown>;
    if (typeof ev.name !== 'string' || !(EVENT_NAMES as readonly string[]).includes(ev.name)) continue;
    const t = Number(ev.t);
    const props: EventProps = {};
    for (const [k, v] of Object.entries((ev.props ?? {}) as Record<string, unknown>).slice(0, 12)) {
      if (!PROP_KEY.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) props[k] = Math.round(v * 1000) / 1000;
      else if (typeof v === 'boolean') props[k] = v;
      else if (typeof v === 'string' && SAFE_STRING.test(v)) props[k] = v;
    }
    events.push({ name: ev.name as EventName, t: Number.isFinite(t) ? Math.round(t) : 0, ...(Object.keys(props).length ? { props } : {}) });
  }
  return { session, mode, events };
}
