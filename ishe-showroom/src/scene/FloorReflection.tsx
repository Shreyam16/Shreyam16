'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { DEPTH, HALF_W } from './layout';

/**
 * Soft, faint mirror of the room in the polished terrazzo ("high" tier only): the lit cases,
 * columns and light slots show in the floor the way they do in a real boutique. It is a
 * low-resolution planar reflection, blurred and added on top of the baked floor, strongest
 * straight below the camera's line of sight and fading with distance.
 */
const shader = {
  name: 'TerrazzoReflection',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.5 },
    texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec2 texel;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      // 9-tap blur: honed stone blurs what it reflects.
      vec3 c = vec3(0.0);
      float w = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
        float k = x == 0 && y == 0 ? 2.0 : 1.0;
        c += texture2D(tDiffuse, uv + vec2(float(x), float(y)) * texel * 2.5).rgb * k;
        w += k;
      }
      c /= w;
      // Only bright things (lights, lit cases, white columns) read in the reflection.
      c = max(c - 0.08, 0.0) * 1.1;
      gl_FragColor = vec4(c * strength, 1.0);
    }`,
};

export default function FloorReflection() {
  const { size, viewport } = useThree();
  const reflector = useMemo(() => {
    const geo = new THREE.PlaneGeometry(HALF_W * 2, DEPTH);
    const r = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, shader });
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.0015, -DEPTH / 2);
    const m = r.material as THREE.ShaderMaterial;
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    r.renderOrder = 2;
    r.name = 'floor-reflection';
    return r;
  }, []);

  useEffect(() => {
    // Keep the reflection's resolution in step with the canvas (about a third of it).
    const w = Math.max(256, Math.round(size.width * viewport.dpr * 0.35));
    const h = Math.max(256, Math.round(size.height * viewport.dpr * 0.35));
    reflector.getRenderTarget().setSize(w, h);
    ((reflector.material as THREE.ShaderMaterial).uniforms.texel.value as THREE.Vector2).set(1 / w, 1 / h);
  }, [reflector, size, viewport.dpr]);

  useEffect(() => () => { reflector.dispose(); reflector.geometry.dispose(); }, [reflector]);
  return <primitive object={reflector} />;
}
