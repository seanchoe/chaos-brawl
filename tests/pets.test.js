import { describe, it, expect } from 'vitest';
import { createPet, PET_FIRST_DELAY } from '../src/logic/pets.js';
import { getPet } from '../src/data/pets.js';
import { duel, run } from './helpers.js';

function withPet(petId, opts) {
  const d = duel(opts);
  const pet = createPet(getPet(petId), d.f1, 0);
  d.world.pets.push(pet);
  return { ...d, pet };
}

describe('pets', () => {
  it('waits for its first timer, then strikes a nearby opponent', () => {
    const { world, f2 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    run(world, PET_FIRST_DELAY - 0.1);
    expect(f2.energy).toBe(100);
    run(world, 0.2);
    expect(f2.energy).toBe(96);
    expect(world.events.some((e) => e.type === 'petMove' && e.petId === 'biscuit')).toBe(true);
  });

  it('pet damage is credited to the owner and not level-scaled', () => {
    const { world, f1 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.damageMult = 3;
    run(world, PET_FIRST_DELAY + 0.1);
    const hit = world.events.find((e) => e.type === 'hit');
    expect(hit.attackerId).toBe('p1');
    expect(hit.damage).toBe(4);
  });

  it('does not strike when the opponent is out of range', () => {
    const { world, f2 } = withPet('biscuit', { a: { pos: { x: -10, y: 0, z: 0 } }, b: { pos: { x: 10, y: 0, z: 0 } } });
    run(world, 3);
    expect(f2.energy).toBe(100);
  });

  it('heal pet only heals when the owner is hurt', () => {
    const full = withPet('hops');
    run(full.world, PET_FIRST_DELAY + 0.1);
    expect(full.world.events.some((e) => e.type === 'petMove')).toBe(false);

    const hurt = withPet('hops');
    hurt.f1.energy = 50;
    run(hurt.world, PET_FIRST_DELAY + 0.1);
    expect(hurt.f1.energy).toBe(58);
  });

  it('Shelly guards the owner against exactly one hit', () => {
    const { world, f1 } = withPet('shelly');
    run(world, PET_FIRST_DELAY + 0.1);
    expect(f1.guardHits).toBe(1);
  });

  it('No Cooldowns makes the pet act every half second', () => {
    const { world, f1, pet } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.noCooldowns = true;
    run(world, PET_FIRST_DELAY + 0.05);
    expect(pet.nextAt).toBeCloseTo(world.time + 0.5, 1);
  });

  it('follows its owner', () => {
    const { world, f1, pet } = withPet('hoot', { b: { pos: { x: 8, y: 0, z: 0 } } });
    f1.input.moveZ = 1;
    run(world, 1);
    f1.input.moveZ = 0;
    run(world, 1);
    expect(Math.hypot(pet.pos.x - f1.pos.x, pet.pos.z - f1.pos.z)).toBeLessThan(2.5);
  });

  it('pets are not fighters and cannot be hurt', () => {
    const { world, pet } = withPet('hoot');
    expect(world.fighters).not.toContain(pet);
    expect(pet.energy).toBeUndefined();
  });

  it('stops helping when the owner is knocked out', () => {
    const { world, f1, f2 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.ko = true;
    run(world, 3);
    expect(f2.energy).toBe(100);
  });
});
