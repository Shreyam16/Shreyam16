'use client';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useShowroom } from '@/store/showroom';

/**
 * Screen-space polish for the "high" tier: contact-scale ambient occlusion, a soft glow on the
 * lights (downlights, sconces, case LEDs, coves), a gentle film-like grade, SMAA and a faint
 * vignette. The glow is strong at dusk and nearly off in daylight, where the sunlit white facade
 * would otherwise cross the threshold. The composer disables renderer tone mapping, so ACES is
 * applied here instead.
 */
export default function Polish() {
  const evening = useShowroom((s) => s.evening);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.45} distanceFalloff={0.6} intensity={1.8} quality="medium" halfRes color="#1a1612" />
      <Bloom mipmapBlur intensity={evening ? 0.85 : 0.12} luminanceThreshold={0.95} luminanceSmoothing={0.2} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0} contrast={0.08} />
      <HueSaturation hue={0} saturation={0.06} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.48} />
    </EffectComposer>
  );
}
