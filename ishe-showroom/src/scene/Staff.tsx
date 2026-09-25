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
const HEAD_RANGE = 0.55;
const BODY_RANGE = 0.3;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

  const { model, mixer, head, scale } = useMemo(() => {
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
      mat.roughness = 0.78;
      mat.metalness = 0;
    });
    const mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.time = (spot.x * 7.31 + spot.z * 3.17) % clip.duration; // staff are not in lock-step
      if (action.time < 0) action.time += clip.duration;
    }
    return { model, mixer, head: model.getObjectByName('Head') ?? null, scale: spot.height / height };
  }, [gltf, spot]);

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  const pq = useMemo(() => new THREE.Quaternion(), []);
  const turn = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useShowroom.getState();
    mixer.update(s.reducedMotion ? 0 : dt);
    if (!root.current) return;
    // Look toward a nearby visitor, within a natural range of the resting direction: most of the
    // turn in the head, a little in the shoulders.
    const dx = camera.position.x - spot.x, dz = camera.position.z - spot.z;
    let target = 0;
    if (s.phase === 'inside' && Math.hypot(dx, dz) < 4.8) {
      const delta = Math.atan2(Math.sin(Math.atan2(dx, dz) - spot.rotY), Math.cos(Math.atan2(dx, dz) - spot.rotY));
      target = THREE.MathUtils.clamp(delta, -(HEAD_RANGE + BODY_RANGE), HEAD_RANGE + BODY_RANGE);
    }
    const k = s.reducedMotion ? 1 : Math.min(1, dt * 1.6);
    const bodyTarget = THREE.MathUtils.clamp(target * 0.35, -BODY_RANGE, BODY_RANGE);
    yaw.current += (bodyTarget - yaw.current) * k;
    headYaw.current += (THREE.MathUtils.clamp(target - bodyTarget, -HEAD_RANGE, HEAD_RANGE) - headYaw.current) * k;
    root.current.rotation.y = spot.rotY + yaw.current;
    if (head?.parent && Math.abs(headYaw.current) > 1e-3) {
      // Rotate the (already animated) head about world up: local' = parentWorld⁻¹ · R · parentWorld · local.
      root.current.updateMatrixWorld();
      head.parent.getWorldQuaternion(pq);
      turn.setFromAxisAngle(Y_AXIS, headYaw.current);
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
        <primitive object={model} />
      </group>
      {/* Invisible, cheap hit volume: raycasting a 30k-vertex skinned mesh is not needed. */}
      <mesh position={[0, spot.height / 2, 0]} material={HIT} onClick={onClick} name={`staff-hit-${spot.id}`}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        <cylinderGeometry args={[0.3, 0.3, spot.height, 10]} />
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
