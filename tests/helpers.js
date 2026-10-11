import { createFighter } from '../src/logic/fighter.js';
import { createWorld } from '../src/logic/world.js';

export const TEST_CHAR = { id: 'test', name: 'Tester', speed: 1, damage: 1, defense: 1, preferredRange: 2, colors: { main: 0, accent: 0, alt: 0 } };

export function weaponWith(basicSteps, specialSteps = [{ type: 'heal', amount: 1 }], cooldown = 1) {
  return {
    characterId: 'test',
    tier: 1,
    name: 'Test Weapon',
    basic: { name: 'Test Basic', description: 'test', cooldown, steps: basicSteps },
    special: { name: 'Test Special', description: 'test', cooldown, steps: specialSteps },
  };
}

export function duel({ a = {}, b = {} } = {}) {
  const f1 = createFighter({ id: 'p1', character: a.character ?? TEST_CHAR, weapon: a.weapon ?? null, pos: a.pos ?? { x: -2, y: 0, z: 0 } });
  const f2 = createFighter({ id: 'p2', character: b.character ?? TEST_CHAR, weapon: b.weapon ?? null, pos: b.pos ?? { x: 2, y: 0, z: 0 } });
  return { world: createWorld([f1, f2]), f1, f2 };
}
