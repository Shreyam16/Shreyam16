'use client';
import { useShowroom } from '@/store/showroom';
import type { EventName, EventProps, AnalyticsEvent } from './analytics-schema';

/**
 * First-party, cookie-free analytics. Events are batched and sent to /api/analytics with
 * navigator.sendBeacon; the server forwards them only if ANALYTICS_WEBHOOK_URL is set. Honours Do Not
 * Track and Global Privacy Control, and records nothing personal.
 */
let queue: AnalyticsEvent[] = [];
let session = '';
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;

function enabled() {
  if (typeof window === 'undefined') return false;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return !(n.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1' || n.globalPrivacyControl === true);
}

function sessionId() {
  if (session) return session;
  try {
    session = sessionStorage.getItem('ishe-a') ?? '';
    if (!session) { session = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); sessionStorage.setItem('ishe-a', session); }
  } catch { session = Math.random().toString(36).slice(2, 14); }
  return session;
}

export function flush() {
  if (!queue.length || !enabled()) { queue = []; return; }
  const body = JSON.stringify({ session: sessionId(), mode: useShowroom.getState().renderMode, events: queue });
  queue = [];
  (window as unknown as { __isheAnalytics?: string[] }).__isheAnalytics?.push(body);
  const blob = new Blob([body], { type: 'application/json' });
  if (!navigator.sendBeacon?.('/api/analytics', blob)) void fetch('/api/analytics', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
}

export function track(name: EventName, props?: EventProps) {
  if (!enabled()) return;
  queue.push({ name, t: Date.now(), ...(props ? { props } : {}) });
  if (!started) {
    started = true;
    queue.unshift({ name: 'session_start', t: Date.now() });
    timer = setInterval(flush, 15000);
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  if (queue.length >= 40) flush();
}

/** Room and piece dwell times, derived from the showroom state (no extra UI hooks needed). */
export function startDwellTracking() {
  let room = useShowroom.getState().room, roomSince = performance.now();
  let piece: string | null = null, pieceSince = 0;
  const unsub = useShowroom.subscribe((s) => {
    const now = performance.now();
    if (s.phase === 'inside' && s.room !== room) {
      if (now - roomSince > 1500) track('room_dwell', { room, seconds: Math.round((now - roomSince) / 100) / 10 });
      room = s.room; roomSince = now;
    }
    const p = s.view.kind === 'product' && !s.moving ? s.view.sku : null;
    if (p !== piece) {
      if (piece && now - pieceSince > 1000) track('piece_dwell', { sku: piece, seconds: Math.round((now - pieceSince) / 100) / 10 });
      piece = p; pieceSince = now;
    }
  });
  return () => { unsub(); if (timer) clearInterval(timer); };
}
