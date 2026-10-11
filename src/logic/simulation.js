import { FIGHTER_RADIUS } from './constants.js';
import { dist2D, dirTo } from './vec.js';
import { tryUseAbility } from './abilities.js';
import { updateFighter } from './movement.js';
import { updateProjectiles, updateZones } from './projectiles.js';
import { runTimers } from './world.js';
import { updatePet } from './pets.js';

export function stepWorld(world, dt) {
  world.time += dt;
  runTimers(world);
  for (const f of world.fighters) updateFighter(world, f, dt);
  separateFighters(world);
  for (const f of world.fighters) {
    if (f.input.attack) tryUseAbility(world, f, 'basic');
    if (f.input.special) tryUseAbility(world, f, 'special');
  }
  for (const pet of world.pets) updatePet(world, pet, dt);
  updateProjectiles(world, dt);
  updateZones(world);
}

function separateFighters(world) {
  const [a, b] = world.fighters;
  if (!a || !b) return;
  const d = dist2D(a.pos, b.pos);
  const min = FIGHTER_RADIUS * 2;
  if (d >= min) return;
  const dir = d > 1e-6 ? dirTo(a.pos, b.pos) : { x: 1, z: 0 };
  const push = (min - d) / 2;
  a.pos.x -= dir.x * push;
  a.pos.z -= dir.z * push;
  b.pos.x += dir.x * push;
  b.pos.z += dir.z * push;
}
