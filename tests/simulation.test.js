import { describe, it, expect } from 'vitest';
import { tryUseAbility, runStep } from '../src/logic/abilities.js';
import { stepWorld } from '../src/logic/simulation.js';
import { ARENA_RADIUS, FIGHTER_RADIUS, DT } from '../src/logic/constants.js';
import { dist2D } from '../src/logic/vec.js';
import { duel, weaponWith, run } from './helpers.js';

const shot = { type: 'projectile', damage: 10, speed: 14, size: 0.35, life: 1.2 };

describe('movement', () => {
  it('moves with input at base speed', () => {
    const { world, f1 } = duel({ b: { pos: { x: 10, y: 0, z: 0 } } });
    f1.input.moveX = 1;
    run(world, 1);
    expect(f1.pos.x).toBeCloseTo(4, 1);
  });

  it('moves at half speed when slowed', () => {
    const { world, f1 } = duel({ b: { pos: { x: 10, y: 0, z: 0 } } });
    f1.status.slowUntil = 5;
    f1.status.slowAmount = 0.5;
    f1.input.moveX = 1;
    run(world, 1);
    expect(f1.pos.x).toBeCloseTo(1, 1);
  });

  it('cannot move while frozen', () => {
    const { world, f1 } = duel();
    f1.status.freezeUntil = 5;
    f1.input.moveX = -1;
    run(world, 0.5);
    expect(f1.pos.x).toBeCloseTo(-2);
  });

  it('jumps and lands', () => {
    const { world, f1 } = duel();
    f1.input.jump = true;
    stepWorld(world, DT);
    f1.input.jump = false;
    expect(f1.pos.y).toBeGreaterThan(0);
    run(world, 1.5);
    expect(f1.pos.y).toBe(0);
    expect(f1.onGround).toBe(true);
  });

  it('stays inside the arena', () => {
    const { world, f1 } = duel();
    f1.input.moveX = -1;
    run(world, 5);
    expect(Math.hypot(f1.pos.x, f1.pos.z)).toBeLessThanOrEqual(ARENA_RADIUS - FIGHTER_RADIUS + 1e-9);
  });

  it('keeps fighters from overlapping', () => {
    const { world, f1, f2 } = duel({ a: { pos: { x: 0, y: 0, z: 0 } }, b: { pos: { x: 0.5, y: 0, z: 0 } } });
    stepWorld(world, DT);
    expect(dist2D(f1.pos, f2.pos)).toBeGreaterThanOrEqual(FIGHTER_RADIUS * 2 - 1e-6);
  });

  it('uses abilities from held input', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([shot]) } });
    f1.input.attack = true;
    stepWorld(world, DT);
    expect(world.projectiles).toHaveLength(1);
    f1.input.attack = false;
    run(world, 0.5);
    expect(f2.energy).toBe(90);
  });
});

describe('projectiles', () => {
  it('travels, hits once, and disappears', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, shot, f1, 1);
    run(world, 0.5);
    expect(f2.energy).toBe(90);
    expect(world.projectiles).toHaveLength(0);
  });

  it('a jumping target dodges', () => {
    const { world, f1, f2 } = duel({ b: { pos: { x: 4, y: 0, z: 0 } } });
    runStep(world, f1, shot, f1, 1);
    f2.input.jump = true;
    run(world, 0.5);
    expect(f2.energy).toBe(100);
  });

  it('expires after its life', () => {
    const { world, f1 } = duel({ b: { pos: { x: 2, y: 0, z: 8 } } });
    runStep(world, f1, { ...shot, life: 0.2 }, f1, 1);
    world.projectiles[0].vel = { x: -14, z: 0 };
    run(world, 0.3);
    expect(world.projectiles).toHaveLength(0);
  });

  it('a piercing, returning projectile can hit twice', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { ...shot, damage: 14, life: 1.4, pierce: true, returning: true }, f1, 1);
    run(world, 1.5);
    expect(f2.energy).toBe(72);
  });

  it('homing projectiles curve toward the target', () => {
    const homing = duel({ b: { pos: { x: 6, y: 0, z: 0 } } });
    runStep(homing.world, homing.f1, { ...shot, speed: 10, size: 0.3, life: 2, homing: 3 }, homing.f1, 1);
    homing.f2.pos.z = 3;
    run(homing.world, 2);
    expect(homing.f2.energy).toBe(90);

    const straight = duel({ b: { pos: { x: 6, y: 0, z: 0 } } });
    runStep(straight.world, straight.f1, { ...shot, speed: 10, size: 0.3, life: 2 }, straight.f1, 1);
    straight.f2.pos.z = 3;
    run(straight.world, 2);
    expect(straight.f2.energy).toBe(100);
  });
});

describe('timed primitives', () => {
  it('dash hits once on contact then stops', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 10, knockback: 3 }, f1, 1);
    run(world, 0.4);
    expect(f2.energy).toBe(90);
    expect(f1.dash).toBe(null);
  });

  it('leap lands on the opponent and bursts', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'leap', duration: 0.6, radius: 2, damage: 10 }, f1, 1);
    run(world, 0.7);
    expect(f1.leap).toBe(null);
    expect(f1.pos.y).toBe(0);
    expect(f2.energy).toBe(90);
  });

  it('a fighter KO\'d mid-leap falls back to the ground', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'leap', duration: 0.6, radius: 2, damage: 10 }, f1, 1);
    run(world, 0.3);
    expect(f1.pos.y).toBeGreaterThan(1);
    f1.ko = true;
    run(world, 1);
    expect(f1.leap).toBe(null);
    expect(f1.pos.y).toBe(0);
    expect(f1.onGround).toBe(true);
  });

  it('shield runs its onEnd steps when it expires', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([shot], [{ type: 'shield', duration: 1, reduction: 1, onEnd: [{ type: 'burst', at: 'self', radius: 5, damage: 10 }] }]) } });
    tryUseAbility(world, f1, 'special');
    run(world, 0.9);
    expect(f2.energy).toBe(100);
    run(world, 0.2);
    expect(f1.shield).toBe(null);
    expect(f2.energy).toBe(90);
  });

  it('delayed target burst can be dodged by moving', () => {
    const step = { type: 'burst', at: 'target', delay: 0.5, radius: 1.5, damage: 10 };
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([step]) } });
    tryUseAbility(world, f1, 'basic');
    expect(world.events.some((e) => e.shape === 'warning')).toBe(true);
    f2.pos.x = 8;
    run(world, 0.6);
    expect(f2.energy).toBe(100);

    const hit = duel({ a: { weapon: weaponWith([step]) } });
    tryUseAbility(hit.world, hit.f1, 'basic');
    run(hit.world, 0.6);
    expect(hit.f2.energy).toBe(90);
  });

  it('zones slow and damage over time', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'zone', at: 'target', radius: 2, duration: 2, slow: 0.5, dps: 4 }, f1, 1);
    run(world, 1.2);
    expect(f2.energy).toBeCloseTo(94, 5);
    expect(f2.status.slowUntil).toBeGreaterThan(world.time);
    run(world, 1.5);
    expect(world.zones).toHaveLength(0);
  });
});
