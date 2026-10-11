import { MAX_ENERGY, MAX_CC_DURATION, CC_IMMUNITY, MAX_SLOW } from './constants.js';
import { damageMultiplier, speedMultiplier } from './progression.js';

function freshState(pos) {
  return {
    energy: MAX_ENERGY,
    pos: { x: pos.x, y: pos.y ?? 0, z: pos.z },
    velY: 0,
    knock: { x: 0, z: 0 },
    onGround: true,
    cooldowns: { basic: 0, special: 0 },
    status: { slowUntil: 0, slowAmount: 0, freezeUntil: 0, stunUntil: 0, ccImmuneUntil: 0 },
    shield: null,
    guardHits: 0,
    dash: null,
    leap: null,
    ko: false,
    input: { moveX: 0, moveZ: 0, jump: false, attack: false, special: false },
  };
}

export function createFighter({ id, character, level = 1, weapon = null, pos = { x: 0, y: 0, z: 0 } }) {
  const f = {
    id,
    facing: 0,
    infiniteEnergy: false,
    noCooldowns: false,
    ...freshState(pos),
  };
  setLoadout(f, { character, level, weapon });
  return f;
}

export function setLoadout(f, { character, level, weapon }) {
  f.character = character;
  f.level = level;
  f.weapon = weapon;
  f.damageMult = character.damage * damageMultiplier(level);
  f.speedMult = character.speed * speedMultiplier(level);
  f.cooldowns = { basic: 0, special: 0 };
}

export function resetFighter(f, pos) {
  Object.assign(f, freshState(pos));
}

export function isFrozen(f, now) {
  return now < f.status.freezeUntil;
}

export function isDisabled(f, now) {
  return now < f.status.freezeUntil || now < f.status.stunUntil;
}

export function slowFactor(f, now) {
  return now < f.status.slowUntil ? 1 - f.status.slowAmount : 1;
}

export function applyStatus(f, now, effect) {
  const s = f.status;
  if (effect.type === 'slow') {
    const amount = Math.min(MAX_SLOW, effect.amount);
    s.slowAmount = now < s.slowUntil ? Math.max(s.slowAmount, amount) : amount;
    s.slowUntil = Math.max(s.slowUntil, now + effect.duration);
    return true;
  }
  if (effect.type === 'freeze' || effect.type === 'stun') {
    if (now < s.ccImmuneUntil) return false;
    const duration = Math.min(MAX_CC_DURATION, effect.duration);
    if (effect.type === 'freeze') s.freezeUntil = now + duration;
    else s.stunUntil = now + duration;
    s.ccImmuneUntil = now + duration + CC_IMMUNITY;
    return true;
  }
  return false;
}

export function cooldownFraction(f, slot, now) {
  const def = f.weapon?.[slot];
  if (!def) return 0;
  const left = f.cooldowns[slot] - now;
  return left <= 0 ? 0 : Math.min(1, left / def.cooldown);
}
