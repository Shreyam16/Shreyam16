/**
 * Surfaces that receive baked lighting (Blender Cycles, see bake/bake.py). Shared by the bake
 * script (via bake/layout.json) and the scene, so geometry and UVs match exactly.
 *
 * plane 'y': horizontal at y = c, a = x, b = z.
 * plane 'x': vertical at x = c, a = z, b = y.
 * plane 'z': vertical at z = c, a = x, b = y.
 * UVs are a planar projection: u = (a - uv[0]) / (uv[1] - uv[0]), v = (b - uv[2]) / (uv[3] - uv[2]).
 */
export interface BakeSurface {
  name: string;
  plane: 'x' | 'y' | 'z';
  c: number;
  /** Direction the lit face points along the plane axis. */
  normal: 1 | -1;
  /** Rectangles [a0, a1, b0, b1] that make up the face (openings are simply left out). */
  rects: [number, number, number, number][];
  uv: [number, number, number, number];
  res: [number, number];
}

const H = 3.8;
const FULL: [number, number, number, number] = [-7.5, 7.5, -14, 0];

const partition = (s: 1 | -1, side: 'arm' | 'foyer'): BakeSurface => ({
  name: `partition-${s < 0 ? 'left' : 'right'}-${side}`,
  plane: 'x',
  c: side === 'arm' ? s * 2.6 : s * 2.4,
  normal: (side === 'arm' ? s : -s) as 1 | -1,
  rects: [[-1.6, -0.1, 0, H], [-8, -4, 0, H], [-4, -1.6, 2.9, H]],
  uv: [-8, -0.1, 0, H],
  res: [512, 244],
});

export const BAKE_SURFACES: BakeSurface[] = [
  { name: 'floor', plane: 'y', c: 0, normal: 1, rects: [FULL], uv: FULL, res: [1024, 956] },
  { name: 'ceiling', plane: 'y', c: H, normal: -1, rects: [FULL], uv: FULL, res: [512, 478] },
  { name: 'wall-left', plane: 'x', c: -7.4, normal: 1, rects: [[-13.9, -0.1, 0, H]], uv: [-13.9, -0.1, 0, H], res: [896, 244] },
  { name: 'wall-right', plane: 'x', c: 7.4, normal: -1, rects: [[-13.9, -0.1, 0, H]], uv: [-13.9, -0.1, 0, H], res: [896, 244] },
  { name: 'wall-back', plane: 'z', c: -13.9, normal: 1, rects: [[-7.4, 7.4, 0, H]], uv: [-7.4, 7.4, 0, H], res: [944, 244] },
  {
    name: 'wall-front', plane: 'z', c: -0.1, normal: -1,
    rects: [
      [-7.4, -6.5, 0, H], [-6.5, -2.2, 0, 0.45], [-6.5, -2.2, 3.1, H], [-2.2, -1.1, 0, H], [-1.1, 1.1, 2.75, H],
      [1.1, 2.2, 0, H], [2.2, 6.5, 0, 0.45], [2.2, 6.5, 3.1, H], [6.5, 7.4, 0, H],
    ],
    uv: [-7.4, 7.4, 0, H], res: [944, 244],
  },
  partition(-1, 'arm'), partition(-1, 'foyer'), partition(1, 'arm'), partition(1, 'foyer'),
];
