import { describe, it, expect } from 'vitest';
import { tryUseAbility, runStep } from '../src/logic/abilities.js';
import { duel, weaponWith } from './helpers.js';

const melee = { type: 'melee', damage: 10, range: 2, arc: 90, knockback: 2, popup: 'BONK!' };

describe('tryUseAbility', () => {
  it('hits with melee in front and in range', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([melee]) }, b: { pos: { x: 0, y: 0, z: 0 } } });
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
    expect(f2.energy).toBe(90);
    expect(world.events.some((e) => e.type === 'ability' && e.name === 'Test Basic')).toBe(true);
    expect(world.events.some((e) => e.type === 'shape' && e.shape === 'arc')).toBe(true);
  });

  it('misses melee out of range or behind', () => {
    const far = duel({ a: { weapon: weaponWith([melee]) } });
    tryUseAbility(far.world, far.f1, 'basic');
    expect(far.f2.energy).toBe(100);

    const behind = duel({ a: { weapon: weaponWith([melee]) }, b: { pos: { x: 0, y: 0, z: 0 } } });
    behind.f1.facing = Math.PI;
    tryUseAbility(behind.world, behind.f1, 'basic');
    expect(behind.f2.energy).toBe(100);
  });

  it('respects cooldowns', () => {
    const { world, f1 } = duel({ a: { weapon: weaponWith([melee]) } });
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    world.time = 1.01;
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
  });

  it('No Cooldowns allows rapid use', () => {
    const { world, f1 } = duel({ a: { weapon: weaponWith([melee]) } });
    f1.noCooldowns = true;
    tryUseAbility(world, f1, 'basic');
    world.time = 0.11;
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
  });

  it('cannot act while frozen, knocked out, or without a weapon', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([melee]) } });
    f1.status.freezeUntil = 5;
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    f1.status.freezeUntil = 0;
    f1.ko = true;
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    expect(tryUseAbility(world, f2, 'basic')).toBe(false);
  });
});

describe('primitives', () => {
  it('spawns spread projectiles aimed at the opponent', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'projectile', count: 3, spread: 30, damage: 5, speed: 10, size: 0.3, life: 1 }, f1, 1);
    expect(world.projectiles).toHaveLength(3);
    const angles = world.projectiles.map((p) => Math.atan2(p.vel.z, p.vel.x));
    expect(angles[0]).toBeCloseTo(-Math.PI / 12);
    expect(angles[1]).toBeCloseTo(0);
    expect(angles[2]).toBeCloseTo(Math.PI / 12);
    expect(world.projectiles[0]).toMatchObject({ ownerId: 'p1', damage: 5, scale: 1, pierce: false });
  });

  it('bursts hit within radius only', () => {
    const near = duel({ b: { pos: { x: 0, y: 0, z: 0 } } });
    runStep(near.world, near.f1, { type: 'burst', at: 'self', radius: 2, damage: 10 }, near.f1, 1);
    expect(near.f2.energy).toBe(90);
    const far = duel();
    runStep(far.world, far.f1, { type: 'burst', at: 'self', radius: 2, damage: 10 }, far.f1, 1);
    expect(far.f2.energy).toBe(100);
  });

  it('bursts at the target position', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'burst', at: 'target', radius: 1, damage: 10 }, f1, 1);
    expect(f2.energy).toBe(90);
  });

  it('heals, shields, and guards the caster', () => {
    const { world, f1 } = duel();
    f1.energy = 50;
    runStep(world, f1, { type: 'heal', amount: 20 }, f1, 1);
    expect(f1.energy).toBe(70);
    runStep(world, f1, { type: 'shield', duration: 2, reduction: 1 }, f1, 1);
    expect(f1.shield).toMatchObject({ until: 2, reduction: 1 });
    runStep(world, f1, { type: 'guard', hits: 1 }, f1, 1);
    expect(f1.guardHits).toBe(1);
  });

  it('pulls the opponent toward the caster when in range', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'pull', range: 10, strength: 20 }, f1, 1);
    expect(f2.knock.x).toBeLessThan(0);
  });

  it('places a zone at the target', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'zone', at: 'target', radius: 2, duration: 3, slow: 0.5, dps: 2, style: 'goo' }, f1, 1);
    expect(world.zones).toHaveLength(1);
    expect(world.zones[0]).toMatchObject({ ownerId: 'p1', pos: { x: 2, y: 0, z: 0 }, radius: 2, until: 3, slow: 0.5, dps: 2 });
  });

  it('strike hits from the source (pet) position when in range', () => {
    const { world, f1, f2 } = duel();
    const pet = { pos: { x: 1, y: 0, z: 0 }, facing: 0, strikeAnim: null };
    runStep(world, f1, { type: 'strike', damage: 4, range: 2 }, pet, 1);
    expect(f2.energy).toBe(96);
    expect(pet.strikeAnim).not.toBe(null);
  });

  it('blink teleports away from the opponent instantly', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'escape', distance: 5, duration: 0 }, f1, 1);
    expect(f1.pos.x).toBeCloseTo(-7);
    expect(f1.dash).toBe(null);
  });

  it('starts a dash toward the opponent', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 10 }, f1, 1);
    expect(f1.dash.speed).toBeCloseTo(20);
    expect(f1.dash.dir.x).toBeCloseTo(1);
  });

  it('throws on unknown step types', () => {
    const { world, f1 } = duel();
    expect(() => runStep(world, f1, { type: 'banana' }, f1, 1)).toThrow();
  });
});
