import { describe, it, expect } from 'vitest';
import {
  AI_SETTINGS, pickAIOpponent, createAI, updateAI, abilityReach, isSelfAbility, findIncomingProjectile,
} from '../src/logic/ai.js';
import { getCharacter } from '../src/data/characters.js';
import { getWeapon } from '../src/data/weapons.js';
import { runStep } from '../src/logic/abilities.js';
import { duel } from './helpers.js';

const always = (v) => () => v;

describe('pickAIOpponent', () => {
  it('scales level by difficulty and clamps 1-100', () => {
    expect(pickAIOpponent({ playerLevel: 5, difficulty: 'easy', playerHasPet: false, rng: always(0) }).level).toBe(1);
    expect(pickAIOpponent({ playerLevel: 30, difficulty: 'medium', playerHasPet: false, rng: always(0) }).level).toBe(30);
    expect(pickAIOpponent({ playerLevel: 98, difficulty: 'hard', playerHasPet: false, rng: always(0) }).level).toBe(100);
  });

  it('uses the highest tier for its level', () => {
    expect(pickAIOpponent({ playerLevel: 35, difficulty: 'medium', playerHasPet: false, rng: always(0) }).tier).toBe(4);
  });

  it('gets a pet only if the player has one', () => {
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: false, rng: always(0) }).petId).toBe(null);
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: true, rng: always(0) }).petId).toBe('biscuit');
  });

  it('picks a character from the rng', () => {
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: false, rng: always(0.99) }).characterId).toBe('rex');
  });
});

describe('ability helpers', () => {
  it('estimates reach', () => {
    expect(abilityReach(getWeapon('sparkle', 1).basic)).toBeCloseTo(2.5);
    expect(abilityReach(getWeapon('rex', 1).basic)).toBeCloseTo(16);
    expect(abilityReach(getWeapon('bubbles', 10).special)).toBe(15);
  });

  it('detects self abilities', () => {
    expect(isSelfAbility(getWeapon('bubbles', 6).special)).toBe(true); // heal
    expect(isSelfAbility(getWeapon('bubbles', 3).special)).toBe(true); // blink
    expect(isSelfAbility(getWeapon('sparkle', 1).special)).toBe(false);
  });
});

describe('updateAI', () => {
  const setup = (characterId, oppX) => duel({
    a: { character: getCharacter(characterId), weapon: getWeapon(characterId, 1), pos: { x: 0, y: 0, z: 0 } },
    b: { pos: { x: oppX, y: 0, z: 0 } },
  });

  it('walks toward a far opponent', () => {
    const { world, f1 } = setup('sparkle', 10);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.moveX).toBeGreaterThan(0);
    expect(f1.input.attack).toBe(false);
  });

  it('attacks when in reach', () => {
    const { world, f1 } = setup('rex', 5);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.attack).toBe(true);
  });

  it('backs away when a ranged fighter is too close', () => {
    const { world, f1 } = setup('bubbles', 2);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.moveX).toBeLessThan(0);
  });

  it('slides along the wall instead of backing into it', () => {
    const { world, f1 } = duel({
      a: { character: getCharacter('bubbles'), weapon: getWeapon('bubbles', 1), pos: { x: 10.5, y: 0, z: 0 } },
      b: { pos: { x: 8.5, y: 0, z: 0 } },
    });
    updateAI(createAI('medium', always(0.5)), world, f1);
    const outward = { x: 1, z: 0 };
    expect(f1.input.moveX * outward.x + f1.input.moveZ * outward.z).toBeLessThanOrEqual(0);
    expect(Math.abs(f1.input.moveZ)).toBeGreaterThan(0.1);
  });

  it('uses the special when ready and in reach', () => {
    const { world, f1 } = setup('rex', 3);
    updateAI(createAI('hard', always(0.5)), world, f1);
    expect(f1.input.special).toBe(true);
  });

  it('easy rarely uses specials', () => {
    const { world, f1 } = setup('rex', 3);
    updateAI(createAI('easy', always(0.5)), world, f1);
    expect(f1.input.special).toBe(false);
  });

  it('easy never blocks with shield-only specials', () => {
    for (const tier of [3, 8]) {
      const easy = duel({ a: { character: getCharacter('sparkle'), weapon: getWeapon('sparkle', tier), pos: { x: 0, y: 0, z: 0 } }, b: { pos: { x: 3, y: 0, z: 0 } } });
      updateAI(createAI('easy', always(0)), easy.world, easy.f1);
      expect(easy.f1.input.special).toBe(false);
    }
    const medium = duel({ a: { character: getCharacter('sparkle'), weapon: getWeapon('sparkle', 3), pos: { x: 0, y: 0, z: 0 } }, b: { pos: { x: 3, y: 0, z: 0 } } });
    updateAI(createAI('medium', always(0)), medium.world, medium.f1);
    expect(medium.f1.input.special).toBe(true);
  });

  it('only re-thinks after its reaction time, and does not hold special/jump', () => {
    const { world, f1 } = setup('rex', 3);
    const ai = createAI('hard', always(0.5));
    updateAI(ai, world, f1);
    expect(ai.nextThinkAt).toBeCloseTo(AI_SETTINGS.hard.reaction);
    world.time = 0.01;
    updateAI(ai, world, f1);
    expect(f1.input.special).toBe(false);
    expect(f1.input.attack).toBe(true);
  });

  it('hard AI jumps over incoming projectiles', () => {
    const { world, f1, f2 } = setup('sparkle', 4);
    runStep(world, f2, { type: 'projectile', damage: 5, speed: 14, size: 0.3, life: 1 }, f2, 1);
    expect(findIncomingProjectile(world, f1)).not.toBe(null);
    updateAI(createAI('hard', always(0.1)), world, f1);
    expect(f1.input.jump).toBe(true);
  });

  it('does nothing when knocked out', () => {
    const { world, f1 } = setup('rex', 3);
    f1.ko = true;
    updateAI(createAI('hard', always(0.5)), world, f1);
    expect(f1.input).toEqual({ moveX: 0, moveZ: 0, jump: false, attack: false, special: false });
  });
});
