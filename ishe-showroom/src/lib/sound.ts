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
