import { ARENA_RADIUS, FIGHTER_RADIUS } from './constants.js';
import { dist2D, dirTo, forward, angleTo, angleDiff, clampToArena } from './vec.js';
import { isDisabled } from './fighter.js';
import { hitTarget, heal, pullToward } from './combat.js';
import { opponentOf, schedule, nextId } from './world.js';

const NO_COOLDOWN_GAP = 0.1;

export function tryUseAbility(world, f, slot) {
  const def = f.weapon?.[slot];
  if (!def || f.ko || f.dash || f.leap || isDisabled(f, world.time)) return false;
  if (world.time < f.cooldowns[slot]) return false;
  f.cooldowns[slot] = world.time + (f.noCooldowns ? NO_COOLDOWN_GAP : def.cooldown);
  world.events.push({ type: 'ability', fighterId: f.id, slot, name: def.name });
  runSteps(world, f, def.steps, f, f.damageMult);
  return true;
}

// `source` is where the move comes from (the fighter, or a pet). `caster` owns it.
export function runSteps(world, caster, steps, source, scale) {
  for (const step of steps) {
    if (step.delay) {
      const point = step.at === 'target' ? targetPoint(world, caster) : null;
      if (point) {
        world.events.push({ type: 'shape', shape: 'warning', pos: point, radius: step.radius, duration: step.delay });
      }
      schedule(world, step.delay, () => {
        if (!caster.ko && !isDisabled(caster, world.time)) runStep(world, caster, step, source, scale, point);
      });
    } else {
      runStep(world, caster, step, source, scale, null);
    }
  }
}

function targetPoint(world, caster) {
  const opp = opponentOf(world, caster);
  return opp ? { x: opp.pos.x, y: 0, z: opp.pos.z } : null;
}

export function runStep(world, caster, step, source, scale, point = null) {
  const opp = opponentOf(world, caster);
  switch (step.type) {
    case 'melee': return doMelee(world, caster, opp, step, source, scale);
    case 'projectile': return spawnProjectiles(world, caster, opp, step, source, scale);
    case 'dash': return startDash(world, caster, opp, step);
    case 'burst': return doBurst(world, caster, opp, step, source, scale, point);
    case 'shield':
      if (caster.shield?.onEnd) {
        const { onEnd } = caster.shield;
        caster.shield = null;
        runSteps(world, caster, onEnd, caster, caster.damageMult);
      }
      caster.shield = { until: world.time + step.duration, reduction: step.reduction, onEnd: step.onEnd ?? null };
      world.events.push({ type: 'shield', fighterId: caster.id, duration: step.duration, reduction: step.reduction });
      return;
    case 'heal': return heal(world, caster, step.amount);
    case 'pull':
      if (opp && !opp.ko && dist2D(source.pos, opp.pos) <= step.range) pullToward(opp, source.pos, step.strength);
      return;
    case 'zone': return placeZone(world, caster, opp, step, source, scale);
    case 'leap':
      if (opp) {
        const to = clampToArena({ x: opp.pos.x, y: 0, z: opp.pos.z }, ARENA_RADIUS - FIGHTER_RADIUS);
        caster.leap = { from: { ...caster.pos }, to, start: world.time, duration: step.duration, step };
      }
      return;
    case 'guard':
      caster.guardHits = Math.max(caster.guardHits, step.hits);
      world.events.push({ type: 'guard', fighterId: caster.id });
      return;
    case 'strike':
      if (opp && !opp.ko && dist2D(source.pos, opp.pos) <= step.range && Math.abs(opp.pos.y - source.pos.y) < 1.5) {
        if ('strikeAnim' in source) source.strikeAnim = { to: { ...opp.pos }, until: world.time + 0.3 };
        hitTarget(world, caster, opp, step, source.pos, scale);
      }
      return;
    default:
      throw new Error(`Unknown ability step: ${step.type}`);
  }
}

function doMelee(world, caster, opp, step, source, scale) {
  world.events.push({ type: 'shape', shape: 'arc', pos: { ...source.pos }, facing: source.facing, range: step.range, arc: step.arc, duration: 0.15 });
  if (!opp || opp.ko) return;
  const d = dist2D(source.pos, opp.pos);
  if (d > step.range + FIGHTER_RADIUS) return;
  if (Math.abs(opp.pos.y - source.pos.y) >= 1.5) return;
  const inArc = d < FIGHTER_RADIUS * 2 || angleDiff(source.facing, angleTo(source.pos, opp.pos)) <= (step.arc / 2) * (Math.PI / 180);
  if (inArc) hitTarget(world, caster, opp, step, source.pos, scale);
}

function spawnProjectiles(world, caster, opp, step, source, scale) {
  const base = opp ? angleTo(source.pos, opp.pos) : source.facing;
  const count = step.count ?? 1;
  const spread = ((step.spread ?? 0) * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    let offset = 0;
    if (count > 1) offset = spread >= 2 * Math.PI ? (i * spread) / count : -spread / 2 + (i * spread) / (count - 1);
    const d = forward(base + offset);
    world.projectiles.push({
      id: nextId(world),
      ownerId: caster.id,
      style: step.style ?? 'ball',
      pos: { x: source.pos.x + d.x * 0.8, y: source.pos.y + 1, z: source.pos.z + d.z * 0.8 },
      vel: { x: d.x * step.speed, z: d.z * step.speed },
      speed: step.speed,
      size: step.size,
      damage: step.damage,
      knockback: step.knockback ?? 1,
      effects: step.effects ?? [],
      popup: step.popup,
      pierce: !!step.pierce,
      homing: step.homing ?? 0,
      returning: !!step.returning,
      returned: false,
      bornAt: world.time,
      life: step.life,
      hitIds: [],
      scale,
    });
  }
}

function startDash(world, f, opp, step) {
  let dir;
  if (step.direction === 'escape') {
    const len = Math.hypot(f.input.moveX, f.input.moveZ);
    if (len > 0) dir = { x: f.input.moveX / len, z: f.input.moveZ / len };
    else if (opp) dir = dirTo(opp.pos, f.pos);
    else dir = forward(f.facing + Math.PI);
  } else {
    dir = opp ? dirTo(f.pos, opp.pos) : forward(f.facing);
  }
  if (!step.duration) {
    f.pos.x += dir.x * step.distance;
    f.pos.z += dir.z * step.distance;
    clampToArena(f.pos, ARENA_RADIUS - FIGHTER_RADIUS);
    world.events.push({ type: 'blink', fighterId: f.id });
    return;
  }
  f.dash = {
    dir,
    speed: step.distance / step.duration,
    until: world.time + step.duration,
    hit: step.damage ? step : null,
  };
}

function doBurst(world, caster, opp, step, source, scale, point) {
  let center = point;
  if (!center) center = step.at === 'target' && opp ? { x: opp.pos.x, y: 0, z: opp.pos.z } : { x: source.pos.x, y: 0, z: source.pos.z };
  world.events.push({ type: 'shape', shape: 'circle', pos: center, radius: step.radius, duration: 0.2, style: step.style });
  if (!opp || opp.ko) return;
  if (dist2D(center, opp.pos) <= step.radius + FIGHTER_RADIUS && opp.pos.y < 2.5) {
    hitTarget(world, caster, opp, step, center, scale);
  }
}

function placeZone(world, caster, opp, step, source, scale) {
  const at = step.at === 'target' && opp ? opp.pos : source.pos;
  world.zones.push({
    id: nextId(world),
    ownerId: caster.id,
    pos: { x: at.x, y: 0, z: at.z },
    radius: step.radius,
    until: world.time + step.duration,
    slow: step.slow ?? 0,
    dps: step.dps ?? 0,
    nextTickAt: world.time,
    style: step.style ?? 'zone',
    scale,
  });
}
