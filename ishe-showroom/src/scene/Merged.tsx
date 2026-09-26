'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Bake every mesh under `root` into one mesh per material (world transforms relative to root). */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const rel = new THREE.Matrix4();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    rel.multiplyMatrices(inv, m.matrixWorld);
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(rel);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    g = g.index ? g.toNonIndexed() : g;
    const list = buckets.get(m.material) ?? [];
    list.push(g);
    buckets.set(m.material, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  out.name = 'merged-static';
  return out;
}

/**
 * Renders static children once, then swaps them for merged meshes (roughly one draw call per
 * material). Children must not be interactive or animated.
 */
export default function Merged({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Group | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const g = mergeByMaterial(ref.current);
    setMerged(g);
    return () => { g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); };
  }, []);
  return merged ? <primitive object={merged} /> : <group ref={ref}>{children}</group>;
}
