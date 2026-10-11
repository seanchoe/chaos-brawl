import { describe, it, expect } from 'vitest';
import { dist2D, dirTo, forward, angleTo, angleDiff, clampToArena } from '../src/logic/vec.js';
import { mulberry32 } from '../src/logic/random.js';

describe('vec', () => {
  it('measures ground distance ignoring y', () => {
    expect(dist2D({ x: 0, y: 5, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(5);
  });

  it('gives a unit direction, or zero for the same point', () => {
    const d = dirTo({ x: 0, z: 0 }, { x: 0, z: 2 });
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(1);
    const same = dirTo({ x: 1, z: 1 }, { x: 1, z: 1 });
    expect(same).toEqual({ x: 0, z: 0 });
  });

  it('forward and angleTo agree', () => {
    const a = angleTo({ x: 0, z: 0 }, { x: 0, z: 1 });
    const f = forward(a);
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(1);
  });

  it('angleDiff wraps around', () => {
    expect(angleDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  it('clamps a point to the arena', () => {
    const p = { x: 20, y: 0, z: 0 };
    clampToArena(p, 10);
    expect(p.x).toBeCloseTo(10);
    const inside = { x: 1, y: 0, z: 1 };
    clampToArena(inside, 10);
    expect(inside).toEqual({ x: 1, y: 0, z: 1 });
  });
});

describe('random', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
