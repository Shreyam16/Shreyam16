'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Bloom, BrightnessContrast, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { Effect, ToneMappingMode } from 'postprocessing';
import { useShowroom } from '@/store/showroom';

/**
 * White balance toward the film's 2700 K amber, easing off only at the very top so the lit ISHÉ
 * plaque (drawn a touch brighter than any wall) and the lamp diffusers stay white: the logo is
 * never tinted.
 */
class WarmGradeEffect extends Effect {
  constructor() {
    super('WarmGrade', /* glsl */ `
      uniform vec3 tint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 t = mix(tint, vec3(1.0), smoothstep(0.8, 0.9, l));
        outputColor = vec4(inputColor.rgb * t, inputColor.a);
      }`, { uniforms: new Map([['tint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))]]) });
  }
}
const DUSK_TINT = new THREE.Vector3(1.06, 0.96, 0.8);
const DAY_TINT = new THREE.Vector3(1.01, 1, 0.97);

function WarmGrade({ evening }: { evening: boolean }) {
  const effect = useMemo(() => new WarmGradeEffect(), []);
  useEffect(() => { (effect.uniforms.get('tint')!.value as THREE.Vector3).copy(evening ? DUSK_TINT : DAY_TINT); }, [effect, evening]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

/**
 * Screen-space polish for the "high" tier: contact-scale ambient occlusion, a soft glow on the
 * lights (downlights, sconces, case LEDs, coves), a very light contrast lift, SMAA and a faint
 * vignette, and a warm white balance at dusk. The glow is strong at dusk and nearly off in daylight, where the sunlit white facade
 * would otherwise cross the threshold. The composer disables renderer tone mapping, so ACES is
 * applied here instead.
 */
export default function Polish() {
  const evening = useShowroom((s) => s.evening);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.45} distanceFalloff={0.6} intensity={1.8} quality="medium" halfRes color="#1a1612" />
      {/* Restrained: a soft halo on the light sources only, never on surfaces. */}
      <Bloom mipmapBlur intensity={evening ? 0.32 : 0.06} luminanceThreshold={1.0} luminanceSmoothing={0.15} radius={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <WarmGrade evening={evening} />
      <BrightnessContrast brightness={0} contrast={0.04} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.35} />
    </EffectComposer>
  );
}
