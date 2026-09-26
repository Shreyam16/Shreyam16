'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import Architecture from './Architecture';
import Displays from './Displays';
import CameraRig from './CameraRig';
import Staff from './Staff';
import Evening from './Evening';
import WindowDisplays from './WindowDisplays';
import { useShowroom } from '@/store/showroom';
import Polish from './Polish';
import FloorReflection from './FloorReflection';
import StopExport from './StopExport';
import { detectQuality } from './quality';

/** Image-based lighting from a procedural studio room: no downloads, no extra real-time lights. */
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.background = new THREE.Color('#1b2330');
    return () => { env.dispose(); pmrem.dispose(); scene.environment = null; };
  }, [gl, scene]);
  return null;
}

/** Warn once if the device is struggling; the visitor can switch to the lite showroom. */
function PerformanceWatch({ onSlow }: { onSlow: () => void }) {
  const samples = useRef<number[]>([]);
  const fired = useRef(false);
  useFrame((_, dt) => {
    if (fired.current) return;
    samples.current.push(dt);
    if (samples.current.length === 240) {
      const avg = samples.current.slice(60).reduce((a, b) => a + b, 0) / 180;
      if (avg > 1 / 18) { fired.current = true; onSlow(); }
      samples.current = [];
    }
  });
  return null;
}

/** Feeds real loader progress (textures, models) to the branded loading screen. */
function LoadTracker() {
  useEffect(() => {
    const m = THREE.DefaultLoadingManager;
    const set = useShowroom.getState().setLoadProgress;
    m.onProgress = (_url, loaded, total) => set(total ? loaded / total : 0);
    m.onLoad = () => set(1);
    return () => { m.onProgress = () => undefined; m.onLoad = () => undefined; };
  }, []);
  return null;
}

/** Marks the scene ready after the core (Suspense) content has rendered a couple of frames. */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 2) return;
    frames.current += 1;
    if (frames.current === 2) {
      const s = useShowroom.getState();
      s.setLoadProgress(1);
      s.setSceneReady();
    }
  });
  return null;
}

export default function Showroom3D({ onSlow }: { onSlow: () => void }) {
  const phase = useShowroom((s) => s.phase);
  const tryOn = useShowroom((s) => s.tryOn);
  const ready = useShowroom((s) => s.sceneReady);
  const [quality] = useState(detectQuality);
  const [capture] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === '1');
  return (
    <Canvas
      className="!fixed inset-0"
      style={{ position: 'fixed', inset: 0, pointerEvents: phase === 'inside' ? 'auto' : 'none', touchAction: 'none' }}
      dpr={quality === 'high' ? [1, 2] : [1, 1.75]}
      // The camera try-on runs its own small renderer; pause the showroom meanwhile.
      frameloop={tryOn ? 'never' : 'always'}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: 52, near: 0.03, far: 200, position: [0, 1.65, 9.5] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.98;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.setAttribute('aria-hidden', 'true');
        gl.domElement.dataset.testid = 'showroom-canvas';
        gl.domElement.dataset.quality = detectQuality();
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          useShowroom.getState().setRenderMode('lite', 'The 3D view stopped responding on this device, so we switched to the lite showroom.');
        });
      }}
    >
      <LoadTracker />
      <Environment />
      <Evening />
      <fog attach="fog" args={['#2a3140', 30, 75]} />
      <Suspense fallback={null}>
        <Architecture />
        <Displays />
        <WindowDisplays />
        <ReadySignal />
      </Suspense>
      {/* People stream in after the room is up, so they never hold the entrance back. */}
      {ready && <Staff />}
      <CameraRig />
      {capture && <StopExport />}
      {quality === 'high' && <FloorReflection />}
      {quality === 'high' && <Polish />}
      <PerformanceWatch onSlow={onSlow} />
    </Canvas>
  );
}
