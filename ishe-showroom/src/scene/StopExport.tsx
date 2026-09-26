'use client';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { NODES, nodePose, type NodeId } from './layout';

/** Decals and helpers that only fake light in real time; Cycles computes real light instead. */
const DROP = new Set(['pool', 'wash', 'facadeWash', 'ao', 'shadow', 'highlight', 'sky', 'floorGloss']);

/**
 * Capture-only (`?capture=1`): exports the live scene as glTF plus the exact camera pose of every
 * room stop, for bake/render_stops.py to render photoreal stills with Blender Cycles. Nothing here
 * runs for visitors; the exporter is loaded on demand.
 */
export default function StopExport() {
  const { scene } = useThree();
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__isheExportStops = async () => {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const hidden: THREE.Object3D[] = [];
      const swapped: { mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const m = mesh.material as THREE.Material & { map?: THREE.Texture | null; color?: THREE.Color; lightMap?: THREE.Texture | null; blending?: THREE.Blending };
        if (Array.isArray(mesh.material)) return;
        const drop = mesh.name === 'floor-reflection' || !m.visible || DROP.has(m.name) || m.blending === THREE.AdditiveBlending
          || (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh;
        if (drop) { mesh.visible = false; hidden.push(mesh); return; }
        if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
          // Baked walls/floor and printed plaques: export as ordinary lit surfaces with their texture.
          const floor = mesh.name === 'baked-floor';
          const std = new THREE.MeshStandardMaterial({
            map: m.map ?? null, color: m.color?.clone() ?? new THREE.Color('#ffffff'),
            roughness: floor ? 0.22 : mesh.name.startsWith('baked-') ? 0.9 : 0.5, metalness: 0,
            transparent: m.transparent, opacity: m.opacity,
          });
          std.name = floor ? 'terrazzo' : mesh.name.startsWith('baked-') ? 'plaster' : 'print';
          swapped.push({ mesh, mat: mesh.material });
          mesh.material = std;
        }
      });
      try {
        const exporter = new GLTFExporter();
        const glb = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 }) as ArrayBuffer;
        let bin = '';
        const bytes = new Uint8Array(glb);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const stops = (Object.keys(NODES) as NodeId[]).map((key) => ({ key, ...nodePose(key) }));
        return { glb: btoa(bin), stops, fov: { land: 52, port: 68 } };
      } finally {
        hidden.forEach((o) => { o.visible = true; });
        swapped.forEach(({ mesh, mat }) => { mesh.material = mat; });
      }
    };
    return () => { delete w.__isheExportStops; };
  }, [scene]);
  return null;
}
