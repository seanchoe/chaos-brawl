import { ARENA_RADIUS, FIGHTER_RADIUS, FIGHTER_CENTER_Y } from './constants.js';
import { dist2D, angleTo } from './vec.js';
import { hitTarget } from './combat.js';
import { applyStatus } from './fighter.js';

export const ZONE_TICK = 0.5;

export function updateProjectiles(world, dt) {
  for (const p of world.projectiles) {
    const owner = world.fighters.find((f) => f.id === p.ownerId);
    const target = world.fighters.find((f) => f.id !== p.ownerId);
    const age = world.time - p.bornAt;

    if (p.homing && target && !target.ko) steer(p, target, dt);
    if (p.returning && !p.returned && age >= p.life / 2) {
      p.returned = true;
      p.vel.x = -p.vel.x;
      p.vel.z = -p.vel.z;
      p.hitIds = [];
    }

    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;

    const canHit = owner && target && !target.ko && !p.hitIds.includes(target.id);
    if (canHit
      && dist2D(p.pos, target.pos) <= p.size + FIGHTER_RADIUS
      && Math.abs(p.pos.y - (target.pos.y + FIGHTER_CENTER_Y)) <= p.size + FIGHTER_CENTER_Y) {
      hitTarget(world, owner, target, p, p.pos, p.scale);
      p.hitIds.push(target.id);
      if (!p.pierce) p.dead = true;
    }

    if (age >= p.life || Math.hypot(p.pos.x, p.pos.z) > ARENA_RADIUS + 1) p.dead = true;
  }
  world.projectiles = world.projectiles.filter((p) => !p.dead);
}

function steer(p, target, dt) {
  const current = Math.atan2(p.vel.z, p.vel.x);
  let diff = angleTo(p.pos, target.pos) - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const maxTurn = p.homing * dt;
  const angle = current + Math.max(-maxTurn, Math.min(maxTurn, diff));
  p.vel.x = Math.cos(angle) * p.speed;
  p.vel.z = Math.sin(angle) * p.speed;
}

export function updateZones(world) {
  for (const z of world.zones) {
    if (world.time >= z.until) {
      z.dead = true;
      continue;
    }
    if (world.time < z.nextTickAt) continue;
    z.nextTickAt = world.time + ZONE_TICK;
    const owner = world.fighters.find((f) => f.id === z.ownerId);
    const target = world.fighters.find((f) => f.id !== z.ownerId);
    if (!owner || !target || target.ko) continue;
    if (dist2D(z.pos, target.pos) > z.radius + FIGHTER_RADIUS || target.pos.y > 1) continue;
    if (z.slow) applyStatus(target, world.time, { type: 'slow', duration: ZONE_TICK + 0.1, amount: z.slow });
    if (z.dps) hitTarget(world, owner, target, { damage: z.dps * ZONE_TICK, popup: 'GOOEY!' }, z.pos, z.scale);
  }
  world.zones = world.zones.filter((z) => !z.dead);
}
