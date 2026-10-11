import { ARENA_RADIUS, FIGHTER_RADIUS } from './constants.js';
import { CHARACTER_IDS } from '../data/characters.js';
import { PET_IDS } from '../data/pets.js';
import { MAX_LEVEL, tierForLevel } from './progression.js';
import { dist2D, dirTo } from './vec.js';
import { opponentOf } from './world.js';

export const AI_SETTINGS = {
  easy: { reaction: 0.8, specialChance: 0.15, dodgeChance: 0, blocks: false, blockChance: 0, levelOffset: -10 },
  medium: { reaction: 0.45, specialChance: 0.6, dodgeChance: 0.1, blocks: false, blockChance: 0.3, levelOffset: 0 },
  hard: { reaction: 0.25, specialChance: 0.85, dodgeChance: 0.5, blocks: true, blockChance: 1, levelOffset: 5 },
};

const TARGETED_REACH = 15;
const WALL_MARGIN = 1.5;
const WALL_INWARD = 0.5;
const IDLE_INPUT = { moveX: 0, moveZ: 0, jump: false, attack: false, special: false };

export function pickAIOpponent({ playerLevel, difficulty, playerHasPet, rng = Math.random }) {
  const level = Math.min(MAX_LEVEL, Math.max(1, playerLevel + AI_SETTINGS[difficulty].levelOffset));
  const characterId = CHARACTER_IDS[Math.floor(rng() * CHARACTER_IDS.length)];
  const petId = playerHasPet ? PET_IDS[Math.floor(rng() * PET_IDS.length)] : null;
  return { characterId, level, tier: tierForLevel(level), petId };
}

export function createAI(difficulty, rng = Math.random) {
  return { settings: AI_SETTINGS[difficulty], rng, nextThinkAt: 0, plan: { ...IDLE_INPUT }, strafe: 1 };
}

export function abilityReach(def) {
  let reach = 0;
  for (const s of def.steps) {
    let r = 0;
    if (s.type === 'melee') r = s.range + FIGHTER_RADIUS;
    else if (s.type === 'projectile') r = s.speed * s.life;
    else if (s.type === 'dash') r = s.distance;
    else if (s.type === 'burst' || s.type === 'zone') r = s.at === 'target' ? TARGETED_REACH : s.radius;
    else if (s.type === 'leap') r = TARGETED_REACH;
    else if (s.type === 'strike' || s.type === 'pull') r = s.range;
    reach = Math.max(reach, r);
  }
  return reach;
}

export function isSelfAbility(def) {
  return def.steps.every((s) => ['shield', 'heal', 'guard'].includes(s.type) || (s.type === 'dash' && s.direction === 'escape'));
}

export function findIncomingProjectile(world, f, radius = 4) {
  return world.projectiles.find((p) => p.ownerId !== f.id
    && dist2D(p.pos, f.pos) < radius
    && p.vel.x * (f.pos.x - p.pos.x) + p.vel.z * (f.pos.z - p.pos.z) > 0) ?? null;
}

export function updateAI(ai, world, me) {
  const now = world.time;
  if (now < ai.nextThinkAt) {
    me.input = { ...ai.plan, jump: false, special: false };
    return;
  }
  const { settings, rng } = ai;
  ai.nextThinkAt = now + settings.reaction * (0.7 + 0.6 * rng());
  const plan = { ...IDLE_INPUT };
  const opp = opponentOf(world, me);

  if (!opp || opp.ko || me.ko || !me.weapon) {
    ai.plan = plan;
    me.input = { ...plan };
    return;
  }

  const d = dist2D(me.pos, opp.pos);
  const to = dirTo(me.pos, opp.pos);
  const pref = me.character.preferredRange;
  if (rng() < 0.2) ai.strafe *= -1;

  if (d > pref + 1) {
    plan.moveX = to.x;
    plan.moveZ = to.z;
  } else if (d < pref - 1.5) {
    const r = Math.hypot(me.pos.x, me.pos.z);
    if (r >= ARENA_RADIUS - WALL_MARGIN) {
      // Pinned near the wall: slide along it (strafe direction) and drift back toward the centre.
      const out = { x: me.pos.x / r, z: me.pos.z / r };
      const mx = -out.z * ai.strafe - out.x * WALL_INWARD;
      const mz = out.x * ai.strafe - out.z * WALL_INWARD;
      const len = Math.hypot(mx, mz);
      plan.moveX = mx / len;
      plan.moveZ = mz / len;
    } else {
      plan.moveX = -to.x;
      plan.moveZ = -to.z;
    }
  } else {
    plan.moveX = -to.z * ai.strafe;
    plan.moveZ = to.x * ai.strafe;
  }

  plan.attack = d <= abilityReach(me.weapon.basic) + 0.3;

  const special = me.weapon.special;
  if (now >= me.cooldowns.special && rng() < settings.specialChance) {
    if (isSelfAbility(special)) {
      const hasHeal = special.steps.some((s) => s.type === 'heal');
      const hasShield = special.steps.some((s) => s.type === 'shield');
      if (hasHeal && me.energy < 60) plan.special = true;
      else if (hasShield && d < 4 && (settings.blocks || rng() < settings.blockChance)) plan.special = true;
      else if (!hasHeal && !hasShield && d < 2.5) plan.special = true;
    } else if (d <= abilityReach(special) + 0.5) {
      plan.special = true;
    }
  }

  if (settings.dodgeChance > 0 && rng() < settings.dodgeChance && findIncomingProjectile(world, me)) {
    plan.jump = true;
  }

  ai.plan = plan;
  me.input = { ...plan };
}
