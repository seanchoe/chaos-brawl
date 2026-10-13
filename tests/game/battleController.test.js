import { describe, it, expect } from 'vitest';
import { quickLoadout, buildMatchConfig, createBattleController, IDLE_INPUT, rewardMatch } from '../../src/game/battleController.js';
import { createSave } from '../../src/logic/save.js';
import { PET_IDS } from '../../src/data/pets.js';
import { INTRO_TIME } from '../../src/logic/match.js';
import { mulberry32 } from '../../src/logic/random.js';
import { DT } from '../../src/logic/constants.js';

const run = (c, seconds, inputs) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) c.step(DT, inputs);
};

describe('loadouts and config', () => {
  it('quick loadout uses the unlock level of the chosen tier', () => {
    expect(quickLoadout('rex', 3)).toEqual({ characterId: 'rex', tier: 3, level: 20, petId: null });
    expect(quickLoadout('rex', 1).level).toBe(1);
  });

  it('picks a CPU opponent in Vs Computer', () => {
    const cfg = buildMatchConfig({ mode: 'cpu', difficulty: 'medium', p1: { characterId: 'bubbles', tier: 3 } }, () => 0);
    expect(cfg.p1).toEqual(quickLoadout('bubbles', 3));
    expect(cfg.p2).toEqual({ characterId: 'sparkle', level: 20, tier: 3, petId: null });
    expect(cfg.difficulty).toBe('medium');
  });

  it('defaults to medium difficulty in Vs Computer', () => {
    const cfg = buildMatchConfig({ mode: 'cpu', p1: { characterId: 'bubbles', tier: 1 } }, () => 0);
    expect(cfg.difficulty).toBe('medium');
  });

  it('uses both choices in 2 Players', () => {
    const cfg = buildMatchConfig({ mode: '2p', p1: { characterId: 'bubbles', tier: 1 }, p2: { characterId: 'rex', tier: 2 } });
    expect(cfg.p2).toEqual(quickLoadout('rex', 2));
  });
});

describe('createBattleController', () => {
  it('drives both fighters from inputs in 2 Players', () => {
    const c = createBattleController(buildMatchConfig({ mode: '2p', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }));
    run(c, INTRO_TIME + DT, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    run(c, 0.5, { p1: { ...IDLE_INPUT, moveZ: 1 }, p2: { ...IDLE_INPUT, moveZ: -1 } });
    const [f1, f2] = c.match.world.fighters;
    expect(f1.pos.z).toBeGreaterThan(1);
    expect(f2.pos.z).toBeLessThan(-1);
  });

  it('lets the AI drive player 2 in Vs Computer', () => {
    const rng = mulberry32(7);
    const c = createBattleController(buildMatchConfig({ mode: 'cpu', difficulty: 'hard', p1: { characterId: 'sparkle', tier: 1 } }, rng), rng);
    run(c, INTRO_TIME + 1, { p1: IDLE_INPUT });
    const f2 = c.match.world.fighters[1];
    expect(f2.pos.x).not.toBe(5);
  });

  it('does nothing while paused or after the match ends', () => {
    const c = createBattleController(buildMatchConfig({ mode: '2p', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }));
    c.setPaused(true);
    run(c, 1, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    expect(c.match.stateTime).toBe(INTRO_TIME);
    c.setPaused(false);
    c.match.state = 'matchOver';
    const t = c.match.world.time;
    run(c, 1, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    expect(c.match.world.time).toBe(t);
    expect(c.isOver).toBe(true);
  });
});

describe('pets and rewards', () => {
  it('brings each player’s pet, and gives the CPU a pet only when Player 1 has one', () => {
    const withPet = buildMatchConfig({ mode: 'cpu', p1: { characterId: 'bubbles', tier: 1, petId: 'hops' } }, () => 0);
    expect(withPet.p1.petId).toBe('hops');
    expect(withPet.p2.petId).toBe(PET_IDS[0]);
    const noPet = buildMatchConfig({ mode: 'cpu', p1: { characterId: 'bubbles', tier: 1, petId: null } }, () => 0);
    expect(noPet.p2.petId).toBeNull();
    const twoP = buildMatchConfig({ mode: '2p', p1: { characterId: 'bubbles', tier: 1, petId: null }, p2: { characterId: 'rex', tier: 1, petId: 'ember' } });
    expect(twoP.p2.petId).toBe('ember');
    expect(createBattleController(twoP).match.world.pets.map((p) => p.def.id)).toEqual(['ember']);
  });

  it('adds coins (and XP) for a finished match, sharing one wallet in 2 Players', () => {
    const c = createBattleController(buildMatchConfig({ mode: '2p', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }));
    Object.assign(c.match, { state: 'matchOver', winner: 'p1', wins: { p1: 2, p2: 1 } });
    const save = createSave();
    const { save: next, coins } = rewardMatch(save, c.match);
    expect(coins).toBe(30 + 10 + 15 + 5);
    expect(next.coins).toBe(save.coins + coins);
    expect(next.characters.sparkle.xp).toBeGreaterThan(0);
  });
});
