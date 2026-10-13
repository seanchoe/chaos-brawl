import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { facingToRotationY, computeCamera, smoothToward, CAMERA } from '../../src/render/math.js';
import { forward } from '../../src/logic/vec.js';

describe('facingToRotationY', () => {
  for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    it(`turns a +z-facing model to the logic forward for facing ${facing.toFixed(2)}`, () => {
      const obj = new THREE.Object3D();
      obj.rotation.y = facingToRotationY(facing);
      const dir = obj.getWorldDirection(new THREE.Vector3());
      const f = forward(facing);
      expect(dir.x).toBeCloseTo(f.x);
      expect(dir.z).toBeCloseTo(f.z);
    });
  }
});

describe('computeCamera', () => {
  it('looks at the midpoint from the +z side', () => {
    const c = computeCamera({ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(c.target).toEqual({ x: 0, y: CAMERA.lookHeight, z: 0 });
    expect(c.position.x).toBe(0);
    expect(c.position.z).toBeCloseTo(17);
    expect(c.position.y).toBeCloseTo(17 * CAMERA.height);
  });

  it('clamps the distance', () => {
    expect(computeCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).position.z).toBeCloseTo(CAMERA.minDistance);
    expect(computeCamera({ x: -12, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }).position.z).toBeCloseTo(CAMERA.maxDistance);
  });

  it('follows fighters that move in z', () => {
    const c = computeCamera({ x: 0, y: 0, z: -4 }, { x: 0, y: 0, z: -2 });
    expect(c.target.z).toBe(-3);
    expect(c.position.z).toBeGreaterThan(c.target.z);
  });
});

describe('smoothToward', () => {
  it('moves part of the way, more with more time', () => {
    expect(smoothToward(0, 10, 3, 0)).toBe(0);
    expect(smoothToward(0, 10, 3, 1)).toBeCloseTo(10 * (1 - Math.exp(-3)));
    expect(smoothToward(0, 10, 3, 100)).toBeCloseTo(10);
  });
});
