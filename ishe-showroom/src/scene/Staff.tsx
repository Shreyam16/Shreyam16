'use client';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { STAFF, type StaffSpot } from './features';
import { useShowroom } from '@/store/showroom';

/**
 * Showroom staff: AI-generated, auto-rigged 3D people (Higgsfield / Meshy) playing an idle loop.
 * They turn gently toward a visitor who comes close, and the cashier faces the customer during
 * checkout. The camera never frames a face close up.
 */
function Person({ spot }: { spot: StaffSpot }) {
  const gltf = useLoader(GLTFLoader, spot.file);
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const yaw = useRef(spot.rotY);

  const { model, mixer } = useMemo(() => {
    const model = cloneSkinned(gltf.scene) as THREE.Group;
    // Normalise height and stand the model on the floor at its spot.
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y || 1;
    model.scale.setScalar(spot.height / h);
    const box2 = new THREE.Box3().setFromObject(model);
    const c = box2.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box2.min.y, -c.z);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false; // skinned bounds can be stale during animation
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 0.8;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.time = Math.random() * clip.duration; // staff are not in lock-step
    }
    return { model, mixer };
  }, [gltf, spot.height]);

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  useFrame((_, dt) => {
    const s = useShowroom.getState();
    mixer.update(Math.min(dt, 0.1) * (s.reducedMotion ? 0 : 1));
    if (!root.current) return;
    // Turn toward a nearby visitor, within a natural range of the resting direction.
    const dx = camera.position.x - spot.x, dz = camera.position.z - spot.z;
    const dist = Math.hypot(dx, dz);
    let target = spot.rotY;
    if (s.phase === 'inside' && dist < 4.5) {
      const toward = Math.atan2(dx, dz);
      let delta = toward - spot.rotY;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      target = spot.rotY + THREE.MathUtils.clamp(delta, -0.5, 0.5);
    }
    yaw.current += (target - yaw.current) * Math.min(1, dt * 1.5);
    root.current.rotation.y = yaw.current;
  });

  return (
    <group ref={root} position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]} name={`staff-${spot.id}`}>
      <primitive object={model} />
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

export default function Staff() {
  return (
    <group>
      {STAFF.map((spot) => (
        <Guard key={spot.id}>
          <Suspense fallback={null}>
            <Person spot={spot} />
          </Suspense>
        </Guard>
      ))}
    </group>
  );
}
