import { createMatch, stepMatch, matchResults } from '../logic/match.js';
import { createAI, updateAI, pickAIOpponent } from '../logic/ai.js';
import { unlockLevel } from '../logic/progression.js';
import { applyMatchRewards } from '../logic/rewards.js';

export const IDLE_INPUT = Object.freeze({ moveX: 0, moveZ: 0, jump: false, attack: false, special: false });

// Quick-start only: picking a tier sets the level to the tier's unlock level.
// Plan 3 replaces this with real saved levels.
export function quickLoadout(characterId, tier, petId = null) {
  return { characterId, tier, level: unlockLevel(tier), petId };
}

// choice: { mode, difficulty, p1: { characterId, tier, petId? }, p2?: { characterId, tier, petId? } }
export function buildMatchConfig(choice, rng = Math.random) {
  const difficulty = choice.difficulty ?? 'medium';
  const p1 = quickLoadout(choice.p1.characterId, choice.p1.tier, choice.p1.petId ?? null);
  // The computer only brings a pet when Player 1 does, so it stays fair.
  const p2 = choice.mode === 'cpu'
    ? pickAIOpponent({ playerLevel: p1.level, difficulty, playerHasPet: p1.petId !== null, rng })
    : quickLoadout(choice.p2.characterId, choice.p2.tier, choice.p2.petId ?? null);
  return { mode: choice.mode, difficulty, p1, p2 };
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

// Adds a finished match's XP and coins to the save. In 2 Players both players' coins go into the one wallet.
export function rewardMatch(save, match) {
  const { save: next, summary } = applyMatchRewards(save, matchResults(match));
  return { save: next, coins: summary.reduce((sum, s) => sum + s.coinsGained, 0) };
}
