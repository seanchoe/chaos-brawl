import { describe, it, expect } from 'vitest';
import {
  createMatch, stepMatch, matchResults, INTRO_TIME, ROUND_OVER_TIME, MAX_ROUNDS,
} from '../src/logic/match.js';
import { applyMatchRewards } from '../src/logic/rewards.js';
import { createSave } from '../src/logic/save.js';
import { DT, ROUND_TIME } from '../src/logic/constants.js';

const cfg = (characterId, petId = null) => ({ characterId, level: 1, tier: 1, petId });
const newMatch = (mode = '2p') => createMatch({ mode, p1: cfg('sparkle', 'biscuit'), p2: cfg('rex') });

function toFighting(m) {
  stepMatch(m, INTRO_TIME);
  expect(m.state).toBe('fighting');
}
function ko(m, index) {
  const f = m.world.fighters[index];
  f.energy = 0;
  f.ko = true;
  stepMatch(m, DT);
}

describe('match', () => {
  it('starts in the intro with fighters and pets', () => {
    const m = newMatch();
    expect(m.state).toBe('intro');
    expect(m.round).toBe(1);
    expect(m.timeLeft).toBe(ROUND_TIME);
    expect(m.world.fighters.map((f) => f.character.id)).toEqual(['sparkle', 'rex']);
    expect(m.world.pets).toHaveLength(1);
    expect(m.world.pets[0].ownerId).toBe('p1');
  });

  it('does not simulate during the intro', () => {
    const m = newMatch();
    m.world.fighters[0].input.moveX = 1;
    stepMatch(m, 1);
    expect(m.world.fighters[0].pos.x).toBe(-5);
  });

  it('a knockout wins the round', () => {
    const m = newMatch();
    toFighting(m);
    ko(m, 1);
    expect(m.state).toBe('roundOver');
    expect(m.roundWinner).toBe('p1');
    expect(m.wins).toEqual({ p1: 1, p2: 0 });
    expect(m.world.events.some((e) => e.type === 'roundOver')).toBe(true);
  });

  it('starts the next round with everything reset', () => {
    const m = newMatch();
    toFighting(m);
    ko(m, 1);
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.state).toBe('intro');
    expect(m.round).toBe(2);
    expect(m.world.fighters[1].energy).toBe(100);
    expect(m.world.fighters[1].ko).toBe(false);
    expect(m.world.projectiles).toEqual([]);
    expect(m.timeLeft).toBe(ROUND_TIME);
  });

  it('first to 2 rounds wins the match', () => {
    const m = newMatch();
    toFighting(m); ko(m, 1); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 1);
    expect(m.winner).toBe('p1');
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.state).toBe('matchOver');
    expect(m.world.events.some((e) => e.type === 'matchOver' && e.winner === 'p1')).toBe(true);
  });

  it('on timeout, more energy wins the round', () => {
    const m = newMatch();
    toFighting(m);
    m.world.fighters[0].energy = 40;
    m.world.fighters[1].energy = 70;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.roundWinner).toBe('p2');
  });

  it('a tie gives both a point and 2-2 goes to sudden death', () => {
    const m = newMatch();
    toFighting(m);
    m.wins = { p1: 1, p2: 1 };
    m.round = 3;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.roundWinner).toBe('tie');
    expect(m.wins).toEqual({ p1: 2, p2: 2 });
    expect(m.winner).toBe(null);
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.round).toBe(4);
  });

  it('a double knockout is a tie', () => {
    const m = newMatch();
    toFighting(m);
    m.world.fighters[0].ko = true;
    ko(m, 1);
    expect(m.roundWinner).toBe('tie');
  });

  it('declares a draw if still tied at the round limit', () => {
    const m = newMatch();
    toFighting(m);
    m.wins = { p1: 1, p2: 1 };
    m.round = MAX_ROUNDS;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.winner).toBe('draw');
  });

  it('results include only Player 1 in Vs Computer', () => {
    const m = newMatch('cpu');
    toFighting(m); ko(m, 1); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 1);
    expect(matchResults(m)).toEqual([{ playerId: 'p1', characterId: 'sparkle', won: true, roundsWon: 2 }]);
  });

  it('results include both players in 2 Players', () => {
    const m = newMatch('2p');
    toFighting(m); ko(m, 0); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 0);
    expect(matchResults(m)).toEqual([
      { playerId: 'p1', characterId: 'sparkle', won: false, roundsWon: 0 },
      { playerId: 'p2', characterId: 'rex', won: true, roundsWon: 2 },
    ]);
  });
});

describe('rewards', () => {
  it('adds XP and coins to the save', () => {
    const { save, summary } = applyMatchRewards(createSave(), [
      { playerId: 'p1', characterId: 'sparkle', won: true, roundsWon: 2 },
    ]);
    expect(save.characters.sparkle).toEqual({ level: 4, xp: 28 });
    expect(save.coins).toBe(90);
    expect(summary).toEqual([{
      playerId: 'p1', characterId: 'sparkle', xpGained: 160, coinsGained: 40, fromLevel: 1, toLevel: 4, newTiers: [],
    }]);
  });

  it('applies both players, even with the same character', () => {
    const { save } = applyMatchRewards(createSave(), [
      { playerId: 'p1', characterId: 'rex', won: true, roundsWon: 2 },
      { playerId: 'p2', characterId: 'rex', won: false, roundsWon: 0 },
    ]);
    expect(save.coins).toBe(50 + 40 + 15);
    expect(save.characters.rex.level).toBe(6); // 160 XP → L4 (28 left), +75 → L6 (5 left)
  });
});
