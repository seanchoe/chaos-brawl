import { describe, it, expect } from 'vitest';
import { CHARACTERS, CHARACTER_IDS, getCharacter } from '../src/data/characters.js';
import { getWeapon, getWeaponLine } from '../src/data/weapons.js';
import { unlockLevel, TIER_COUNT } from '../src/logic/progression.js';
import { checkSteps } from './validate.js';

function checkAbility(ability, where) {
  expect(typeof ability.name, `${where} name`).toBe('string');
  expect(ability.name.length).toBeGreaterThan(0);
  expect(typeof ability.description, `${where} description`).toBe('string');
  expect(ability.description.length).toBeGreaterThan(0);
  expect(ability.cooldown, `${where} cooldown`).toBeGreaterThan(0);
  checkSteps(ability.steps, where);
}

describe('characters', () => {
  it('has the 4 characters', () => {
    expect(CHARACTER_IDS).toEqual(['sparkle', 'bubbles', 'pancake', 'rex']);
    for (const c of CHARACTERS) {
      expect(c.speed).toBeGreaterThan(0);
      expect(c.damage).toBeGreaterThan(0);
      expect(c.defense).toBeGreaterThan(0);
      expect(c.preferredRange).toBeGreaterThan(0);
      expect(typeof c.colors.main).toBe('number');
    }
  });

  it('throws for an unknown character', () => {
    expect(() => getCharacter('nobody')).toThrow();
  });
});

describe('weapons', () => {
  it('has 11 tiers per character with correct unlock levels', () => {
    for (const id of CHARACTER_IDS) {
      const line = getWeaponLine(id);
      expect(line).toHaveLength(TIER_COUNT);
      line.forEach((w, i) => {
        expect(w.tier).toBe(i + 1);
        expect(w.unlockLevel).toBe(unlockLevel(i + 1));
        expect(w.characterId).toBe(id);
      });
    }
  });

  it('every weapon has a valid basic attack and special', () => {
    for (const id of CHARACTER_IDS) {
      for (const w of getWeaponLine(id)) {
        checkAbility(w.basic, `${w.name} basic`);
        checkAbility(w.special, `${w.name} special`);
      }
    }
  });

  it('has 44 unique weapon names and 44 unique special names', () => {
    const all = CHARACTER_IDS.flatMap((id) => getWeaponLine(id));
    expect(new Set(all.map((w) => w.name)).size).toBe(44);
    expect(new Set(all.map((w) => w.special.name)).size).toBe(44);
  });

  it('basic attacks get stronger with tier', () => {
    for (const id of CHARACTER_IDS) {
      expect(getWeapon(id, 11).basic.steps[0].damage).toBeGreaterThan(getWeapon(id, 1).basic.steps[0].damage);
    }
  });

  it('throws for bad tiers', () => {
    expect(() => getWeapon('sparkle', 0)).toThrow();
    expect(() => getWeapon('sparkle', 12)).toThrow();
    expect(() => getWeapon('nobody', 1)).toThrow();
  });
});
