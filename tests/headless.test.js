import { describe, it, expect } from 'vitest';
import { CHARACTER_IDS } from '../src/data/characters.js';
import { PET_IDS } from '../src/data/pets.js';
import { createMatch, stepMatch } from '../src/logic/match.js';
import { createAI, updateAI } from '../src/logic/ai.js';
import { drainEvents } from '../src/logic/world.js';
import { mulberry32 } from '../src/logic/random.js';
import { DT } from '../src/logic/constants.js';

const MAX_STEPS = 40000;

function playMatch({ c1, c2, level, tier, pet1, pet2, seed }) {
  const match = createMatch({
    mode: 'cpu',
    p1: { characterId: c1, level, tier, petId: pet1 },
    p2: { characterId: c2, level, tier, petId: pet2 },
  });
  const rng = mulberry32(seed);
  const ai1 = createAI('hard', rng);
  const ai2 = createAI('medium', rng);
  const [f1, f2] = match.world.fighters;
  let hits = 0;
  for (let i = 0; i < MAX_STEPS && match.state !== 'matchOver'; i++) {
    updateAI(ai1, match.world, f1);
    updateAI(ai2, match.world, f2);
    stepMatch(match, DT);
    for (const f of match.world.fighters) {
      if (!Number.isFinite(f.pos.x) || !Number.isFinite(f.pos.z) || !Number.isFinite(f.energy)) {
        throw new Error(`Bad fighter state: ${JSON.stringify(f.pos)} energy ${f.energy}`);
      }
    }
    hits += drainEvents(match.world).filter((e) => e.type === 'hit').length;
  }
  return { match, hits };
}

describe('headless AI vs AI', () => {
  for (const [level, tier] of [[1, 1], [50, 6], [100, 11]]) {
    for (const c1 of CHARACTER_IDS) {
      for (const c2 of CHARACTER_IDS) {
        it(`${c1} vs ${c2} at level ${level} finishes with a result`, () => {
          const seed = level * 100 + CHARACTER_IDS.indexOf(c1) * 10 + CHARACTER_IDS.indexOf(c2);
          const pet1 = PET_IDS[seed % PET_IDS.length];
          const pet2 = PET_IDS[(seed + 3) % PET_IDS.length];
          const { match, hits } = playMatch({ c1, c2, level, tier, pet1, pet2, seed });
          expect(match.state).toBe('matchOver');
          expect(['p1', 'p2', 'draw']).toContain(match.winner);
          expect(hits).toBeGreaterThan(0);
        });
      }
    }
  }
});
