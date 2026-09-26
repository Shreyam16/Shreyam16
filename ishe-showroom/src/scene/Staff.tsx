'use client';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { STAFF, STAFF_ENABLED, type StaffSpot } from './features';
import { useShowroom } from '@/store/showroom';
import { pointerWasDrag } from './input';

const HIT = new THREE.MeshBasicMaterial({ visible: false });
const HEAD_RANGE = 0.45;
const BODY_RANGE = 0.15;
/** Share of the idle clip layered over the calm base pose, and its playback speed. */
const IDLE_WEIGHT = 0.3;
const IDLE_SPEED = 0.6;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const nodAxis = new THREE.Vector3();

/**
 * Showroom staff: AI-generated, auto-rigged 3D people (Higgsfield / Meshy) playing an idle loop.
 * Head and shoulders turn gently toward a visitor who comes close. Selecting a person opens their
 * greeting (the cashier and consultant greet from the counter).
 */
function Person({ spot }: { spot: StaffSpot }) {
  const gltf = useLoader(GLTFLoader, spot.file);
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const headYaw = useRef(0);
  const fixGroup = useRef<THREE.Group>(null);
  const glance = useRef({ looking: false, left: 1 + Math.random() * 2, rest: 0 });
  // Greeting when the visitor walks into this attendant's gallery: look up, a small nod, a moment of attention.
  const greet = useRef({ room: '' as string, t: 0, nods: 0 });

  const { model, mixer, head, scale, fix, bones } = useMemo(() => {
    const model = cloneSkinned(gltf.scene) as THREE.Group;
    let height = spot.height;
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      // The mesh sits under a 0.01-scaled armature, so measure the bind-pose geometry (metres)
      // rather than the scene graph.
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      height = bb.max.y - bb.min.y || height;
      m.frustumCulled = false; // skinned bounds go stale while animating
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.envMapIntensity = 0.7;
      if (!mat.roughnessMap) mat.roughness = 0.78;
      if (!mat.metalnessMap) mat.metalness = 0;
    });
    const mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations[0];
    const dur = clip?.duration ?? 0;
    const L = model.getObjectByName('LeftArm'), R = model.getObjectByName('RightArm'), hips = model.getObjectByName('Hips');
    const LH = model.getObjectByName('LeftHand'), RH = model.getObjectByName('RightHand');
    // Generated idle clips are theatrical (big hip swings, gesturing hands). Find the calmest
    // moment of the clip (hands lowest, hips near their mean) and hold it as the base pose, then
    // layer the idle on top at low weight and slower speed: breathing and a little weight shift.
    let calm = 0;
    if (clip && hips && LH && RH) {
      const samples: { t: number; hands: number; hip: THREE.Vector3 }[] = [];
      const mean = new THREE.Vector3();
      const probe = mixer.clipAction(clip);
      probe.play();
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * dur;
        mixer.setTime(t);
        model.updateMatrixWorld(true);
        const hip = hips.getWorldPosition(new THREE.Vector3());
        samples.push({ t, hands: LH.getWorldPosition(new THREE.Vector3()).y + RH.getWorldPosition(new THREE.Vector3()).y, hip });
        mean.add(hip);
      }
      mean.divideScalar(samples.length);
      calm = samples.reduce((best, s) => {
        const score = s.hands + s.hip.distanceTo(mean) * 4;
        return score < best.score ? { score, t: s.t } : best;
      }, { score: Infinity, t: 0 }).t;
      probe.stop();
      mixer.uncacheAction(clip);
    }
    const actions: THREE.AnimationAction[] = [];
    if (clip) {
      const pose = mixer.clipAction(clip.clone());
      pose.play(); pose.time = calm; pose.timeScale = 0; pose.setEffectiveWeight(1 - IDLE_WEIGHT);
      const idle = mixer.clipAction(clip);
      idle.play(); idle.timeScale = IDLE_SPEED; idle.setEffectiveWeight(IDLE_WEIGHT);
      // Staff are not in lock-step.
      idle.time = dur > 0 ? Math.abs(spot.x * 7.31 + spot.z * 3.17) % dur : 0;
      actions.push(pose, idle);
    }
    // Measure the blended pose: which way the shoulders face and where the hips sit, so the person
    // can be turned and centred onto their spot.
    const fix = { yaw: 0, x: 0, z: 0 };
    if (L && R && hips) {
      mixer.update(0);
      model.updateMatrixWorld(true);
      const a = L.getWorldPosition(new THREE.Vector3()), b = R.getWorldPosition(new THREE.Vector3());
      const f = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), b.sub(a)).setY(0).normalize();
      const h = hips.getWorldPosition(new THREE.Vector3());
      fix.yaw = -Math.atan2(f.x, f.z);
      const c = Math.cos(fix.yaw), sn = Math.sin(fix.yaw);
      fix.x = -(h.x * c + h.z * sn);
      fix.z = -(-h.x * sn + h.z * c);
    }
    return { model, mixer, head: model.getObjectByName('Head') ?? null, scale: spot.height / height, fix, bones: L && R && hips ? { L, R, hips } : null };
  }, [gltf, spot]);

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  const pq = useMemo(() => new THREE.Quaternion(), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), h: new THREE.Vector3(), inv: new THREE.Matrix4() }), []);
  const turn = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useShowroom.getState();
    mixer.update(s.reducedMotion ? 0 : dt);
    if (!root.current) return;
    // Keep the person standing on their spot, facing their direction: the idle captures turn the
    // hips through a wide arc and drift a few centimetres. Measure the shoulder line and hips in
    // model space every frame and counter-rotate / re-centre (smoothed, so the sway stays natural).
    if (bones && fixGroup.current) {
      // Refresh parents too: on the first frame their world matrices are not computed yet.
      model.updateWorldMatrix(true, true);
      tmp.inv.copy(model.matrixWorld).invert();
      bones.L.getWorldPosition(tmp.a).applyMatrix4(tmp.inv);
      bones.R.getWorldPosition(tmp.b).applyMatrix4(tmp.inv);
      bones.hips.getWorldPosition(tmp.h).applyMatrix4(tmp.inv);
      const fx = tmp.b.z - tmp.a.z, fz = tmp.a.x - tmp.b.x; // up × (R − L), flattened
      let want = -Math.atan2(fx, fz);
      want = fix.yaw + Math.atan2(Math.sin(want - fix.yaw), Math.cos(want - fix.yaw));
      const kf = s.reducedMotion ? 1 : Math.min(1, dt * 1.2);
      fix.yaw += (want - fix.yaw) * kf;
      const c = Math.cos(fix.yaw), sn = Math.sin(fix.yaw);
      fix.x += (-(tmp.h.x * c + tmp.h.z * sn) - fix.x) * kf;
      fix.z += (-(-tmp.h.x * sn + tmp.h.z * c) - fix.z) * kf;
      fixGroup.current.rotation.y = fix.yaw;
      fixGroup.current.position.set(fix.x, 0, fix.z);
    }
    // Attention: steady, polite eye contact while the visitor is talking to this person (or is at
    // the counter, for the cashier and consultant); otherwise only an occasional glance when the
    // visitor is near, then back to a relaxed resting gaze. Never a constant stare.
    const dx = camera.position.x - spot.x, dz = camera.position.z - spot.z;
    const near = s.phase === 'inside' && Math.hypot(dx, dz) < 4.5;
    const engaged = s.phase === 'inside' && ((s.view.kind === 'staff' && (s.view.id === spot.id || (spot.id !== 'left' && spot.id !== 'right' && s.view.id !== 'left' && s.view.id !== 'right')))
      || (s.view.kind === 'cashier' && (spot.id === 'cashier' || spot.id === 'consultant')));
    const g = glance.current;
    const gr = greet.current;
    if (s.phase === 'inside' && s.room !== gr.room) {
      if ((spot.id === 'left' || spot.id === 'right') && s.room === spot.id && !s.reducedMotion) { gr.t = 3.2; gr.nods += 1; }
      gr.room = s.room;
    }
    gr.t = Math.max(0, gr.t - dt);
    g.left -= dt;
    if (g.left <= 0) {
      g.looking = near && !g.looking;
      g.left = g.looking ? 2.2 + Math.random() * 1.8 : 4 + Math.random() * 5;
      g.rest = (Math.random() - 0.5) * 0.35;
    }
    let target = s.reducedMotion ? 0 : g.rest;
    if (engaged || gr.t > 0 || (near && g.looking && !s.reducedMotion)) {
      const delta = Math.atan2(Math.sin(Math.atan2(dx, dz) - spot.rotY), Math.cos(Math.atan2(dx, dz) - spot.rotY));
      target = THREE.MathUtils.clamp(delta, -(HEAD_RANGE + BODY_RANGE), HEAD_RANGE + BODY_RANGE);
    }
    const k = s.reducedMotion ? 1 : Math.min(1, dt * 1.1);
    const bodyTarget = THREE.MathUtils.clamp(target * 0.35, -BODY_RANGE, BODY_RANGE);
    yaw.current += (bodyTarget - yaw.current) * k;
    headYaw.current += (THREE.MathUtils.clamp(target - bodyTarget, -HEAD_RANGE, HEAD_RANGE) - headYaw.current) * k;
    root.current.rotation.y = spot.rotY + yaw.current;
    root.current.userData.headYaw = headYaw.current;
    root.current.userData.animTime = mixer.time;
    root.current.userData.facingFix = fix.yaw;
    root.current.userData.bodyYaw = yaw.current;
    root.current.userData.greetings = gr.nods;
    if (head?.parent && Math.abs(headYaw.current) > 1e-3) {
      // Rotate the (already animated) head about world up: local' = parentWorld⁻¹ · R · parentWorld · local.
      root.current.updateMatrixWorld();
      head.parent.getWorldQuaternion(pq);
      turn.setFromAxisAngle(Y_AXIS, headYaw.current);
      head.quaternion.premultiply(pq).premultiply(turn).premultiply(pq.invert());
    }
    // The nod: a gentle dip of the head (about 10°) between 0.5 s and 1.4 s into the greeting.
    const since = 3.2 - gr.t;
    if (head?.parent && gr.t > 0 && since > 0.5 && since < 1.4) {
      const pitch = Math.sin(((since - 0.5) / 0.9) * Math.PI) * 0.18;
      const a = spot.rotY + yaw.current;
      root.current.updateMatrixWorld();
      head.parent.getWorldQuaternion(pq);
      turn.setFromAxisAngle(nodAxis.set(Math.cos(a), 0, -Math.sin(a)), pitch);
      head.quaternion.premultiply(pq).premultiply(turn).premultiply(pq.invert());
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (pointerWasDrag()) return;
    const s = useShowroom.getState();
    if (s.phase !== 'inside' || s.moving) return;
    s.goTo({ kind: 'staff', id: spot.id });
  };

  return (
    <group ref={root} position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]} name={`staff-${spot.id}`}>
      <group scale={scale}>
        <group ref={fixGroup} rotation={[0, fix.yaw, 0]} position={[fix.x, 0, fix.z]}>
          <primitive object={model} />
        </group>
      </group>
      {/* Invisible, cheap hit volume: raycasting a 30k-vertex skinned mesh is not needed. */}
      <mesh position={[0, spot.height / 2, 0]} material={HIT} onClick={onClick} name={`staff-hit-${spot.id}`}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        <cylinderGeometry args={[0.25, 0.25, spot.height, 10]} />
      </mesh>
    </group>
  );
}

/** A missing or broken model hides that person instead of breaking the showroom. */
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Staff model unavailable', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Read-only QA hook (e2e/run.mjs): world positions of each person's head bone and feet. */
function QaHook() {
  const { scene } = useThree();
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__isheStaff = () => STAFF.map((spot) => {
      const g = scene.getObjectByName(`staff-${spot.id}`);
      const head = g?.getObjectByName('Head');
      const toe = g?.getObjectByName('LeftToeBase');
      const v = new THREE.Vector3();
      return {
        id: spot.id, loaded: !!head,
        head: head ? head.getWorldPosition(v).toArray().map((n) => +n.toFixed(3)) : null,
        toe: toe ? toe.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3)) : null,
        headQuat: head ? head.quaternion.toArray().map((n) => +n.toFixed(4)) : null,
        headYaw: +(g?.userData.headYaw ?? 0).toFixed(3),
        animTime: +(g?.userData.animTime ?? 0).toFixed(3),
        facingFix: +(g?.userData.facingFix ?? 0).toFixed(3),
        facingErrDeg: (() => {
          const L = g?.getObjectByName('LeftArm'), R = g?.getObjectByName('RightArm');
          if (!L || !R) return null;
          const a = L.getWorldPosition(new THREE.Vector3()), b = R.getWorldPosition(new THREE.Vector3());
          const yaw = Math.atan2(b.z - a.z, a.x - b.x);
          const want = spot.rotY + (g?.userData.bodyYaw ?? 0);
          return +THREE.MathUtils.radToDeg(Math.atan2(Math.sin(yaw - want), Math.cos(yaw - want))).toFixed(1);
        })(),
        hips: g?.getObjectByName('Hips')?.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3)) ?? null,
        spine: g?.getObjectByName('Spine')?.quaternion.toArray().map((n) => +n.toFixed(5)) ?? null,
        bodyYaw: +(g?.userData.bodyYaw ?? 0).toFixed(3),
        greetings: g?.userData.greetings ?? 0,
      };
    });
    return () => { delete w.__isheStaff; };
  }, [scene]);
  return null;
}

export default function Staff() {
  if (!STAFF_ENABLED) return null;
  return (
    <group>
      {STAFF.map((spot) => (
        <Guard key={spot.id}>
          <Suspense fallback={null}>
            <Person spot={spot} />
          </Suspense>
        </Guard>
      ))}
      <QaHook />
    </group>
  );
}
