'use client';
import { useShowroom } from '@/store/showroom';

/**
 * Spoken lines from the staff (generated voices, see README). Only ever played when the visitor
 * has turned sound on; every line is also shown as text on screen, so nothing depends on audio.
 */
export type VoiceLine =
  | 'greet-attendant' | 'greet-consultant' | 'greet-cashier'
  | `tour-${'bridal' | 'everyday' | 'gifting' | 'festive' | 'around'}-${'attendant' | 'consultant'}`
  | 'counter-terminal' | 'counter-wrapping' | 'counter-handover' | 'counter-receipt';

let current: HTMLAudioElement | null = null;

export function speak(line: VoiceLine): HTMLAudioElement | null {
  if (typeof window === 'undefined' || !useShowroom.getState().sound) return null;
  stopVoice();
  const a = new Audio(`/voice/${line}.wav`);
  a.volume = 0.9;
  current = a;
  (window as unknown as { __isheVoiceLog?: string[] }).__isheVoiceLog?.push(line);
  void a.play().catch(() => undefined);
  return a;
}

/** Stops the current line; pass the element a caller started to stop only that one. */
export function stopVoice(only?: HTMLAudioElement | null) {
  if (!current || (only !== undefined && only !== current)) return;
  current.pause();
  current = null;
}
