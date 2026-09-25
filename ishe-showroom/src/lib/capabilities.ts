export type Detected = { mode: '3d' | 'lite'; reason: string | null };

function probe(attrs?: WebGLContextAttributes) {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2', attrs) || c.getContext('webgl', attrs)) as WebGLRenderingContext | null;
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Decide between the real-time 3D showroom and the lite (2D) showroom.
 * `?mode=3d` / `?mode=lite` override detection (useful for QA and for visitors via the toggle).
 */
export function detectRenderMode(search: string): Detected {
  const forced = new URLSearchParams(search).get('mode');
  if (forced === 'lite') return { mode: 'lite', reason: null };
  if (!probe()) return { mode: 'lite', reason: 'This browser does not support WebGL, so you are seeing the lite showroom.' };
  if (forced === '3d') return { mode: '3d', reason: null };
  if (!probe({ failIfMajorPerformanceCaveat: true })) {
    return { mode: 'lite', reason: 'Your device is rendering 3D in software, so we opened the lite showroom for smoother browsing.' };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory && nav.deviceMemory < 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2)) {
    return { mode: 'lite', reason: 'We opened the lite showroom to suit this device.' };
  }
  return { mode: '3d', reason: null };
}
