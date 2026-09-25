'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PRODUCT_BY_SKU } from '@/data/catalogue';
import { buildTryOnPiece } from '@/scene/jewellery';
import { useShowroom } from '@/store/showroom';
import { Button, Icon, ProductImage, SampleTag, Sheet, SheetHeader } from './ui/primitives';

/** Pinned MediaPipe Tasks build, fetched from jsDelivr only after the camera is granted. */
const MP_VERSION = '1.0.1';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Status = 'idle' | 'starting' | 'loading-model' | 'running' | 'denied' | 'unavailable' | 'error';

interface Landmark { x: number; y: number; z: number }
interface Landmarker { detectForVideo: (v: HTMLVideoElement, t: number) => { faceLandmarks: Landmark[][] }; close: () => void }

/** Face landmarks used: face sides at ear level, jaw below the ears, chin, forehead. */
const L = { rightSide: 234, leftSide: 454, rightJaw: 132, leftJaw: 361, chin: 152, top: 10 };
/** Assumed face width for the preview's scale (a rough adult average, hence "not exact scale"). */
const FACE_WIDTH_M = 0.145;

export default function TryOnDialog({ sku }: { sku: string }) {
  const product = PRODUCT_BY_SKU[sku];
  const close = useShowroom((s) => s.openTryOn);
  const reduced = useShowroom((s) => s.reducedMotion);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [face, setFace] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<Landmarker | null>(null);
  const raf = useRef(0);
  const alive = useRef(true);
  const gpu = useRef<{ dispose: () => void } | null>(null);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    try { landmarker.current?.close(); } catch { /* already closed */ }
    landmarker.current = null;
    gpu.current?.dispose();
    gpu.current = null;
  }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; stopAll(); }; }, [stopAll]);

  async function start() {
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setMessage('This browser does not offer camera access here. Camera try-on needs a secure (https) page and a camera.');
      return;
    }
    setStatus('starting');
    let s: MediaStream;
    try {
      // Permission is requested only now, after the visitor taps "Start camera".
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setMessage('Camera access was not allowed. You can allow it in your browser’s site settings and try again, or keep browsing the piece in the showroom.');
      } else {
        setStatus('unavailable');
        setMessage('No camera could be started on this device. You can keep browsing the piece in the showroom.');
      }
      return;
    }
    if (!alive.current) { s.getTracks().forEach((t) => t.stop()); return; }
    stream.current = s;
    const v = video.current!;
    v.srcObject = s;
    await v.play().catch(() => undefined);
    setStatus('loading-model');
    try {
      const mod = await import(/* webpackIgnore: true */ `${MP_BASE}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      landmarker.current = await mod.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    } catch {
      setStatus('error');
      setMessage('The face-tracking model could not be loaded. Check your connection and try again.');
      stopAll();
      return;
    }
    if (!alive.current) { stopAll(); return; }
    setStatus('running');
    run();
  }

  function run() {
    const v = video.current!, c = canvas.current!;
    const built = buildTryOnPiece(product);
    if (!built) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: false });
    } catch {
      setStatus('error');
      setMessage('This device cannot draw the 3D piece over the camera (WebGL is unavailable).');
      stopAll();
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight('#fff6ea', '#8a8078', 1.2));
    const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
    const pieces = built.kind === 'earring' ? [built.group, built.group.clone()] : [built.group];
    pieces.forEach((p) => scene.add(p));
    let last = -1;
    let smooth: { lx: number; ly: number; rx: number; ry: number; nx: number; ny: number; px: number } | null = null;

    const frame = () => {
      raf.current = requestAnimationFrame(frame);
      if (!landmarker.current || v.readyState < 2) return;
      const w = c.clientWidth, h = c.clientHeight;
      if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        cam.left = 0; cam.right = w; cam.top = 0; cam.bottom = -h; cam.updateProjectionMatrix();
      }
      const now = performance.now();
      if (now === last) return;
      last = now;
      const res = landmarker.current.detectForVideo(v, now);
      const lm = res.faceLandmarks?.[0];
      setFace(!!lm);
      if (!lm) { pieces.forEach((p) => (p.visible = false)); renderer.render(scene, cam); return; }
      // Map normalised video coordinates onto the cover-fitted canvas.
      const vw = v.videoWidth || 4, vh = v.videoHeight || 3;
      const k = Math.max(w / vw, h / vh);
      const ox = (w - vw * k) / 2, oy = (h - vh * k) / 2;
      const P = (i: number) => ({ x: ox + lm[i].x * vw * k, y: oy + lm[i].y * vh * k });
      const rs = P(L.rightSide), ls = P(L.leftSide), rj = P(L.rightJaw), lj = P(L.leftJaw), chin = P(L.chin), top = P(L.top);
      const faceW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
      const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
      const out = 0.04 * faceW;
      const target = {
        rx: rs.x + (rj.x - rs.x) * 0.5 - out, ry: rs.y + (rj.y - rs.y) * 0.5,
        lx: ls.x + (lj.x - ls.x) * 0.5 + out, ly: ls.y + (lj.y - ls.y) * 0.5,
        nx: chin.x, ny: chin.y + faceH * 0.42, px: faceW / FACE_WIDTH_M,
      };
      const a = reduced || !smooth ? 1 : 0.45;
      smooth = smooth ? Object.fromEntries(Object.entries(target).map(([kk, val]) => [kk, smooth![kk as keyof typeof target] + (val - smooth![kk as keyof typeof target]) * a])) as typeof target : target;
      const s = smooth;
      if (built.kind === 'earring') {
        // Hide the far earring when the head turns strongly (the face side hides the ear).
        const turn = (lm[L.leftSide].z - lm[L.rightSide].z) * 10;
        const [r, l] = pieces;
        r.position.set(s.rx, -s.ry, 0); l.position.set(s.lx, -s.ly, 0);
        r.scale.setScalar(s.px); l.scale.set(-s.px, s.px, s.px);
        r.visible = turn < 0.9; l.visible = turn > -0.9;
      } else {
        const n = pieces[0];
        n.position.set(s.nx, -s.ny, 0);
        n.scale.setScalar(s.px);
        n.visible = true;
      }
      renderer.render(scene, cam);
    };
    gpu.current = { dispose: () => { scene.environment?.dispose(); pmrem.dispose(); renderer.dispose(); } };
    frame();
  }

  const onClose = () => { stopAll(); close(null); };
  const running = status === 'running' || status === 'loading-model' || status === 'starting';
  return (
    <Sheet label={`Try on ${product.name}`} onClose={onClose} wide testId="try-on">
      <SheetHeader eyebrow="Camera try-on" title={product.name} onClose={onClose} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden bg-ink">
          {/* Mirrored like a looking glass; video never leaves the device. */}
          <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${running ? '' : 'hidden'}`} />
          <canvas ref={canvas} className={`absolute inset-0 h-full w-full -scale-x-100 ${status === 'running' ? '' : 'hidden'}`} aria-hidden />
          {!running && (
            <div className="absolute inset-0 grid place-items-center p-6">
              <ProductImage product={product} className="aspect-square w-3/4 opacity-90" />
            </div>
          )}
          <p className="absolute left-2 top-2 bg-paper/90 px-2 py-1 font-ui text-[10px] uppercase tracking-[0.2em]" data-testid="try-on-scale-note">Preview, not exact scale</p>
          {status === 'running' && !face && (
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit bg-paper/90 px-3 py-1 font-ui text-[12px]" role="status">Face the camera to see the piece</p>
          )}
          {(status === 'starting' || status === 'loading-model') && (
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit bg-paper/90 px-3 py-1 font-ui text-[12px]" role="status">
              {status === 'starting' ? 'Waiting for camera permission…' : 'Loading face tracking…'}
            </p>
          )}
        </div>

        <div aria-live="polite" data-testid="try-on-status" data-status={status}>
          {message && (
            <div className="mt-4 border-l-2 border-ink pl-3" data-testid="try-on-fallback">
              <p className="plaque-label">{status === 'denied' ? 'Camera not allowed' : status === 'unavailable' ? 'No camera available' : 'Try-on unavailable'}</p>
              <p className="mt-1 font-ui text-[13px] leading-snug text-ink/80">{message}</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          {status !== 'running' && status !== 'loading-model' && status !== 'starting' && (
            <Button variant="primary" size="lg" onClick={start} data-testid="try-on-start">
              <Icon name="camera" className="h-4 w-4" /> {status === 'idle' ? 'Start camera' : 'Try again'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Back to the piece</Button>
        </div>
        <p className="mt-4 font-ui text-[11px] leading-snug text-ink/55">
          Runs entirely on this device: the camera image is not uploaded or stored. The face-tracking model is downloaded
          from Google’s MediaPipe CDN when you start. The piece shown is the stylised 3D model <SampleTag>Sample</SampleTag>.
        </p>
      </div>
    </Sheet>
  );
}
