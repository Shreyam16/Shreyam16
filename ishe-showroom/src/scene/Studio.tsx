'use client';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PRODUCT_BY_SKU, type Category } from '@/data/catalogue';
import { buildPiece } from './jewellery';

const FRAMING: Record<Category, { target: [number, number, number]; cam: [number, number, number] }> = {
  necklace: { target: [0, 0.29, 0], cam: [0.12, 0.4, 0.62] },
  pendant: { target: [0, 0.2, 0], cam: [0.1, 0.3, 0.5] },
  bracelet: { target: [0, 0.07, 0], cam: [0.2, 0.17, 0.26] },
  earring: { target: [0, 0.1, 0], cam: [0.05, 0.125, 0.21] },
  ring: { target: [0, 0.058, 0], cam: [0.06, 0.1, 0.12] },
};

function Scene({ sku, onReady }: { sku: string; onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const product = PRODUCT_BY_SKU[sku];
  const piece = useMemo(() => buildPiece(product), [product]);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const f = FRAMING[product.category];
    camera.position.set(...f.cam);
    camera.lookAt(...f.target);
    const t = setTimeout(onReady, 800);
    return () => clearTimeout(t);
  }, [gl, scene, camera, product, onReady]);
  return (
    <>
      <hemisphereLight args={['#fff6ea', '#d9d0c2', 0.7]} />
      <directionalLight position={[1, 2, 1.5]} intensity={1.4} color="#fff1dc" />
      <directionalLight position={[-1.5, 1, -0.5]} intensity={0.5} color="#dfe6ff" />
      <primitive object={piece} />
      {/* Linen cyclorama. */}
      <mesh position={[0, 0, -0.35]} >
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#ebe4d8" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#e6dfd2" roughness={1} />
      </mesh>
    </>
  );
}

export default function Studio() {
  const [sku, setSku] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSku(new URLSearchParams(window.location.search).get('sku') ?? 'ISH-N01'); }, []);
  useEffect(() => { (window as unknown as { __studioReady?: boolean }).__studioReady = ready; }, [ready]);
  if (!sku || !PRODUCT_BY_SKU[sku]) return <p>Unknown SKU</p>;
  return (
    <div id="studio" style={{ position: 'relative', width: 1200, height: 900, background: '#ebe4d8' }}>
      <Canvas
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={1}
        camera={{ fov: 30, near: 0.005, far: 20 }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.0; }}
      >
        <color attach="background" args={['#ebe4d8']} />
        <fog attach="fog" args={['#ebe4d8', 0.8, 3]} />
        <Scene sku={sku} onReady={() => setReady(true)} />
      </Canvas>
      <span style={{ position: 'absolute', right: 28, bottom: 22, font: '500 15px Jost, sans-serif', letterSpacing: '0.3em', color: 'rgba(13,13,13,0.6)' }}>
        SAMPLE RENDER
      </span>
    </div>
  );
}
