import { describe, it, expect } from 'vitest';
import { PETS, PET_IDS, PET_TRIGGERS, getPet } from '../src/data/pets.js';
import { checkSteps } from './validate.js';

describe('pets data', () => {
  it('has 8 pets with unique ids and rising prices', () => {
    expect(PETS).toHaveLength(8);
    expect(new Set(PET_IDS).size).toBe(8);
    for (let i = 1; i < PETS.length; i++) expect(PETS[i].price).toBeGreaterThan(PETS[i - 1].price);
    expect(PETS[0].price).toBe(50);
  });

  it('every pet is well formed', () => {
    for (const p of PETS) {
      expect(typeof p.name).toBe('string');
      expect(typeof p.species).toBe('string');
      expect(p.interval).toBeGreaterThan(0);
      expect(PET_TRIGGERS).toContain(p.trigger);
      if (p.trigger === 'inRange') expect(p.range).toBeGreaterThan(0);
      expect(typeof p.move.name).toBe('string');
      expect(typeof p.move.description).toBe('string');
      checkSteps(p.move.steps, p.name);
    }
  });

  it('throws for unknown pets', () => {
    expect(() => getPet('dragonzilla')).toThrow();
  });
});
