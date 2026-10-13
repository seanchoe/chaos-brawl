import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PETS } from '../../src/data/pets.js';
import { buildPetModel, PET_SPECIES } from '../../src/render/petModels.js';
import { createBattleView } from '../../src/render/view.js';
import { createMatch } from '../../src/logic/match.js';

describe('pet models', () => {
  it('has a model for every species', () => {
    for (const pet of PETS) expect(PET_SPECIES).toContain(pet.species);
  });

  it('builds every pet with a body that can hop', () => {
    for (const pet of PETS) {
      const model = buildPetModel(pet);
      expect(model.name).toBe(`pet-${pet.id}`);
      expect(model.userData.parts.body.children.length).toBeGreaterThan(3);
    }
  });
});

describe('pets in the battle view', () => {
  const loadout = (characterId, petId) => ({ characterId, level: 1, tier: 1, petId });

  it('shows each pet beside its owner, lunges on a strike, and cleans up', () => {
    const match = createMatch({ mode: '2p', p1: loadout('sparkle', 'biscuit'), p2: loadout('rex', null) });
    const scene = new THREE.Scene();
    const view = createBattleView(scene);
    const { world } = match;
    view.sync(world, 0.016);
    const model = view.petModel('p1');
    const pet = world.pets[0];
    expect(model.position.x).toBeCloseTo(pet.pos.x);
    expect(view.petModel('p2')).toBeNull();

    pet.strikeAnim = { to: { x: pet.pos.x + 4, y: 0, z: pet.pos.z }, until: world.time + 0.15 };
    view.sync(world, 0.016);
    expect(model.position.x).toBeGreaterThan(pet.pos.x + 1);

    world.pets = [];
    view.sync(world, 0.016);
    expect(view.petModel('p1')).toBeNull();
    expect(scene.getObjectByName('pet-biscuit')).toBeUndefined();
  });
});
