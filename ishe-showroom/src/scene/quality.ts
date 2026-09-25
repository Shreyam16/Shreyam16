/**
 * Rendering tier. "high" adds post-processing (ambient occlusion, bloom, SMAA) on capable
 * desktops; phones and small or low-memory devices stay on "standard". `?quality=high|standard`
 * overrides for QA.
 */
export type Quality = 'high' | 'standard';

export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'standard';
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'high' || q === 'standard') return q;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const lowMem = nav.deviceMemory !== undefined && nav.deviceMemory < 4;
  return coarse || small || lowMem ? 'standard' : 'high';
}
