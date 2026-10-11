import { CHARACTER_IDS } from '../data/characters.js';
import { PET_IDS } from '../data/pets.js';
import { MAX_LEVEL } from './progression.js';

export const SAVE_KEY = 'chaos-brawl-save';
export const SAVE_VERSION = 1;
export const STARTING_COINS = 50;
export const DEFAULT_TRAINING_OPTIONS = {
  botBehavior: 'still',
  noCooldowns: false,
  infiniteEnergy: false,
  showHitAreas: false,
};

export function createSave() {
  const characters = {};
  for (const id of CHARACTER_IDS) characters[id] = { level: 1, xp: 0 };
  return {
    version: SAVE_VERSION,
    characters,
    coins: STARTING_COINS,
    ownedPets: [],
    lastPets: { p1: null, p2: null },
    settings: { muted: false },
    training: { ...DEFAULT_TRAINING_OPTIONS },
  };
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

export function getStorage(win = globalThis) {
  try {
    const storage = win.localStorage;
    const key = '__chaos_brawl_test__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return { storage, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}

export function loadSave(storage) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return createSave();
  }
  if (!raw) return createSave();
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return createSave();
    return normalize(data);
  } catch {
    return createSave();
  }
}

function normalize(data) {
  const fresh = createSave();
  const characters = {};
  for (const id of CHARACTER_IDS) {
    const c = data.characters?.[id];
    const level = Number.isInteger(c?.level) ? Math.min(MAX_LEVEL, Math.max(1, c.level)) : 1;
    const xp = level < MAX_LEVEL && Number.isFinite(c?.xp) && c.xp >= 0 ? c.xp : 0;
    characters[id] = { level, xp };
  }
  return {
    version: SAVE_VERSION,
    characters,
    coins: Number.isFinite(data.coins) && data.coins >= 0 ? Math.floor(data.coins) : fresh.coins,
    ownedPets: Array.isArray(data.ownedPets) ? data.ownedPets.filter((id) => PET_IDS.includes(id)) : [],
    lastPets: { ...fresh.lastPets, ...data.lastPets },
    settings: { ...fresh.settings, ...data.settings },
    training: { ...fresh.training, ...data.training },
  };
}

export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage) {
  const save = createSave();
  writeSave(storage, save);
  return save;
}
