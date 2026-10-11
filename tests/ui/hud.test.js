// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hudState, bannerFor, createHud } from '../../src/ui/hud.js';
import { createMatch, stepMatch, INTRO_TIME } from '../../src/logic/match.js';
import { DT } from '../../src/logic/constants.js';

const loadout = (characterId) => ({ characterId, level: 1, tier: 1, petId: null });
const newMatch = (mode = 'cpu', c2 = 'rex') => createMatch({ mode, p1: loadout('sparkle'), p2: loadout(c2) });

describe('bannerFor', () => {
  it('announces the round, then FIGHT!, then the round winner', () => {
    const m = newMatch();
    expect(bannerFor(m)).toBe('ROUND 1');
    stepMatch(m, INTRO_TIME * 0.6);
    expect(bannerFor(m)).toBe('GET READY...');
    stepMatch(m, INTRO_TIME);
    expect(bannerFor(m)).toBe('FIGHT!');
    stepMatch(m, 1);
    expect(bannerFor(m)).toBe('');
    m.world.fighters[1].ko = true;
    stepMatch(m, DT);
    expect(bannerFor(m)).toBe('Sir Sparkle wins the round!');
  });

  it('calls round 4+ a bonus round and handles ties, draws, and mirror names', () => {
    const m = newMatch('2p', 'sparkle');
    m.round = 4;
    expect(bannerFor(m)).toBe('BONUS ROUND!');
    m.state = 'roundOver';
    m.roundWinner = 'tie';
    expect(bannerFor(m)).toBe('TIE ROUND!');
    m.roundWinner = 'p2';
    expect(bannerFor(m)).toBe('Sir Sparkle (P2) wins the round!');
    m.state = 'matchOver';
    m.winner = 'draw';
    expect(bannerFor(m)).toBe("IT'S A DRAW!");
    m.winner = 'p1';
    expect(bannerFor(m)).toBe('Sir Sparkle (P1) WINS!');
  });
});

describe('hudState', () => {
  it('describes both players', () => {
    const m = newMatch();
    m.world.fighters[0].energy = 50;
    const s = hudState(m);
    expect(s.timer).toBe('60');
    expect(s.players[0]).toMatchObject({ label: 'P1', name: 'Sir Sparkle', level: 1, energyPct: 50, wins: 0, specialName: 'Dash Strike', keys: { attack: 'F', special: 'G' } });
    expect(s.players[1]).toMatchObject({ label: 'CPU', name: 'Robo Rex', energyPct: 100, keys: null });
  });

  it('shows P2 keys in 2-player mode', () => {
    expect(hudState(newMatch('2p')).players[1].keys).toEqual({ attack: 'K', special: 'L' });
  });
});

describe('createHud', () => {
  it('renders names, bars, timer, banner, and cooldowns', () => {
    const container = document.createElement('div');
    const hud = createHud(container);
    const m = newMatch();
    m.world.fighters[1].energy = 25;
    hud.update(hudState(m));
    expect(container.querySelector('[data-id="p1"] .hud-name').textContent).toBe('P1 · Sir Sparkle · Lv 1');
    expect(container.querySelector('[data-id="p2"] .hud-bar-fill').style.width).toBe('25%');
    expect(container.querySelector('[data-id="p2"] .hud-bar-fill').classList.contains('low')).toBe(true);
    expect(container.querySelector('.hud-timer').textContent).toBe('60');
    expect(container.querySelector('.hud-banner').textContent).toBe('ROUND 1');
    expect(container.querySelectorAll('[data-id="p1"] .hud-ability')).toHaveLength(2);
    hud.dispose();
    expect(container.children).toHaveLength(0);
  });
});
