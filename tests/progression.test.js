import { describe, it, expect } from 'vitest';
import {
  MAX_LEVEL, xpToNext, unlockLevel, tierForLevel, isTierUnlocked, unlockedTiers,
  damageMultiplier, speedMultiplier, addXp, matchRewards,
} from '../src/logic/progression.js';

describe('progression', () => {
  it('uses the 40 + 2L XP curve', () => {
    expect(xpToNext(1)).toBe(42);
    expect(xpToNext(99)).toBe(238);
  });

  it('unlocks tiers at levels 1, 10, 20 ... 100', () => {
    expect(unlockLevel(1)).toBe(1);
    expect(unlockLevel(2)).toBe(10);
    expect(unlockLevel(11)).toBe(100);
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(9)).toBe(1);
    expect(tierForLevel(10)).toBe(2);
    expect(tierForLevel(99)).toBe(10);
    expect(tierForLevel(100)).toBe(11);
  });

  it('knows which tiers are unlocked', () => {
    expect(isTierUnlocked(25, 3)).toBe(true);
    expect(isTierUnlocked(25, 4)).toBe(false);
    expect(isTierUnlocked(25, 0)).toBe(false);
    expect(unlockedTiers(25)).toEqual([1, 2, 3]);
  });

  it('scales damage and speed with level', () => {
    expect(damageMultiplier(1)).toBe(1);
    expect(damageMultiplier(100)).toBeCloseTo(1.495);
    expect(speedMultiplier(1)).toBe(1);
    expect(speedMultiplier(100)).toBeCloseTo(1.099);
  });

  it('levels up once', () => {
    expect(addXp({ level: 1, xp: 0 }, 42)).toEqual({ level: 2, xp: 0, levelsGained: 1, newTiers: [] });
  });

  it('levels up several times with leftover XP', () => {
    const r = addXp({ level: 1, xp: 0 }, 96);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(10);
    expect(r.levelsGained).toBe(2);
  });

  it('reports newly unlocked tiers', () => {
    expect(addXp({ level: 9, xp: 0 }, xpToNext(9)).newTiers).toEqual([2]);
  });

  it('caps at level 100 with 0 XP', () => {
    const r = addXp({ level: 99, xp: 0 }, 1e6);
    expect(r).toEqual({ level: MAX_LEVEL, xp: 0, levelsGained: 1, newTiers: [11] });
    expect(addXp({ level: 100, xp: 0 }, 500)).toEqual({ level: 100, xp: 0, levelsGained: 0, newTiers: [] });
  });

  it('gives match rewards for wins and losses', () => {
    expect(matchRewards({ won: true, roundsWon: 2 })).toEqual({ xp: 160, coins: 40 });
    expect(matchRewards({ won: false, roundsWon: 1 })).toEqual({ xp: 80, coins: 20 });
  });
});
