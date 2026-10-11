import { describe, it, expect } from 'vitest';
import { applyDamage, heal, hitTarget, pullToward } from '../src/logic/combat.js';
import { opponentOf, schedule, runTimers, drainEvents, nextId } from '../src/logic/world.js';
import { getCharacter } from '../src/data/characters.js';
import { duel } from './helpers.js';

describe('world', () => {
  it('faces fighters toward each other', () => {
    const { f1, f2 } = duel();
    expect(f1.facing).toBeCloseTo(0);
    expect(Math.abs(f2.facing)).toBeCloseTo(Math.PI);
  });

  it('finds the opponent', () => {
    const { world, f1, f2 } = duel();
    expect(opponentOf(world, f1)).toBe(f2);
  });

  it('runs scheduled timers when due', () => {
    const { world } = duel();
    let ran = 0;
    schedule(world, 0.5, () => { ran += 1; });
    world.time = 0.4;
    runTimers(world);
    expect(ran).toBe(0);
    world.time = 0.5;
    runTimers(world);
    runTimers(world);
    expect(ran).toBe(1);
  });

  it('drains events and hands out ids', () => {
    const { world } = duel();
    world.events.push({ type: 'x' });
    expect(drainEvents(world)).toEqual([{ type: 'x' }]);
    expect(world.events).toEqual([]);
    expect(nextId(world)).toBe(1);
    expect(nextId(world)).toBe(2);
  });
});

describe('combat', () => {
  it('deals damage and emits a hit', () => {
    const { world, f1, f2 } = duel();
    expect(applyDamage(world, f2, 10, f1, 'BONK!')).toBe(10);
    expect(f2.energy).toBe(90);
    expect(world.events.at(-1)).toMatchObject({ type: 'hit', targetId: 'p2', attackerId: 'p1', damage: 10, popup: 'BONK!' });
  });

  it('applies character defense', () => {
    const { world, f1, f2 } = duel({ b: { character: getCharacter('pancake') } });
    expect(applyDamage(world, f2, 10, f1)).toBeCloseTo(9);
  });

  it('blocks fully with a full shield', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 1, onEnd: null };
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(f2.energy).toBe(100);
    expect(world.events.at(-1).type).toBe('blocked');
  });

  it('reduces damage with a partial shield', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 0.7, onEnd: null };
    expect(applyDamage(world, f2, 10, f1)).toBeCloseTo(3);
  });

  it('guard blocks exactly one hit', () => {
    const { world, f1, f2 } = duel();
    f2.guardHits = 1;
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(applyDamage(world, f2, 10, f1)).toBe(10);
    expect(f2.guardHits).toBe(0);
  });

  it('knocks out at zero energy, once', () => {
    const { world, f1, f2 } = duel();
    applyDamage(world, f2, 150, f1);
    expect(f2.energy).toBe(0);
    expect(f2.ko).toBe(true);
    expect(world.events.filter((e) => e.type === 'ko')).toHaveLength(1);
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(world.events.filter((e) => e.type === 'ko')).toHaveLength(1);
  });

  it('infinite energy takes hits without losing energy', () => {
    const { world, f1, f2 } = duel();
    f2.infiniteEnergy = true;
    expect(applyDamage(world, f2, 30, f1)).toBe(30);
    expect(f2.energy).toBe(100);
  });

  it('heals up to the max', () => {
    const { world, f1 } = duel();
    f1.energy = 95;
    heal(world, f1, 20);
    expect(f1.energy).toBe(100);
    expect(world.events.at(-1)).toMatchObject({ type: 'heal', targetId: 'p1', amount: 5 });
  });

  it('hitTarget scales damage, knocks back, and applies effects', () => {
    const { world, f1, f2 } = duel();
    hitTarget(world, f1, f2, { damage: 10, knockback: 5, effects: [{ type: 'freeze', duration: 1 }] }, f1.pos, 2);
    expect(f2.energy).toBe(80);
    expect(f2.knock.x).toBeGreaterThan(0);
    expect(f2.status.freezeUntil).toBeCloseTo(1);
  });

  it('hitTarget applies no effects when blocked', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 1, onEnd: null };
    hitTarget(world, f1, f2, { damage: 10, knockback: 5, effects: [{ type: 'freeze', duration: 1 }] }, f1.pos, 1);
    expect(f2.knock.x).toBe(0);
    expect(f2.status.freezeUntil).toBe(0);
  });

  it('pull effect pulls toward the attacker', () => {
    const { world, f1, f2 } = duel();
    hitTarget(world, f1, f2, { damage: 1, effects: [{ type: 'pull', strength: 10 }] }, f1.pos, 1);
    expect(f2.knock.x).toBeLessThan(0);
    pullToward(f1, f2.pos, 4);
    expect(f1.knock.x).toBeCloseTo(4);
  });
});
