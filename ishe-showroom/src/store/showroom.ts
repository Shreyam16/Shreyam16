'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RoomId } from '@/data/catalogue';
import type { NodeId } from '@/scene/layout';

export type Phase = 'outside' | 'inside';
export type RenderMode = 'detecting' | '3d' | 'lite';

/** What the camera (or the lite view) is currently showing. */
export type View =
  | { kind: 'node'; node: NodeId }
  | { kind: 'product'; sku: string }
  | { kind: 'combos' }
  | { kind: 'cashier' };

export interface CartLine { sku: string; qty: number }

export interface CheckoutIntent { lines: CartLine[]; source: 'buyNow' | 'jewelBox' }

interface State {
  renderMode: RenderMode;
  liteReason: string | null;
  phase: Phase;
  entrance: number; // 0..1 scroll progress outside
  room: RoomId | 'foyer';
  view: View;
  /** View to return to when a product/combos/cashier view is closed. */
  returnView: View | null;
  /** Increments whenever a new view is requested so the camera rig can react. */
  viewNonce: number;
  /** True when the latest view change came from Back, so the camera restores its exact prior pose. */
  returning: boolean;
  moving: boolean;
  freeLook: boolean;
  cart: CartLine[];
  saved: string[];
  drawer: null | 'finder' | 'jewelBox' | 'help';
  checkout: CheckoutIntent | null;
  sound: boolean;
  reducedMotion: boolean;

  setRenderMode: (m: RenderMode, reason?: string | null) => void;
  setEntrance: (p: number) => void;
  enter: () => void;
  goTo: (view: View, opts?: { remember?: boolean }) => void;
  back: () => void;
  setRoom: (r: RoomId | 'foyer') => void;
  setMoving: (m: boolean) => void;
  setFreeLook: (f: boolean) => void;
  addToCart: (sku: string, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  removeFromCart: (sku: string) => void;
  toggleSaved: (sku: string) => void;
  openDrawer: (d: State['drawer']) => void;
  startCheckout: (intent: CheckoutIntent) => void;
  endCheckout: () => void;
  setSound: (on: boolean) => void;
  setReducedMotion: (r: boolean) => void;
}

export const useShowroom = create<State>()(
  persist(
    (set, get) => ({
      renderMode: 'detecting',
      liteReason: null,
      phase: 'outside',
      entrance: 0,
      room: 'foyer',
      view: { kind: 'node', node: 'junction' },
      returnView: null,
      viewNonce: 0,
      returning: false,
      moving: false,
      freeLook: false,
      cart: [],
      saved: [],
      drawer: null,
      checkout: null,
      sound: false,
      reducedMotion: false,

      setRenderMode: (renderMode, reason = null) => set({ renderMode, liteReason: reason }),
      setEntrance: (entrance) => set({ entrance }),
      enter: () => set({ phase: 'inside', entrance: 1, view: { kind: 'node', node: 'junction' }, room: 'foyer', moving: false }),
      goTo: (view, opts = {}) => {
        const s = get();
        const isDetail = view.kind !== 'node';
        // Remember where we stood before the first detail view so "Back" returns there.
        const returnView = isDetail ? (opts.remember === false ? s.returnView : s.view.kind === 'node' ? s.view : s.returnView ?? s.view) : null;
        set({ view, returnView, viewNonce: s.viewNonce + 1, returning: false, drawer: null, freeLook: false, moving: s.renderMode === '3d' });
      },
      back: () => {
        const s = get();
        const target = s.returnView ?? { kind: 'node', node: 'junction' };
        set({ view: target, returnView: null, viewNonce: s.viewNonce + 1, returning: true, moving: s.renderMode === '3d', checkout: s.view.kind === 'cashier' ? null : s.checkout });
      },
      setRoom: (room) => set({ room }),
      setMoving: (moving) => set({ moving }),
      setFreeLook: (freeLook) => set({ freeLook }),
      addToCart: (sku, qty = 1) => {
        const cart = [...get().cart];
        const line = cart.find((l) => l.sku === sku);
        if (line) line.qty = Math.min(10, line.qty + qty);
        else cart.push({ sku, qty });
        set({ cart: cart.map((l) => ({ ...l })) });
      },
      setQty: (sku, qty) => set({ cart: get().cart.map((l) => (l.sku === sku ? { ...l, qty: Math.max(1, Math.min(10, qty)) } : l)) }),
      removeFromCart: (sku) => set({ cart: get().cart.filter((l) => l.sku !== sku) }),
      toggleSaved: (sku) => {
        const saved = get().saved;
        set({ saved: saved.includes(sku) ? saved.filter((s) => s !== sku) : [...saved, sku] });
      },
      openDrawer: (drawer) => set({ drawer }),
      startCheckout: (checkout) => {
        const s = get();
        const returnView = s.view.kind === 'node' ? s.view : s.returnView ?? s.view;
        set({ checkout, view: { kind: 'cashier' }, returnView, viewNonce: s.viewNonce + 1, returning: false, drawer: null, moving: s.renderMode === '3d' });
      },
      endCheckout: () => get().back(),
      setSound: (sound) => set({ sound }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: 'ishe-showroom',
      version: 1,
      storage: createJSONStorage(() => {
        try {
          const k = '__ishe_probe';
          window.localStorage.setItem(k, '1');
          window.localStorage.removeItem(k);
          return window.localStorage;
        } catch {
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
      // Only the Jewel Box and saved list persist; the journey always starts outside.
      partialize: (s) => ({ cart: s.cart, saved: s.saved }),
    },
  ),
);

export const cartCount = (cart: CartLine[]) => cart.reduce((n, l) => n + l.qty, 0);
