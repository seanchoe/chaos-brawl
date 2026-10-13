import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildArena } from '../../src/render/arena.js';
import { ARENA_RADIUS } from '../../src/logic/constants.js';

describe('arena', () => {
  it('builds an arena with a wall outside the play area and lights', () => {
    const arena = buildArena();
    expect(arena).toBeInstanceOf(THREE.Group);
    expect(arena.userData.wallRadius).toBeGreaterThan(ARENA_RADIUS);
    const lights = [];
    arena.traverse((o) => { if (o.isLight) lights.push(o); });
    expect(lights.length).toBeGreaterThanOrEqual(2);
  });

  it('sits on a wide ground that reaches past the fog instead of floating', () => {
    const ground = buildArena().getObjectByName('ground');
    expect(ground.geometry.parameters.radius).toBeGreaterThan(95);
    expect(ground.position.y).toBeLessThan(0);
    expect(ground.receiveShadow).toBe(true);
  });
});

describe('arena shadows', () => {
  it('uses a sharp shadow map with a normal bias against acne', () => {
    let sun;
    buildArena().traverse((o) => { if (o.isDirectionalLight) sun = o; });
    expect(sun.shadow.normalBias).toBe(0.02);
    expect(sun.shadow.mapSize.x).toBe(2048);
    expect(sun.shadow.mapSize.y).toBe(2048);
  });
});
