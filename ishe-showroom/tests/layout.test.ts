import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '@/data/catalogue';
import {
  DISPLAYS, EDGES, NODES, OBSTACLES, collides, displayFootprint, focusPose, nearestClearNode, routeTo,
  segmentClear, shortestPath, slideMove, cashierPose, comboPose, EYE, DEPTH, HALF_W, type Box2,
} from '@/scene/layout';

const overlap = (a: Box2, b: Box2) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('floor plan', () => {
  it('gives every product exactly one display', () => {
    expect(DISPLAYS.map((d) => d.sku).sort()).toEqual(PRODUCTS.map((p) => p.sku).sort());
  });
  it('keeps displays inside the 15 x 14 m shell and apart from each other (>= 0.9 m clear)', () => {
    const boxes = DISPLAYS.map(displayFootprint);
    for (const b of boxes) {
      expect(b.x0).toBeGreaterThan(-HALF_W); expect(b.x1).toBeLessThan(HALF_W);
      expect(b.z0).toBeGreaterThan(-DEPTH); expect(b.z1).toBeLessThan(0);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const grow = { x0: a.x0 - 0.45, z0: a.z0 - 0.45, x1: a.x1 + 0.45, z1: a.z1 + 0.45 };
      const shrink = { x0: b.x0 + 0.45 - 0.45, z0: b.z0, x1: b.x1, z1: b.z1 };
      expect(overlap(grow, shrink), `${DISPLAYS[i].sku} vs ${DISPLAYS[j].sku}`).toBe(false);
    }
  });
  it('places every nav node in free space', () => {
    for (const n of Object.values(NODES)) expect(collides(n.x, n.z), n.id).toBe(false);
  });
  it('has collision-free edges', () => {
    for (const [a, b] of EDGES) expect(segmentClear(NODES[a].x, NODES[a].z, NODES[b].x, NODES[b].z), `${a}-${b}`).toBe(true);
  });
  it('connects every node to the junction', () => {
    for (const id of Object.keys(NODES) as (keyof typeof NODES)[]) expect(shortestPath('junction', id).length).toBeGreaterThan(0);
  });
  it('frames every display from a free standing spot at ~eye height, reachable in a clear line', () => {
    for (const d of DISPLAYS) {
      const p = focusPose(d.sku);
      expect(collides(p.x, p.z, 0.2), d.sku).toBe(false);
      expect(Math.abs(p.y - EYE)).toBeLessThan(0.15);
      const n = nearestClearNode(p.x, p.z);
      expect(segmentClear(p.x, p.z, NODES[n].x, NODES[n].z, 0.12), d.sku).toBe(true);
    }
    for (const p of [cashierPose(), comboPose()]) expect(collides(p.x, p.z, 0.2)).toBe(false);
  });
  it('routes from the junction to the cashier without crossing anything', () => {
    for (const d of DISPLAYS) {
      const start = focusPose(d.sku);
      const route = routeTo(start.x, start.z, cashierPose());
      for (let i = 1; i < route.length; i++) {
        expect(segmentClear(route[i - 1].x, route[i - 1].z, route[i].x, route[i].z, 0.12), `${d.sku} leg ${i}`).toBe(true);
      }
    }
  });
  it('stops walking through walls and cases', () => {
    // Walk sideways out of the aisle into a gallery case.
    let pos = { x: 0, z: -5 };
    for (let i = 0; i < 100; i++) pos = slideMove(pos.x, pos.z, -0.05, 0);
    expect(pos.x).toBeGreaterThan(-1.46);
    // Walk down the aisle into the hero pedestal.
    pos = { x: 0, z: -12 };
    for (let i = 0; i < 100; i++) pos = slideMove(pos.x, pos.z, 0, -0.05);
    expect(pos.z).toBeGreaterThan(-12.6);
    // Walk into the cashier counter.
    pos = { x: 5.2, z: -11.5 };
    for (let i = 0; i < 100; i++) pos = slideMove(pos.x, pos.z, 0, -0.05);
    expect(pos.z).toBeGreaterThan(-12.6);
    // Columns stop the visitor too.
    pos = { x: 0, z: -7.6 };
    for (let i = 0; i < 200; i++) pos = slideMove(pos.x, pos.z, 0.05, 0);
    expect(pos.x).toBeLessThan(2.66);
    // Cannot walk back out of the front door once inside.
    pos = { x: 0, z: -1 };
    for (let i = 0; i < 100; i++) pos = slideMove(pos.x, pos.z, 0, 0.05);
    expect(pos.z).toBeLessThan(0);
    expect(OBSTACLES.length).toBeGreaterThan(24);
  });
});
