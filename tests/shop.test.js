import { describe, it, expect } from 'vitest';
import { createSave } from '../src/logic/save.js';
import { ownsPet, canBuyPet, coinsNeeded, buyPet, equipPet } from '../src/logic/shop.js';

describe('shop', () => {
  it('buys a pet with enough coins', () => {
    const r = buyPet(createSave(), 'biscuit');
    expect(r.ok).toBe(true);
    expect(r.save.coins).toBe(0);
    expect(ownsPet(r.save, 'biscuit')).toBe(true);
  });

  it('cannot buy twice', () => {
    const once = buyPet({ ...createSave(), coins: 500 }, 'biscuit').save;
    const twice = buyPet(once, 'biscuit');
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('owned');
    expect(twice.save).toBe(once);
  });

  it('cannot buy without enough coins', () => {
    const save = createSave();
    expect(canBuyPet(save, 'whiskers')).toBe(false);
    expect(coinsNeeded(save, 'whiskers')).toBe(50);
    const r = buyPet(save, 'whiskers');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('coins');
    expect(r.save).toBe(save);
  });

  it('does not change the original save', () => {
    const save = createSave();
    buyPet(save, 'biscuit');
    expect(save.coins).toBe(50);
    expect(save.ownedPets).toEqual([]);
  });

  it('equips only owned pets, or none', () => {
    const owned = buyPet(createSave(), 'biscuit').save;
    expect(equipPet(owned, 'p1', 'biscuit').lastPets.p1).toBe('biscuit');
    expect(equipPet(owned, 'p1', 'twinkle')).toBe(owned);
    expect(equipPet(equipPet(owned, 'p2', 'biscuit'), 'p2', null).lastPets.p2).toBe(null);
  });
});
