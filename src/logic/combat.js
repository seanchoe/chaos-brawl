import { MAX_ENERGY } from './constants.js';
import { applyStatus } from './fighter.js';
import { dirTo } from './vec.js';

export function applyDamage(world, target, amount, attacker, popup) {
  if (target.ko) return 0;
  const base = { targetId: target.id, attackerId: attacker?.id ?? null, pos: { ...target.pos } };
  if (target.guardHits > 0) {
    target.guardHits -= 1;
    world.events.push({ type: 'blocked', ...base, popup: 'BOING!' });
    return 0;
  }
  const reduction = target.shield && world.time < target.shield.until ? target.shield.reduction : 0;
  if (reduction >= 1) {
    world.events.push({ type: 'blocked', ...base, popup: 'BOING!' });
    return 0;
  }
  const damage = amount * target.character.defense * (1 - reduction);
  if (!target.infiniteEnergy) target.energy = Math.max(0, target.energy - damage);
  world.events.push({ type: 'hit', ...base, damage, popup });
  if (target.energy <= 0) {
    target.ko = true;
    world.events.push({ type: 'ko', targetId: target.id });
  }
  return damage;
}

export function heal(world, f, amount) {
  if (f.ko) return;
  const before = f.energy;
  f.energy = Math.min(MAX_ENERGY, f.energy + amount);
  world.events.push({ type: 'heal', targetId: f.id, amount: f.energy - before, pos: { ...f.pos } });
}

export function pullToward(target, point, strength) {
  const d = dirTo(target.pos, point);
  target.knock.x += d.x * strength;
  target.knock.z += d.z * strength;
}

// `hit` is any object with { damage, knockback?, effects?, popup? } — a step or a projectile.
export function hitTarget(world, attacker, target, hit, fromPos, scale) {
  const dealt = applyDamage(world, target, hit.damage * scale, attacker, hit.popup);
  if (dealt <= 0) return 0;
  if (hit.knockback) {
    const d = dirTo(fromPos, target.pos);
    target.knock.x += d.x * hit.knockback;
    target.knock.z += d.z * hit.knockback;
  }
  for (const effect of hit.effects ?? []) {
    if (effect.type === 'pull') {
      pullToward(target, attacker.pos, effect.strength);
    } else if (applyStatus(target, world.time, effect)) {
      world.events.push({ type: 'status', targetId: target.id, status: effect.type });
    }
  }
  return dealt;
}
