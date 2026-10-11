import { createMatch, stepMatch } from '../logic/match.js';
import { createAI, updateAI, pickAIOpponent } from '../logic/ai.js';
import { unlockLevel } from '../logic/progression.js';

export const IDLE_INPUT = Object.freeze({ moveX: 0, moveZ: 0, jump: false, attack: false, special: false });

// Quick-start only: picking a tier sets the level to the tier's unlock level.
// Plan 3 replaces this with real saved levels.
export function quickLoadout(characterId, tier) {
  return { characterId, tier, level: unlockLevel(tier), petId: null };
}

// choice: { mode, difficulty, p1: { characterId, tier }, p2?: { characterId, tier } }
export function buildMatchConfig(choice, rng = Math.random) {
  const p1 = quickLoadout(choice.p1.characterId, choice.p1.tier);
  const p2 = choice.mode === 'cpu'
    ? pickAIOpponent({ playerLevel: p1.level, difficulty: choice.difficulty, playerHasPet: false, rng })
    : quickLoadout(choice.p2.characterId, choice.p2.tier);
  return { mode: choice.mode, difficulty: choice.difficulty, p1, p2 };
}

export function createBattleController(config, rng = Math.random) {
  const match = createMatch({ mode: config.mode, p1: config.p1, p2: config.p2 });
  const ai = config.mode === 'cpu' ? createAI(config.difficulty ?? 'medium', rng) : null;
  let paused = false;

  return {
    match,
    get paused() { return paused; },
    setPaused(value) { paused = value; },
    get isOver() { return match.state === 'matchOver'; },
    // inputs: { p1, p2? } engine input objects
    step(dt, inputs) {
      if (paused || match.state === 'matchOver') return;
      const [f1, f2] = match.world.fighters;
      f1.input = { ...(inputs.p1 ?? IDLE_INPUT) };
      if (ai) updateAI(ai, match.world, f2);
      else f2.input = { ...(inputs.p2 ?? IDLE_INPUT) };
      stepMatch(match, dt);
    },
  };
}
