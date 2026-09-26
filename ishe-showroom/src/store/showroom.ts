'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RoomId } from '@/data/catalogue';
import { tourStops, type NodeId, type TourId, type TourStop } from '@/scene/layout';
import type { StaffId } from '@/scene/features';

export type Phase = 'outside' | 'inside';
export type RenderMode = 'detecting' | '3d' | 'lite';

/** What the camera (or the lite view) is currently showing. */
export type View =
  | { kind: 'node'; node: NodeId }
  | { kind: 'product'; sku: string }
  | { kind: 'combos' }
  | { kind: 'cashier' }
  | { kind: 'staff'; id: StaffId };

export interface Tour { id: TourId; stops: TourStop[]; index: number; /** Where the visitor stood when the tour began. */ ret: View }

export interface CartLine { sku: string; qty: number }

export interface CheckoutIntent { lines: CartLine[]; source: 'buyNow' | 'jewelBox' }

/**
 * The in-store demo ceremony at the counter (only when Shopify is not connected): card terminal,
 * gift wrapping, hand-over, then a receipt clearly marked SAMPLE. Nothing is charged or ordered.
 */
export type CeremonyStage = 'terminal' | 'wrapping' | 'handover' | 'receipt';
export interface Ceremony { stage: CeremonyStage; ref: string; at: string; giftWrap: boolean; giftNote: string; engraving: string }

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
  /** Room stop the camera is resting exactly at (a photo stop can show), or null while moving. */
  still: string | null;
  cart: CartLine[];
  saved: string[];
  drawer: null | 'finder' | 'jewelBox' | 'help' | 'appointment';
  tour: Tour | null;
  /** SKU being previewed in the camera try-on, if open. */
  tryOn: string | null;
  /** Selection decoded from a shared Jewel Box link, shown once the visitor is inside. */
  shared: CartLine[] | null;
  evening: boolean;
  /** Real asset-loading progress (0..1) and whether the first frame has rendered. */
  loadProgress: number;
  sceneReady: boolean;
  ceremony: Ceremony | null;
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
  setStill: (k: string | null) => void;
  addToCart: (sku: string, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  removeFromCart: (sku: string) => void;
  toggleSaved: (sku: string) => void;
  openDrawer: (d: State['drawer']) => void;
  startCheckout: (intent: CheckoutIntent) => void;
  endCheckout: () => void;
  setSound: (on: boolean) => void;
  setReducedMotion: (r: boolean) => void;
  startTour: (id: TourId) => void;
  tourStep: (delta: 1 | -1) => void;
  stopTour: () => void;
  openTryOn: (sku: string | null) => void;
  setShared: (lines: CartLine[] | null) => void;
  addShared: () => void;
  setEvening: (on: boolean) => void;
  setLoadProgress: (p: number) => void;
  setSceneReady: () => void;
  setCeremony: (c: Ceremony | null) => void;
}

function stopView(stop: TourStop): View {
  return stop.kind === 'product' ? { kind: 'product', sku: stop.sku } : stop.kind === 'combos' ? { kind: 'combos' } : { kind: 'node', node: stop.node };
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
      still: null,
      cart: [],
      saved: [],
      drawer: null,
      checkout: null,
      sound: false,
      reducedMotion: false,
      tour: null,
      tryOn: null,
      shared: null,
      evening: true,
      loadProgress: 0,
      sceneReady: false,
      ceremony: null,

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
        set({ view: target, returnView: null, tour: null, ceremony: null, viewNonce: s.viewNonce + 1, returning: true, moving: s.renderMode === '3d', checkout: s.view.kind === 'cashier' ? null : s.checkout });
      },
      setRoom: (room) => set({ room }),
      setMoving: (moving) => set({ moving }),
      setFreeLook: (freeLook) => set({ freeLook }),
      setStill: (still) => set({ still }),
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
        set({ checkout, ceremony: null, view: { kind: 'cashier' }, returnView, viewNonce: s.viewNonce + 1, returning: false, drawer: null, moving: s.renderMode === '3d' });
      },
      endCheckout: () => get().back(),
      setSound: (sound) => set({ sound }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      startTour: (id) => {
        const stops = tourStops(id);
        const s = get();
        if (!stops.length) return;
        const ret: View = s.tour?.ret ?? (s.view.kind === 'node' ? s.view : s.returnView ?? { kind: 'node', node: 'junction' });
        set({ tour: { id, stops, index: 0, ret } });
        get().goTo(stopView(stops[0]), { remember: false });
        set({ returnView: ret });
      },
      tourStep: (delta) => {
        const t = get().tour;
        if (!t) return;
        const index = t.index + delta;
        if (index < 0 || index >= t.stops.length) return;
        set({ tour: { ...t, index } });
        get().goTo(stopView(t.stops[index]), { remember: false });
        set({ returnView: t.ret });
      },
      stopTour: () => {
        const t = get().tour;
        if (!t) return;
        const s = get();
        set({ tour: null, view: t.ret, returnView: null, viewNonce: s.viewNonce + 1, returning: true, drawer: null, moving: s.renderMode === '3d' });
      },
      openTryOn: (tryOn) => set({ tryOn }),
      setShared: (shared) => set({ shared }),
      addShared: () => {
        const lines = get().shared ?? [];
        for (const l of lines) get().addToCart(l.sku, l.qty);
        set({ shared: null });
      },
      setEvening: (evening) => set({ evening }),
      setLoadProgress: (loadProgress) => set({ loadProgress: Math.max(get().loadProgress, Math.min(1, loadProgress)) }),
      setSceneReady: () => set({ sceneReady: true }),
      setCeremony: (ceremony) => set({ ceremony }),
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
