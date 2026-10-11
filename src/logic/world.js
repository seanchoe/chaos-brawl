import { angleTo } from './vec.js';

export function createWorld(fighters) {
  const world = {
    time: 0,
    fighters,
    pets: [],
    projectiles: [],
    zones: [],
    timers: [],
    events: [],
    lastId: 0,
  };
  faceEachOther(world);
  return world;
}

export function faceEachOther(world) {
  const [a, b] = world.fighters;
  if (!a || !b) return;
  a.facing = angleTo(a.pos, b.pos);
  b.facing = angleTo(b.pos, a.pos);
}

export function nextId(world) {
  world.lastId += 1;
  return world.lastId;
}

export function getFighter(world, id) {
  return world.fighters.find((f) => f.id === id) ?? null;
}

export function opponentOf(world, f) {
  return world.fighters.find((o) => o.id !== f.id) ?? null;
}

export function schedule(world, delay, fn) {
  world.timers.push({ at: world.time + delay, fn });
}

export function runTimers(world) {
  const due = world.timers.filter((t) => t.at <= world.time);
  if (due.length === 0) return;
  world.timers = world.timers.filter((t) => t.at > world.time);
  for (const t of due) t.fn();
}

export function drainEvents(world) {
  const events = world.events;
  world.events = [];
  return events;
}
