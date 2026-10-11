import { ARENA_RADIUS, MAX_ENERGY } from './constants.js';
import { dist2D, forward, angleTo, clampToArena } from './vec.js';
import { runSteps } from './abilities.js';
import { opponentOf } from './world.js';

export const PET_FIRST_DELAY = 2;
const NO_COOLDOWN_INTERVAL = 0.5;
const FOLLOW_BEHIND = 1.0;
const FOLLOW_SIDE = 1.2;

export function createPet(def, owner, now) {
  return {
    def,
    ownerId: owner.id,
    pos: { x: owner.pos.x - FOLLOW_BEHIND, y: 0, z: owner.pos.z + FOLLOW_SIDE },
    facing: owner.facing,
    nextAt: now + PET_FIRST_DELAY,
    strikeAnim: null,
  };
}

export function resetPet(pet, owner, now) {
  pet.pos = { x: owner.pos.x - FOLLOW_BEHIND, y: 0, z: owner.pos.z + FOLLOW_SIDE };
  pet.nextAt = now + PET_FIRST_DELAY;
  pet.strikeAnim = null;
}

export function updatePet(world, pet, dt) {
  const owner = world.fighters.find((f) => f.id === pet.ownerId);
  if (!owner) return;
  const opp = opponentOf(world, owner);

  const fwd = forward(owner.facing);
  const side = { x: -fwd.z, z: fwd.x };
  const tx = owner.pos.x - fwd.x * FOLLOW_BEHIND + side.x * FOLLOW_SIDE;
  const tz = owner.pos.z - fwd.z * FOLLOW_BEHIND + side.z * FOLLOW_SIDE;
  const k = 1 - Math.exp(-6 * dt);
  pet.pos.x += (tx - pet.pos.x) * k;
  pet.pos.z += (tz - pet.pos.z) * k;
  clampToArena(pet.pos, ARENA_RADIUS - 0.4);
  if (opp) pet.facing = angleTo(pet.pos, opp.pos);
  if (pet.strikeAnim && world.time >= pet.strikeAnim.until) pet.strikeAnim = null;

  if (owner.ko || !opp || opp.ko) return;
  if (world.time < pet.nextAt) return;
  if (!isReady(pet, owner, opp)) return;

  pet.nextAt = world.time + (owner.noCooldowns ? NO_COOLDOWN_INTERVAL : pet.def.interval);
  world.events.push({ type: 'petMove', ownerId: owner.id, petId: pet.def.id, name: pet.def.move.name });
  runSteps(world, owner, pet.def.move.steps, pet, 1);
}

function isReady(pet, owner, opp) {
  switch (pet.def.trigger) {
    case 'inRange': return dist2D(pet.pos, opp.pos) <= pet.def.range;
    case 'hurt': return owner.energy < MAX_ENERGY;
    case 'noGuard': return owner.guardHits === 0;
    default: return true;
  }
}
