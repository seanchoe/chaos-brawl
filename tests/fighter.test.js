import { describe, it, expect } from 'vitest';
import {
  createFighter, resetFighter, setLoadout, applyStatus, isDisabled, isFrozen, slowFactor, cooldownFraction,
} from '../src/logic/fighter.js';
import { getCharacter } from '../src/data/characters.js';
import { getWeapon } from '../src/data/weapons.js';

const sparkle = () => createFighter({ id: 'p1', character: getCharacter('sparkle'), level: 1, weapon: getWeapon('sparkle', 1) });

describe('fighter', () => {
  it('starts with full energy and level-scaled stats', () => {
    const f = createFighter({ id: 'p1', character: getCharacter('sparkle'), level: 100, weapon: getWeapon('sparkle', 11) });
    expect(f.energy).toBe(100);
    expect(f.damageMult).toBeCloseTo(1.4 * 1.495);
    expect(f.speedMult).toBeCloseTo(1.099);
    expect(f.ko).toBe(false);
  });

  it('caps freeze at 1.2s and grants 2s immunity after', () => {
    const f = sparkle();
    expect(applyStatus(f, 0, { type: 'freeze', duration: 3 })).toBe(true);
    expect(f.status.freezeUntil).toBeCloseTo(1.2);
    expect(isFrozen(f, 1.0)).toBe(true);
    expect(isDisabled(f, 1.3)).toBe(false);
    expect(applyStatus(f, 2.0, { type: 'stun', duration: 0.5 })).toBe(false);
    expect(applyStatus(f, 3.3, { type: 'stun', duration: 0.5 })).toBe(true);
    expect(isDisabled(f, 3.5)).toBe(true);
  });

  it('caps slow at 50% and keeps the stronger slow', () => {
    const f = sparkle();
    applyStatus(f, 0, { type: 'slow', duration: 2, amount: 0.9 });
    expect(slowFactor(f, 1)).toBeCloseTo(0.5);
    applyStatus(f, 1, { type: 'slow', duration: 2, amount: 0.2 });
    expect(slowFactor(f, 1.5)).toBeCloseTo(0.5);
    expect(slowFactor(f, 3.5)).toBe(1);
  });

  it('reports cooldown fraction', () => {
    const f = sparkle();
    f.cooldowns.special = 2; // ready at t=2, cooldown 4
    expect(cooldownFraction(f, 'special', 0)).toBeCloseTo(0.5);
    expect(cooldownFraction(f, 'special', 3)).toBe(0);
  });

  it('resets for a new round', () => {
    const f = sparkle();
    f.energy = 3;
    f.ko = true;
    f.guardHits = 1;
    f.status.freezeUntil = 99;
    resetFighter(f, { x: 5, y: 0, z: 0 });
    expect(f.energy).toBe(100);
    expect(f.ko).toBe(false);
    expect(f.guardHits).toBe(0);
    expect(f.status.freezeUntil).toBe(0);
    expect(f.pos).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('changes loadout and recomputes stats', () => {
    const f = sparkle();
    f.cooldowns.special = 10;
    setLoadout(f, { character: getCharacter('rex'), level: 50, weapon: getWeapon('rex', 6) });
    expect(f.character.id).toBe('rex');
    expect(f.weapon.name).toBe('Goo Cannon');
    expect(f.damageMult).toBeCloseTo(1.245);
    expect(f.cooldowns.special).toBe(0);
  });
});
