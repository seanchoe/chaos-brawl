import { ARENA_RADIUS, FIGHTER_RADIUS, GRAVITY, JUMP_SPEED, BASE_MOVE_SPEED, KNOCK_DECAY } from './constants.js';
import { dist2D, angleTo, clampToArena } from './vec.js';
import { isDisabled, isFrozen, slowFactor } from './fighter.js';
import { hitTarget } from './combat.js';
import { runSteps, runStep } from './abilities.js';
import { opponentOf } from './world.js';

export const LEAP_HEIGHT = 3;

export function updateFighter(world, f, dt) {
  const now = world.time;
  const opp = opponentOf(world, f);

  if (f.shield && now >= f.shield.until) {
    const { onEnd } = f.shield;
    f.shield = null;
    if (onEnd && !f.ko) runSteps(world, f, onEnd, f, f.damageMult);
  }

  if (f.leap && f.ko) {
    f.leap = null;
    f.onGround = false;
  }

  if (f.leap) {
    updateLeap(world, f);
    return;
  }

  if (f.dash && !f.ko) {
    updateDash(world, f, opp, dt);
  } else if (!f.ko && !isDisabled(f, now)) {
    const { moveX, moveZ, jump } = f.input;
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      const speed = BASE_MOVE_SPEED * f.speedMult * slowFactor(f, now);
      f.pos.x += (moveX / len) * speed * dt;
      f.pos.z += (moveZ / len) * speed * dt;
    }
    if (jump && f.onGround) {
      f.velY = JUMP_SPEED;
      f.onGround = false;
      world.events.push({ type: 'jump', fighterId: f.id });
    }
  }

  if (!f.onGround) {
    f.velY -= GRAVITY * dt;
    f.pos.y += f.velY * dt;
    if (f.pos.y <= 0) {
      f.pos.y = 0;
      f.velY = 0;
      f.onGround = true;
    }
  }

  f.pos.x += f.knock.x * dt;
  f.pos.z += f.knock.z * dt;
  const decay = Math.exp(-KNOCK_DECAY * dt);
  f.knock.x *= decay;
  f.knock.z *= decay;

  clampToArena(f.pos, ARENA_RADIUS - FIGHTER_RADIUS);
  if (opp && !f.ko && !isFrozen(f, now)) f.facing = angleTo(f.pos, opp.pos);
}

function updateLeap(world, f) {
  const leap = f.leap;
  const t = Math.min(1, (world.time - leap.start) / leap.duration);
  f.pos.x = leap.from.x + (leap.to.x - leap.from.x) * t;
  f.pos.z = leap.from.z + (leap.to.z - leap.from.z) * t;
  f.pos.y = 4 * LEAP_HEIGHT * t * (1 - t);
  if (t >= 1) {
    f.pos.y = 0;
    f.velY = 0;
    f.onGround = true;
    f.leap = null;
    runStep(world, f, { ...leap.step, type: 'burst', at: 'self' }, f, f.damageMult);
  }
}

function updateDash(world, f, opp, dt) {
  const dash = f.dash;
  f.pos.x += dash.dir.x * dash.speed * dt;
  f.pos.z += dash.dir.z * dash.speed * dt;
  clampToArena(f.pos, ARENA_RADIUS - FIGHTER_RADIUS);
  const touching = opp && !opp.ko && dist2D(f.pos, opp.pos) <= FIGHTER_RADIUS * 2 + 0.4 && Math.abs(f.pos.y - opp.pos.y) < 1.5;
  if (dash.hit && touching) {
    hitTarget(world, f, opp, dash.hit, f.pos, f.damageMult);
    f.dash = null;
    return;
  }
  if (world.time >= dash.until) f.dash = null;
}
