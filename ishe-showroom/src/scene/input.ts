/** Shared pointer state so a look-drag on the canvas is never mistaken for a click on a display. */
let downX = 0, downY = 0, dragged = false;
export function notePointerDown(x: number, y: number) { downX = x; downY = y; dragged = false; }
export function notePointerMove(x: number, y: number) { if (Math.hypot(x - downX, y - downY) > 6) dragged = true; }
export function pointerWasDrag() { return dragged; }

/** Held movement keys / on-screen pad buttons. */
export const held = { forward: false, back: false, left: false, right: false, turnLeft: false, turnRight: false };
export type HeldKey = keyof typeof held;
export function clearHeld() { (Object.keys(held) as HeldKey[]).forEach((k) => (held[k] = false)); }
