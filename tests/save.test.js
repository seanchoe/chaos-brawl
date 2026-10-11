import { describe, it, expect } from 'vitest';
import {
  SAVE_KEY, SAVE_VERSION, STARTING_COINS, DEFAULT_TRAINING_OPTIONS,
  BOT_BEHAVIORS, createSave, createMemoryStorage, getStorage, loadSave, writeSave, resetSave,
} from '../src/logic/save.js';

describe('save', () => {
  it('creates a fresh save', () => {
    const s = createSave();
    expect(s.version).toBe(SAVE_VERSION);
    expect(Object.keys(s.characters)).toEqual(['sparkle', 'bubbles', 'pancake', 'rex']);
    expect(s.characters.sparkle).toEqual({ level: 1, xp: 0 });
    expect(s.coins).toBe(STARTING_COINS);
    expect(s.ownedPets).toEqual([]);
    expect(s.lastPets).toEqual({ p1: null, p2: null });
    expect(s.settings).toEqual({ muted: false });
    expect(s.training).toEqual(DEFAULT_TRAINING_OPTIONS);
  });

  it('loads a fresh save from empty storage', () => {
    expect(loadSave(createMemoryStorage())).toEqual(createSave());
  });

  it('round-trips through storage', () => {
    const storage = createMemoryStorage();
    const s = { ...createSave(), coins: 123, ownedPets: ['biscuit'] };
    s.characters.rex = { level: 42, xp: 7 };
    expect(writeSave(storage, s)).toBe(true);
    expect(loadSave(storage)).toEqual(s);
  });

  it('falls back to a fresh save on corrupt JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadSave(storage)).toEqual(createSave());
  });

  it('falls back to a fresh save on a different version', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createSave(), version: 999 }));
    expect(loadSave(storage)).toEqual(createSave());
  });

  it('repairs bad values', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      characters: { sparkle: { level: 500, xp: -3 }, bubbles: { level: 'x' } },
      coins: -10,
      ownedPets: ['biscuit', 'not-a-pet', 7],
    }));
    const s = loadSave(storage);
    expect(s.characters.sparkle).toEqual({ level: 100, xp: 0 });
    expect(s.characters.bubbles).toEqual({ level: 1, xp: 0 });
    expect(s.characters.rex).toEqual({ level: 1, xp: 0 });
    expect(s.coins).toBe(STARTING_COINS);
    expect(s.ownedPets).toEqual(['biscuit']);
    expect(s.training).toEqual(DEFAULT_TRAINING_OPTIONS);
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
    expect(loadSave(broken)).toEqual(createSave());
    expect(writeSave(broken, createSave())).toBe(false);
  });

  it('uses memory storage when localStorage is blocked', () => {
    const win = { get localStorage() { throw new Error('blocked'); } };
    const { storage, persistent } = getStorage(win);
    expect(persistent).toBe(false);
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
  });

  it('uses localStorage when it works', () => {
    const win = { localStorage: createMemoryStorage() };
    expect(getStorage(win)).toEqual({ storage: win.localStorage, persistent: true });
  });

  it('resets progress', () => {
    const storage = createMemoryStorage();
    writeSave(storage, { ...createSave(), coins: 999 });
    expect(resetSave(storage)).toEqual(createSave());
    expect(loadSave(storage).coins).toBe(STARTING_COINS);
  });
});

describe('save validation', () => {
  const load = (extra) => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...extra }));
    return loadSave(storage);
  };

  it('exports the bot behaviors', () => {
    expect(BOT_BEHAVIORS).toEqual(['still', 'walk', 'dodge', 'block']);
  });

  it('de-duplicates owned pets', () => {
    expect(load({ ownedPets: ['biscuit', 'biscuit'] }).ownedPets).toEqual(['biscuit']);
  });

  it('keeps lastPets only when null or owned', () => {
    const s = load({ ownedPets: ['biscuit'], lastPets: { p1: 'biscuit', p2: 'unowned' } });
    expect(s.lastPets).toEqual({ p1: 'biscuit', p2: null });
    expect(load({ ownedPets: ['biscuit'], lastPets: { p1: null, p2: 7 } }).lastPets).toEqual({ p1: null, p2: null });
    expect(load({ ownedPets: ['biscuit'], lastPets: 'oops' }).lastPets).toEqual({ p1: null, p2: null });
    expect(load({ lastPets: null }).lastPets).toEqual({ p1: null, p2: null });
  });

  it('only accepts a boolean muted setting', () => {
    expect(load({ settings: { muted: true } }).settings).toEqual({ muted: true });
    expect(load({ settings: { muted: 'yes', extra: 1 } }).settings).toEqual({ muted: false });
    expect(load({ settings: 'x' }).settings).toEqual({ muted: false });
  });

  it('validates training options', () => {
    const ok = load({ training: { botBehavior: 'dodge', noCooldowns: true, infiniteEnergy: true, showHitAreas: true, junk: 1 } });
    expect(ok.training).toEqual({ botBehavior: 'dodge', noCooldowns: true, infiniteEnergy: true, showHitAreas: true });
    const bad = load({ training: { botBehavior: 'fly', noCooldowns: 1, infiniteEnergy: 'true', showHitAreas: null } });
    expect(bad.training).toEqual(DEFAULT_TRAINING_OPTIONS);
    expect(load({ training: 5 }).training).toEqual(DEFAULT_TRAINING_OPTIONS);
  });
});
