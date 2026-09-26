'use client';
/**
 * Optional ambience, synthesised with Web Audio (no audio files). Off by default; only starts after
 * the visitor turns it on, which also satisfies browser autoplay rules.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioNode[] = [];

export function setAmbience(on: boolean) {
  if (typeof window === 'undefined') return;
  if (on) {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ctx.resume();
    if (master) return;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(master);
    // A soft, slowly beating pad: A2, E3, C#4 with slight detune.
    for (const [f, g] of [[110, 0.05], [164.8, 0.035], [277.2, 0.018], [110.4, 0.04]] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.value = g;
      o.connect(gain).connect(filter);
      o.start();
      nodes.push(o, gain);
    }
    // Room tone: brown noise, heavily low-passed, like a quiet air-conditioned boutique.
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(lp).connect(ng).connect(master);
    noise.start();
    nodes.push(noise, lp, ng);
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
  } else if (ctx && master) {
    const m = master, list = nodes;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
    m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    setTimeout(() => { list.forEach((n) => { try { (n as OscillatorNode).stop?.(); } catch { /* noop */ } n.disconnect(); }); m.disconnect(); }, 900);
    master = null;
    nodes = [];
  }
}

/** A quiet glass "ting" when a display comes into focus. */
export function chime() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  for (const [f, d] of [[1760, 1.6], [2637, 1.1]] as [number, number][]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + d);
  }
}

function noiseBurst(duration: number, freq: number, q: number, gain: number, when = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
}

/** Soft footstep on stone: a short, muffled tap with slight variation. */
export function footstep() {
  noiseBurst(0.09, 520 + Math.random() * 180, 1.4, 0.18);
  noiseBurst(0.05, 2400, 3, 0.03, 0.01);
}

/** Glass door swinging open: low air movement plus a quiet latch click. */
export function doorOpen() {
  noiseBurst(0.04, 3200, 6, 0.06);
  noiseBurst(1.4, 260, 0.7, 0.12, 0.05);
}

/** QA log of sound effects played (read by e2e/run.mjs). */
function log(name: string) {
  (globalThis as unknown as { __isheSfx?: string[] }).__isheSfx?.push(name);
}

/** Shop-door chime as the visitor steps inside: two soft bell tones. */
export function doorBell() {
  if (!ctx || !master) return;
  log('doorBell');
  const t = ctx.currentTime;
  for (const [f, at, d] of [[1318.5, 0, 1.4], [1046.5, 0.28, 1.8]] as [number, number, number][]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.06, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
    o.connect(g).connect(ctx.destination);
    o.start(t + at);
    o.stop(t + at + d);
  }
}

/** The glass lid of a case being lifted: a light click and a short glassy brush. */
export function caseLid() {
  if (!ctx || !master) return;
  log('caseLid');
  noiseBurst(0.025, 4200, 5, 0.07);
  noiseBurst(0.18, 1900, 2.5, 0.035, 0.03);
}

export function soundOn() {
  return !!master;
}
