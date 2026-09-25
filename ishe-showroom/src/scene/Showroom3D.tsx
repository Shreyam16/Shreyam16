'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import Architecture from './Architecture';
import Displays from './Displays';
import CameraRig from './CameraRig';
import { useShowroom } from '@/store/showroom';
import Polish from './Polish';
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

export default function Showroom3D({ onSlow }: { onSlow: () => void }) {
  const phase = useShowroom((s) => s.phase);
  const [quality] = useState(detectQuality);
  return (
    <Canvas
      className="!fixed inset-0"
      style={{ position: 'fixed', inset: 0, pointerEvents: phase === 'inside' ? 'auto' : 'none', touchAction: 'none' }}
      dpr={[1, 1.75]}
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
      <Environment />
      <hemisphereLight args={['#fff3e3', '#cfc6b8', 0.45]} />
      <directionalLight position={[-6, 12, 10]} intensity={0.9} color="#fff4e6" />
      <fog attach="fog" args={['#2a3140', 30, 75]} />
      <Suspense fallback={null}>
        <Architecture />
        <Displays />
      </Suspense>
      <CameraRig />
      {quality === 'high' && <Polish />}
      <PerformanceWatch onSlow={onSlow} />
    </Canvas>
  );
}
