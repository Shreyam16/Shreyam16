'use client';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Screen-space polish for the "high" tier: contact-scale ambient occlusion, SMAA and a faint
 * vignette. (Bloom was tried and dropped: the sunlit white facade crosses any usable threshold.)
 * The composer disables renderer tone mapping, so ACES is applied here instead.
 */
export default function Polish() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.45} distanceFalloff={0.6} intensity={1.6} quality="medium" halfRes color="#1a1612" />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}
