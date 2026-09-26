'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useShowroom, type View } from '@/store/showroom';
import {
  EYE, cashierPose, comboPose, focusPose, nodePose, roomAt, routeTo, slideMove, staffPose, type Pose,
} from './layout';
import { doorOpen, footstep, soundOn, doorBell } from '@/lib/sound';
import { clearHeld, held, notePointerDown, notePointerMove, pointerWasDrag, type HeldKey } from './input';

const KEYS: Record<string, HeldKey> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyD: 'right', ArrowLeft: 'turnLeft', ArrowRight: 'turnRight', KeyQ: 'turnLeft', KeyE: 'turnRight',
};

const lerp = THREE.MathUtils.lerp;
const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);

/**
 * Scroll-driven approach, framed like a film shot: it opens on a three-quarter view from across the
 * pavement, arcs round to face the storefront while pushing in, the doors swing open, and the camera
 * glides through the doorway to the junction, looking down the aisle to the hero piece.
 */
export function entrancePose(p: number): Pose {
  const keys = [[0, 10.5], [0.22, 5.6], [0.62, 1.9], [1, -2.8]];
  let z = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p0, z0] = keys[i - 1], [p1, z1] = keys[i];
    if (p <= p1) { z = lerp(z0, z1, THREE.MathUtils.clamp((p - p0) / (p1 - p0), 0, 1)); break; }
    z = z1;
  }
  const look = smooth(p, 0.35, 1);
  const end = nodePose('junction');
  // Arc in from the left of the street, square to the door by the time it opens.
  const arc = 1 - smooth(p, 0, 0.3);
  return {
    x: -4.4 * arc, y: EYE + 0.15 * arc, z,
    tx: 0, ty: lerp(2.35, end.ty, look), tz: lerp(0, end.tz, look),
  };
}

function destination(view: View): Pose {
  switch (view.kind) {
    case 'node': return nodePose(view.node);
    case 'product': return focusPose(view.sku);
    case 'combos': return comboPose();
    case 'cashier': return cashierPose();
    case 'staff': return staffPose(view.id);
  }
}

export default function CameraRig() {
  const { camera, gl, size } = useThree();
  const pose = useRef<Pose>(entrancePose(0));
  const saved = useRef<Pose | null>(null);
  const lastNonce = useRef(-1);
  const tween = useRef<gsap.core.Tween | null>(null);
  const yawDrag = useRef<{ x: number; y: number } | null>(null);
  const wasInside = useRef(false);
  const offset = useRef(0);
  const stride = useRef(0);
  const lastXZ = useRef({ x: 0, z: 0 });
  const doorPlayed = useRef(false);

  // Field of view suits portrait phones as well as desktop; it narrows gently ("leaning in")
  // when a single display is in focus.
  const baseFov = size.width / size.height < 0.8 ? 68 : 52;

  // Look-around by dragging the canvas; clicks stay clicks (see input.ts).
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { notePointerDown(e.clientX, e.clientY); yawDrag.current = { x: e.clientX, y: e.clientY }; };
    const move = (e: PointerEvent) => {
      if (!yawDrag.current || !(e.buttons & 1)) return;
      notePointerMove(e.clientX, e.clientY);
      const s = useShowroom.getState();
      if (!pointerWasDrag() || s.phase !== 'inside' || s.moving) return;
      const dx = e.clientX - yawDrag.current.x, dy = e.clientY - yawDrag.current.y;
      yawDrag.current = { x: e.clientX, y: e.clientY };
      rotateView(pose.current, -dx * 0.0042, -dy * 0.003);
    };
    const up = () => { yawDrag.current = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [gl]);

  // Keyboard walking (WASD / arrows). Ignored while typing or while a panel or drawer is open.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      const s = useShowroom.getState();
      if (!k || typing(e) || s.phase !== 'inside' || s.view.kind !== 'node' || s.drawer) return;
      held[k] = true;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) held[k] = false; };
    const blur = () => clearHeld();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => () => { tween.current?.kill(); }, []);

  // Read-only hooks for automated QA (e2e/run.mjs): project a world point to screen pixels and
  // read the current camera pose.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__isheProject = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 };
    };
    w.__isheCamera = () => ({ ...pose.current });
    // Counts every draw call in one whole frame (post-processing would otherwise report only its
    // last pass): stop auto-reset, reset after one frame, read after the next.
    w.__isheRenderInfo = () => new Promise((resolve) => {
      gl.info.autoReset = false;
      requestAnimationFrame(() => {
        gl.info.reset();
        requestAnimationFrame(() => {
          const out = { ...gl.info.render, programs: gl.info.programs?.length, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
          gl.info.autoReset = true;
          resolve(out);
        });
      });
    });
    return () => { delete w.__isheProject; delete w.__isheCamera; delete w.__isheRenderInfo; };
  }, [camera, gl]);

  function startNav() {
    const s = useShowroom.getState();
    lastNonce.current = s.viewNonce;
    tween.current?.kill();
    clearHeld();

    let dest = destination(s.view);
    if (s.view.kind === 'node') {
      if (s.returning && saved.current) dest = saved.current;
      saved.current = null;
    } else if (!saved.current) {
      saved.current = { ...pose.current };
    }

    const from = { ...pose.current };
    const route = routeTo(from.x, from.z, dest);
    const curve = new THREE.CatmullRomCurve3(route.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal', 0.5);
    const length = route.length > 1 ? curve.getLength() : 0;
    const reduced = s.reducedMotion;
    const turn = Math.hypot(from.tx - dest.tx, from.ty - dest.ty, from.tz - dest.tz);
    const trivial = length < 0.05 && Math.hypot(from.x - dest.x, from.z - dest.z) < 0.05 && turn < 0.05;
    const duration = reduced || trivial ? 0 : THREE.MathUtils.clamp(length / 1.9 + 0.9, 1.1, 7);
    const startT = new THREE.Vector3(from.tx, from.ty, from.tz);
    const endT = new THREE.Vector3(dest.tx, dest.ty, dest.tz);
    const ahead = new THREE.Vector3();
    const state = { t: 0 };
    const apply = () => {
      const t = state.t;
      const p = length > 0.05 ? curve.getPointAt(t) : new THREE.Vector3(lerp(from.x, dest.x, t), 0, lerp(from.z, dest.z, t));
      const out = pose.current;
      out.x = p.x; out.z = p.z;
      out.y = lerp(from.y, dest.y, smooth(t, 0.5, 1));
      let target: THREE.Vector3;
      if (length > 0.6) {
        const tt = Math.min(1, t + 0.06);
        const q = curve.getPointAt(tt);
        const dir = q.sub(p);
        if (dir.lengthSq() < 1e-6) dir.set(endT.x - p.x, 0, endT.z - p.z);
        dir.normalize();
        ahead.set(p.x + dir.x * 3, 1.45, p.z + dir.z * 3);
        target = ahead.clone().lerp(startT, 1 - smooth(t, 0, 0.18)).lerp(endT, smooth(t, 0.55, 1));
      } else {
        target = startT.clone().lerp(endT, smooth(t, 0, 1));
      }
      out.tx = target.x; out.ty = target.y; out.tz = target.z;
    };
    const done = () => {
      Object.assign(pose.current, dest);
      const st = useShowroom.getState();
      st.setMoving(false);
      st.setRoom(roomAt(dest.x, dest.z));
    };
    if (duration === 0) { apply(); state.t = 1; done(); return; }
    s.setMoving(true);
    tween.current = gsap.to(state, { t: 1, duration, ease: 'power2.inOut', onUpdate: apply, onComplete: done });
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useShowroom.getState();
    if (s.phase === 'outside') {
      Object.assign(pose.current, entrancePose(s.entrance));
    } else {
      if (!wasInside.current) {
        // Crossing the threshold: finish the entrance exactly at the junction, then hand over.
        // Any view requested meanwhile (e.g. a room chosen before this frame) still runs below.
        wasInside.current = true;
        Object.assign(pose.current, entrancePose(1));
        if (soundOn()) doorBell();
        lastNonce.current = -1;
      }
      if (s.viewNonce !== lastNonce.current) startNav();
      if (!s.moving && s.view.kind === 'node' && !s.drawer) walk(dt);
    }
    const p = pose.current;
    camera.position.set(p.x, p.y, p.z);
    // Outside, a faint hand-held drift keeps the street shot alive (never with reduced motion).
    if (s.phase === 'outside' && !s.reducedMotion) {
      const t = performance.now() / 1000;
      camera.position.x += Math.sin(t * 0.53) * 0.035;
      camera.position.y += Math.sin(t * 0.81 + 1.3) * 0.018;
    }
    camera.lookAt(p.tx, p.ty, p.tz);
    // Optional sound: a footstep every ~0.7 m walked, and the door as it starts to swing.
    if (soundOn()) {
      stride.current += Math.hypot(p.x - lastXZ.current.x, p.z - lastXZ.current.z);
      if (stride.current > 0.7) { stride.current = 0; footstep(); }
      if (!doorPlayed.current && s.phase === 'outside' && s.entrance > 0.2) { doorPlayed.current = true; doorOpen(); }
    }
    if (s.phase === 'outside' && s.entrance < 0.1) doorPlayed.current = false;
    lastXZ.current = { x: p.x, z: p.z };
    const cam = camera as THREE.PerspectiveCamera;
    const k = s.reducedMotion ? 1 : Math.min(1, Math.min(dtRaw, 1) * 2.5);
    const zoom = s.phase === 'inside' && s.view.kind === 'product' ? focusPose(s.view.sku).zoom ?? 1 : 1;
    const want = baseFov * zoom;
    const nextFov = cam.fov + (want - cam.fov) * k;
    // Shift the projection so the focused piece sits in the space left of the side panel (desktop).
    const panel = s.phase === 'inside' && s.view.kind !== 'node' && size.width >= 768 ? (s.view.kind === 'product' || s.view.kind === 'staff' ? 416 : 476) : 0;
    const nextOff = offset.current + (panel / 2 - offset.current) * k;
    if (Math.abs(nextFov - cam.fov) > 0.01 || Math.abs(nextOff - offset.current) > 0.1) {
      cam.fov = nextFov;
      offset.current = nextOff;
      if (Math.abs(nextOff) > 0.5) cam.setViewOffset(size.width, size.height, nextOff, 0, size.width, size.height);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
  });

  function walk(dt: number) {
    const turn = (held.turnRight ? 1 : 0) - (held.turnLeft ? 1 : 0);
    const fwd = (held.forward ? 1 : 0) - (held.back ? 1 : 0);
    const strafe = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (!turn && !fwd && !strafe) return;
    const p = pose.current;
    if (turn) rotateView(p, -turn * 1.5 * dt, 0);
    if (fwd || strafe) {
      const dir = new THREE.Vector3(p.tx - p.x, 0, p.tz - p.z).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const speed = 1.35 * dt;
      const dx = (dir.x * fwd + right.x * strafe) * speed;
      const dz = (dir.z * fwd + right.z * strafe) * speed;
      const next = slideMove(p.x, p.z, dx, dz);
      const mx = next.x - p.x, mz = next.z - p.z;
      p.x += mx; p.z += mz; p.tx += mx; p.tz += mz;
      // Settle to eye height after any focus pose.
      p.y += (EYE - p.y) * Math.min(1, dt * 4);
    }
    const s = useShowroom.getState();
    const r = roomAt(p.x, p.z);
    if (r !== s.room) s.setRoom(r);
    if (!s.freeLook) s.setFreeLook(true);
  }

  return null;
}

/** Yaw/pitch the look target around the camera, keeping pitch within a comfortable range. */
function rotateView(p: Pose, dYaw: number, dPitch: number) {
  const dir = new THREE.Vector3(p.tx - p.x, p.ty - p.y, p.tz - p.z);
  const dist = Math.max(1.2, dir.length());
  const sph = new THREE.Spherical().setFromVector3(dir);
  sph.theta += dYaw;
  sph.phi = THREE.MathUtils.clamp(sph.phi - dPitch, Math.PI / 2 - 0.55, Math.PI / 2 + 0.6);
  sph.radius = dist;
  dir.setFromSpherical(sph);
  p.tx = p.x + dir.x; p.ty = p.y + dir.y; p.tz = p.z + dir.z;
}
