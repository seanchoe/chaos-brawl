import { ROUND_TIME } from './constants.js';
import { getCharacter } from '../data/characters.js';
import { getWeapon } from '../data/weapons.js';
import { getPet } from '../data/pets.js';
import { createFighter, resetFighter } from './fighter.js';
import { createPet, resetPet } from './pets.js';
import { createWorld, faceEachOther } from './world.js';
import { stepWorld } from './simulation.js';

export const INTRO_TIME = 2;
export const ROUND_OVER_TIME = 2.5;
export const WINS_NEEDED = 2;
export const MAX_ROUNDS = 9;
export const SPAWNS = { p1: { x: -5, y: 0, z: 0 }, p2: { x: 5, y: 0, z: 0 } };

const PLAYER_IDS = ['p1', 'p2'];

// mode: 'cpu' | '2p'. p1/p2: { characterId, level, tier, petId }
export function createMatch({ mode, p1, p2 }) {
  const config = { p1, p2 };
  const fighters = PLAYER_IDS.map((id) => createFighter({
    id,
    character: getCharacter(config[id].characterId),
    level: config[id].level,
    weapon: getWeapon(config[id].characterId, config[id].tier),
    pos: SPAWNS[id],
  }));
  const world = createWorld(fighters);
  PLAYER_IDS.forEach((id, i) => {
    if (config[id].petId) world.pets.push(createPet(getPet(config[id].petId), fighters[i], 0));
  });
  return {
    mode,
    config,
    world,
    round: 1,
    wins: { p1: 0, p2: 0 },
    state: 'intro',
    stateTime: INTRO_TIME,
    timeLeft: ROUND_TIME,
    roundWinner: null,
    winner: null,
  };
}

export function stepMatch(match, dt) {
  switch (match.state) {
    case 'intro':
      match.stateTime -= dt;
      if (match.stateTime <= 0) {
        match.state = 'fighting';
        match.world.events.push({ type: 'fight', round: match.round });
      }
      break;
    case 'fighting': {
      stepWorld(match.world, dt);
      match.timeLeft = Math.max(0, match.timeLeft - dt);
      const [a, b] = match.world.fighters;
      if (a.ko || b.ko || match.timeLeft <= 0) endRound(match);
      break;
    }
    case 'roundOver':
      match.stateTime -= dt;
      if (match.stateTime <= 0) {
        if (match.winner) {
          match.state = 'matchOver';
          match.world.events.push({ type: 'matchOver', winner: match.winner });
        } else {
          startNextRound(match);
        }
      }
      break;
    default:
      break;
  }
}

function endRound(match) {
  const [a, b] = match.world.fighters;
  let w;
  if (a.ko && b.ko) w = 'tie';
  else if (b.ko) w = 'p1';
  else if (a.ko) w = 'p2';
  else if (a.energy > b.energy) w = 'p1';
  else if (b.energy > a.energy) w = 'p2';
  else w = 'tie';

  if (w === 'tie') {
    match.wins.p1 += 1;
    match.wins.p2 += 1;
  } else {
    match.wins[w] += 1;
  }
  match.roundWinner = w;
  match.state = 'roundOver';
  match.stateTime = ROUND_OVER_TIME;

  const { p1, p2 } = match.wins;
  if ((p1 >= WINS_NEEDED || p2 >= WINS_NEEDED) && p1 !== p2) match.winner = p1 > p2 ? 'p1' : 'p2';
  else if (match.round >= MAX_ROUNDS) match.winner = 'draw';

  match.world.events.push({ type: 'roundOver', round: match.round, winner: w, wins: { ...match.wins } });
}

function startNextRound(match) {
  const { world } = match;
  match.round += 1;
  match.timeLeft = ROUND_TIME;
  match.roundWinner = null;
  world.fighters.forEach((f) => resetFighter(f, SPAWNS[f.id]));
  faceEachOther(world);
  world.projectiles = [];
  world.zones = [];
  world.timers = [];
  for (const pet of world.pets) {
    resetPet(pet, world.fighters.find((f) => f.id === pet.ownerId), world.time);
  }
  match.state = 'intro';
  match.stateTime = INTRO_TIME;
}

export function matchResults(match) {
  const ids = match.mode === 'cpu' ? ['p1'] : PLAYER_IDS;
  return ids.map((id) => ({
    playerId: id,
    characterId: match.config[id].characterId,
    won: match.winner === id,
    roundsWon: match.wins[id],
  }));
}
