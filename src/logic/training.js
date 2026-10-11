import { MAX_ENERGY } from './constants.js';
import { getCharacter } from '../data/characters.js';
import { getWeapon } from '../data/weapons.js';
import { getPet } from '../data/pets.js';
import { isTierUnlocked } from './progression.js';
import { DEFAULT_TRAINING_OPTIONS, BOT_BEHAVIORS } from './save.js';
import { createFighter, setLoadout } from './fighter.js';
import { createPet } from './pets.js';
import { createWorld } from './world.js';
import { stepWorld } from './simulation.js';
import { dirTo } from './vec.js';
import { findIncomingProjectile } from './ai.js';

export const BOT_CHARACTER = {
  id: 'bot',
  name: 'Training Bot',
  speed: 0.6,
  damage: 0,
  defense: 1,
  preferredRange: 4,
  colors: { main: 0xffb703, accent: 0x8ecae6, alt: 0xffffff },
};
export { BOT_BEHAVIORS };
export const BOT_REFILL_DELAY = 2;
export const STATS_WINDOW = 5;
const BLOCK_EVERY = 4;
const BLOCK_DURATION = 1.5;
const WALK_RADIUS = 6;

function assertUnlocked(level, tier) {
  if (!isTierUnlocked(level, tier)) throw new Error(`Weapon tier ${tier} is locked at level ${level}`);
}

export function createTrainingSession({ characterId, level, tier, petId = null, options = {} }) {
  assertUnlocked(level, tier);
  const player = createFighter({
    id: 'p1', character: getCharacter(characterId), level, weapon: getWeapon(characterId, tier), pos: { x: -4, y: 0, z: 0 },
  });
  const bot = createFighter({ id: 'bot', character: BOT_CHARACTER, level: 1, weapon: null, pos: { x: 4, y: 0, z: 0 } });
  const world = createWorld([player, bot]);
  if (petId) world.pets.push(createPet(getPet(petId), player, 0));
  const session = {
    world,
    options: { ...DEFAULT_TRAINING_OPTIONS, ...options },
    stats: { last: 0, total: 0, recent: [] },
    botRefillAt: null,
    nextBlockAt: 2,
    walkAngle: 0,
  };
  applyOptions(session);
  return session;
}

function applyOptions(session) {
  const player = session.world.fighters[0];
  player.noCooldowns = session.options.noCooldowns;
  player.infiniteEnergy = session.options.infiniteEnergy;
}

export function setOption(session, key, value) {
  session.options[key] = value;
  applyOptions(session);
}

export function switchWeapon(session, { characterId, level, tier }) {
  assertUnlocked(level, tier);
  setLoadout(session.world.fighters[0], { character: getCharacter(characterId), level, weapon: getWeapon(characterId, tier) });
}

export function resetStats(session) {
  session.stats = { last: 0, total: 0, recent: [] };
}

export function damagePerSecond(session) {
  return session.stats.recent.reduce((sum, h) => sum + h.damage, 0) / STATS_WINDOW;
}

export function stepTraining(session, dt) {
  const { world, stats } = session;
  const bot = world.fighters[1];
  updateBot(session, bot, dt);

  const firstNew = world.events.length;
  stepWorld(world, dt);
  for (let i = firstNew; i < world.events.length; i++) {
    const e = world.events[i];
    if (e.type === 'hit' && e.attackerId === 'p1') {
      stats.last = e.dealt;
      stats.total += e.dealt;
      stats.recent.push({ time: world.time, damage: e.dealt });
    }
  }
  stats.recent = stats.recent.filter((h) => h.time > world.time - STATS_WINDOW);

  if (bot.ko && session.botRefillAt === null) session.botRefillAt = world.time + BOT_REFILL_DELAY;
  if (session.botRefillAt !== null && world.time >= session.botRefillAt) {
    bot.ko = false;
    bot.energy = MAX_ENERGY;
    session.botRefillAt = null;
    world.events.push({ type: 'botRefill' });
  }
}

function updateBot(session, bot, dt) {
  const { world } = session;
  bot.input = { moveX: 0, moveZ: 0, jump: false, attack: false, special: false };
  if (bot.ko) return;
  switch (session.options.botBehavior) {
    case 'walk': {
      session.walkAngle += dt * 0.6;
      const target = { x: Math.cos(session.walkAngle) * WALK_RADIUS, z: Math.sin(session.walkAngle) * WALK_RADIUS };
      const d = dirTo(bot.pos, target);
      bot.input.moveX = d.x;
      bot.input.moveZ = d.z;
      break;
    }
    case 'dodge': {
      const p = findIncomingProjectile(world, bot, 5);
      if (p) {
        bot.input.moveX = -p.vel.z;
        bot.input.moveZ = p.vel.x;
      }
      break;
    }
    case 'block':
      if (world.time >= session.nextBlockAt) {
        bot.shield = { until: world.time + BLOCK_DURATION, reduction: 1, onEnd: null };
        world.events.push({ type: 'shield', fighterId: bot.id, duration: BLOCK_DURATION, reduction: 1 });
        session.nextBlockAt = world.time + BLOCK_EVERY;
      }
      break;
    default:
      break;
  }
}
