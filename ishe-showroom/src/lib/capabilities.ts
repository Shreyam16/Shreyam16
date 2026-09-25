export type Detected = { mode: '3d' | 'lite'; reason: string | null };

function probe(attrs?: WebGLContextAttributes): { ok: boolean; renderer: string } {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2', attrs) || c.getContext('webgl', attrs)) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, renderer: '' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: '' };
  }
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;

/**
 * Decide between the real-time 3D showroom and the lite (2D) showroom.
 * `?mode=3d` / `?mode=lite` override detection (useful for QA and for visitors via the toggle).
 */
export function detectRenderMode(search: string): Detected {
  const forced = new URLSearchParams(search).get('mode');
  if (forced === 'lite') return { mode: 'lite', reason: null };
  const basic = probe();
  if (!basic.ok) return { mode: 'lite', reason: 'This browser does not support WebGL, so you are seeing the lite showroom.' };
  if (forced === '3d') return { mode: '3d', reason: null };
  if (SOFTWARE.test(basic.renderer) || !probe({ failIfMajorPerformanceCaveat: true }).ok) {
    return { mode: 'lite', reason: 'Your device is rendering 3D in software, so we opened the lite showroom for smoother browsing.' };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory && nav.deviceMemory < 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2)) {
    return { mode: 'lite', reason: 'We opened the lite showroom to suit this device.' };
  }
  return { mode: '3d', reason: null };
}
