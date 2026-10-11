import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildArena } from '../../src/render/arena.js';
import { ARENA_RADIUS } from '../../src/logic/constants.js';

describe('arena', () => {
  it('builds an island with a wall outside the play area and lights', () => {
    const arena = buildArena();
    expect(arena).toBeInstanceOf(THREE.Group);
    expect(arena.userData.wallRadius).toBeGreaterThan(ARENA_RADIUS);
    const lights = [];
    arena.traverse((o) => { if (o.isLight) lights.push(o); });
    expect(lights.length).toBeGreaterThanOrEqual(2);
  });
});
