import { describe, it, expect } from 'vitest';
import {
  BOT_REFILL_DELAY, STATS_WINDOW, createTrainingSession, stepTraining, setOption, switchWeapon, damagePerSecond, resetStats,
} from '../src/logic/training.js';
import { DEFAULT_TRAINING_OPTIONS } from '../src/logic/save.js';
import { DT } from '../src/logic/constants.js';
import { applyDamage } from '../src/logic/combat.js';
import { schedule } from '../src/logic/world.js';

function runTraining(session, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepTraining(session, DT);
}
const sparkle = (extra = {}) => createTrainingSession({ characterId: 'sparkle', level: 1, tier: 1, ...extra });

describe('training', () => {
  it('starts with default options, the player and a bot', () => {
    const s = sparkle();
    expect(s.options).toEqual(DEFAULT_TRAINING_OPTIONS);
    expect(s.world.fighters.map((f) => f.id)).toEqual(['p1', 'bot']);
    expect(s.world.fighters[1].weapon).toBe(null);
  });

  it('refuses locked weapon tiers', () => {
    expect(() => createTrainingSession({ characterId: 'sparkle', level: 5, tier: 2 })).toThrow();
    const s = sparkle();
    expect(() => switchWeapon(s, { characterId: 'rex', level: 1, tier: 3 })).toThrow();
  });

  it('tracks damage stats from player hits', () => {
    const s = sparkle();
    const [player, bot] = s.world.fighters;
    bot.pos.x = -2.5;
    player.input.attack = true;
    stepTraining(s, DT);
    expect(s.stats.last).toBeGreaterThan(0);
    expect(s.stats.total).toBeCloseTo(s.stats.last);
    expect(damagePerSecond(s)).toBeCloseTo(s.stats.total / STATS_WINDOW);
    resetStats(s);
    expect(s.stats).toEqual({ last: 0, total: 0, recent: [] });
  });

  it('does not count overkill damage in the stats', () => {
    const s = sparkle();
    const [player, bot] = s.world.fighters;
    bot.energy = 5;
    schedule(s.world, 0, () => applyDamage(s.world, bot, 10, player));
    stepTraining(s, DT);
    expect(bot.ko).toBe(true);
    expect(s.stats.last).toBe(5);
    expect(s.stats.total).toBe(5);
    expect(s.stats.recent.map((h) => h.damage)).toEqual([5]);
  });

  it('counts pet damage in the stats', () => {
    const s = sparkle({ petId: 'hoot' });
    runTraining(s, 3);
    expect(s.stats.total).toBeGreaterThan(0);
  });

  it('the bot pops back with full energy after a knockout', () => {
    const s = sparkle();
    const bot = s.world.fighters[1];
    bot.energy = 0;
    bot.ko = true;
    runTraining(s, BOT_REFILL_DELAY + 0.1);
    expect(bot.ko).toBe(false);
    expect(bot.energy).toBe(100);
    expect(s.world.events.some((e) => e.type === 'botRefill')).toBe(true);
  });

  it('applies No Cooldowns and Infinite Energy to the player', () => {
    const s = sparkle();
    setOption(s, 'noCooldowns', true);
    setOption(s, 'infiniteEnergy', true);
    expect(s.world.fighters[0].noCooldowns).toBe(true);
    expect(s.world.fighters[0].infiniteEnergy).toBe(true);
  });

  it('block behavior raises a shield every few seconds', () => {
    const s = sparkle({ options: { botBehavior: 'block' } });
    runTraining(s, 2.1);
    expect(s.world.fighters[1].shield).not.toBe(null);
  });

  it('walk behavior moves the bot', () => {
    const s = sparkle({ options: { botBehavior: 'walk' } });
    const start = { ...s.world.fighters[1].pos };
    runTraining(s, 1);
    expect(s.world.fighters[1].pos).not.toEqual(start);
  });

  it('dodge behavior sidesteps incoming projectiles', () => {
    const s = createTrainingSession({ characterId: 'rex', level: 1, tier: 1, options: { botBehavior: 'dodge' } });
    const [player, bot] = s.world.fighters;
    player.input.attack = true;
    runTraining(s, 0.3);
    expect(Math.abs(bot.pos.z)).toBeGreaterThan(0);
  });

  it('switches weapons in place', () => {
    const s = sparkle();
    switchWeapon(s, { characterId: 'rex', level: 25, tier: 3 });
    const player = s.world.fighters[0];
    expect(player.character.id).toBe('rex');
    expect(player.weapon.name).toBe('Dart Launcher');
    expect(player.level).toBe(25);
  });
});
