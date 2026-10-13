import { CHARACTER_IDS } from '../src/data/characters.js';
import { createMatch, stepMatch } from '../src/logic/match.js';
import { createAI, updateAI } from '../src/logic/ai.js';
import { drainEvents } from '../src/logic/world.js';
import { mulberry32 } from '../src/logic/random.js';
import { tierForLevel } from '../src/logic/progression.js';
import { DT } from '../src/logic/constants.js';

const MAX_STEPS = 40000;

export function playMatch({ c1, c2, level, seed, difficulty = 'hard' }) {
  const tier = tierForLevel(level);
  const match = createMatch({
    mode: 'cpu',
    p1: { characterId: c1, level, tier, petId: null },
    p2: { characterId: c2, level, tier, petId: null },
  });
  const rng = mulberry32(seed);
  const ai1 = createAI(difficulty, rng);
  const ai2 = createAI(difficulty, rng);
  const [f1, f2] = match.world.fighters;
  for (let i = 0; i < MAX_STEPS && match.state !== 'matchOver'; i++) {
    updateAI(ai1, match.world, f1);
    updateAI(ai2, match.world, f2);
    stepMatch(match, DT);
    drainEvents(match.world);
  }
  return match.winner;
}

// Every ordered non-mirror pair, at each level and seed. Draws count half.
export function winRates({ levels = [1, 50, 100], seeds = [1, 2, 3, 4], difficulty = 'hard' } = {}) {
  const score = Object.fromEntries(CHARACTER_IDS.map((id) => [id, { points: 0, games: 0 }]));
  const matrix = Object.fromEntries(CHARACTER_IDS.map((id) => [id, Object.fromEntries(CHARACTER_IDS.map((o) => [o, 0]))]));
  for (const level of levels) {
    for (const seed of seeds) {
      for (const c1 of CHARACTER_IDS) {
        for (const c2 of CHARACTER_IDS) {
          if (c1 === c2) continue;
          const winner = playMatch({ c1, c2, level, seed, difficulty });
          score[c1].games += 1;
          score[c2].games += 1;
          if (winner === 'p1') { score[c1].points += 1; matrix[c1][c2] += 1; }
          else if (winner === 'p2') { score[c2].points += 1; matrix[c2][c1] += 1; }
          else { score[c1].points += 0.5; score[c2].points += 0.5; }
        }
      }
    }
  }
  const rates = Object.fromEntries(CHARACTER_IDS.map((id) => [id, score[id].points / score[id].games]));
  return { rates, matrix };
}
