'use client';
import { Bloom, BrightnessContrast, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useShowroom } from '@/store/showroom';

/**
 * Screen-space polish for the "high" tier: contact-scale ambient occlusion, a soft glow on the
 * lights (downlights, sconces, case LEDs, coves), a very light contrast lift, SMAA and a faint
 * vignette. The glow is strong at dusk and nearly off in daylight, where the sunlit white facade
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
      <BrightnessContrast brightness={0} contrast={0.04} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.35} />
    </EffectComposer>
  );
}
