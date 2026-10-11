# Chaos Brawl — Plan 1: Core Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete headless game engine for Chaos Brawl — data, rules, combat, abilities, pets, matches, AI, and Training Ground logic — fully unit-tested with no rendering.

**Architecture:** Everything lives under `src/logic/` and `src/data/` as plain ES modules with no Three.js or DOM imports. A `world` object holds all simulation state (fighters, pets, projectiles, zones, timers, events). `stepWorld(world, dt)` advances it at a fixed 60 Hz. Abilities are data: each is a list of *steps* using 11 primitive types, executed by `abilities.js`. Later plans render the world and read `world.events` for visuals and sounds.

**Tech Stack:** JavaScript (ES modules), Vite (dev server/build), Vitest (tests), Node 25.

**Spec:** `docs/superpowers/specs/2026-10-11-chaos-brawl-design.md`
**Roadmap:** `docs/superpowers/plans/2026-10-11-chaos-brawl-roadmap.md`

---

## Conventions used everywhere

- **Coordinates:** ground plane is x/z, y is up. Arena is a circle of radius `ARENA_RADIUS` (12) centered on the origin.
- **Facing:** an angle in radians; the forward vector is `{ x: cos(facing), z: sin(facing) }` (see `forward()` in `vec.js`). `angleTo(a, b)` gives the facing from `a` toward `b`.
- **Time:** `world.time` is in seconds. Cooldowns store the *time when ready* (`f.cooldowns.basic`). Status effects store *time until* (`f.status.freezeUntil`).
- **Ability step:** `{ type, ...params, delay?, effects?, popup?, style? }`. `effects` is a list of `{ type: 'slow'|'freeze'|'stun'|'pull', duration?, amount?, strength? }` applied on hit.
- **Damage scale:** weapon abilities use `fighter.damageMult` (character damage × level multiplier). Pet moves use scale `1`.
- **Events:** logic pushes plain objects onto `world.events` (`hit`, `blocked`, `heal`, `ko`, `ability`, `shape`, `status`, `jump`, `blink`, `shield`, `guard`, `petMove`, `fight`, `roundOver`, `matchOver`, `botRefill`). Renderers call `drainEvents(world)`.

## File structure

```
package.json, vite.config.js, index.html, .gitignore
src/main.js                    placeholder page (replaced in Plan 2)
src/data/characters.js         4 characters
src/data/weapons.js            44 weapons (11 tiers × 4) + basic attacks
src/data/pets.js               8 pets
src/logic/constants.js         tuning constants
src/logic/vec.js               2D vector/angle helpers
src/logic/random.js            seeded RNG for tests/AI
src/logic/progression.js       XP curve, levels, tiers, level scaling, match rewards
src/logic/save.js              localStorage save/load/normalize
src/logic/shop.js              buy/equip pets
src/logic/fighter.js           fighter state + status effects
src/logic/combat.js            damage, heal, hit resolution, knockback, pull
src/logic/world.js             world container, timers, events, opponent lookup
src/logic/abilities.js         ability use + 11 step primitives
src/logic/movement.js          per-fighter movement, jump, dash, leap, shield expiry
src/logic/projectiles.js       projectile + zone updates
src/logic/pets.js              pet companions (follow + timed helper move)
src/logic/simulation.js        stepWorld: orchestrates one tick
src/logic/match.js             rounds, timer, win rules, results
src/logic/rewards.js           apply XP/coins to the save
src/logic/ai.js                computer opponent + opponent picker
src/logic/training.js          Training Ground session
tests/*.test.js                Vitest tests (one per module)
tests/helpers.js               shared test fixtures
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.js`, `tests/smoke.test.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chaos-brawl",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install --save-dev vite vitest`
Expected: `node_modules/` created, `package.json` gains `devDependencies` for `vite` and `vitest`, `package-lock.json` created.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chaos Brawl</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/main.js`**

```js
document.getElementById('app').textContent = 'Chaos Brawl is warming up!';
```

- [ ] **Step 7: Write a smoke test `tests/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('test setup', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 9: Check the build**

Run: `npx vite build`
Expected: builds to `dist/` with no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html .gitignore src/main.js tests/smoke.test.js
git commit -m "chore: scaffold Vite + Vitest project"
```

---

### Task 2: Constants, vector helpers, seeded random

**Files:**
- Create: `src/logic/constants.js`, `src/logic/vec.js`, `src/logic/random.js`
- Test: `tests/vec.test.js`

- [ ] **Step 1: Write the failing test `tests/vec.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { dist2D, dirTo, forward, angleTo, angleDiff, clampToArena } from '../src/logic/vec.js';
import { mulberry32 } from '../src/logic/random.js';

describe('vec', () => {
  it('measures ground distance ignoring y', () => {
    expect(dist2D({ x: 0, y: 5, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(5);
  });

  it('gives a unit direction, or zero for the same point', () => {
    const d = dirTo({ x: 0, z: 0 }, { x: 0, z: 2 });
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(1);
    const same = dirTo({ x: 1, z: 1 }, { x: 1, z: 1 });
    expect(same).toEqual({ x: 0, z: 0 });
  });

  it('forward and angleTo agree', () => {
    const a = angleTo({ x: 0, z: 0 }, { x: 0, z: 1 });
    const f = forward(a);
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(1);
  });

  it('angleDiff wraps around', () => {
    expect(angleDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  it('clamps a point to the arena', () => {
    const p = { x: 20, y: 0, z: 0 };
    clampToArena(p, 10);
    expect(p.x).toBeCloseTo(10);
    const inside = { x: 1, y: 0, z: 1 };
    clampToArena(inside, 10);
    expect(inside).toEqual({ x: 1, y: 0, z: 1 });
  });
});

describe('random', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vec.test.js`
Expected: FAIL — cannot resolve `../src/logic/vec.js`.

- [ ] **Step 3: Create `src/logic/constants.js`**

```js
export const DT = 1 / 60;
export const ARENA_RADIUS = 12;
export const FIGHTER_RADIUS = 0.6;
export const FIGHTER_CENTER_Y = 0.9;
export const MAX_ENERGY = 100;
export const ROUND_TIME = 60;
export const GRAVITY = 30;
export const JUMP_SPEED = 11;
export const BASE_MOVE_SPEED = 6;
export const KNOCK_DECAY = 4;
export const MAX_CC_DURATION = 1.2;
export const CC_IMMUNITY = 2;
export const MAX_SLOW = 0.5;
```

- [ ] **Step 4: Create `src/logic/vec.js`**

```js
export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function dirTo(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len === 0) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

export function forward(angle) {
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

export function angleTo(a, b) {
  return Math.atan2(b.z - a.z, b.x - a.x);
}

export function angleDiff(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

export function clampToArena(pos, radius) {
  const r = Math.hypot(pos.x, pos.z);
  if (r > radius) {
    pos.x *= radius / r;
    pos.z *= radius / r;
  }
  return pos;
}
```

- [ ] **Step 5: Create `src/logic/random.js`**

```js
// Small seeded RNG so AI tests and headless matches are repeatable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/vec.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/logic/constants.js src/logic/vec.js src/logic/random.js tests/vec.test.js
git commit -m "feat: add constants, vector helpers, seeded random"
```

---

### Task 3: Progression (XP, levels, tiers, rewards)

**Files:**
- Create: `src/logic/progression.js`
- Test: `tests/progression.test.js`

- [ ] **Step 1: Write the failing test `tests/progression.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  MAX_LEVEL, xpToNext, unlockLevel, tierForLevel, isTierUnlocked, unlockedTiers,
  damageMultiplier, speedMultiplier, addXp, matchRewards,
} from '../src/logic/progression.js';

describe('progression', () => {
  it('uses the 40 + 2L XP curve', () => {
    expect(xpToNext(1)).toBe(42);
    expect(xpToNext(99)).toBe(238);
  });

  it('unlocks tiers at levels 1, 10, 20 ... 100', () => {
    expect(unlockLevel(1)).toBe(1);
    expect(unlockLevel(2)).toBe(10);
    expect(unlockLevel(11)).toBe(100);
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(9)).toBe(1);
    expect(tierForLevel(10)).toBe(2);
    expect(tierForLevel(99)).toBe(10);
    expect(tierForLevel(100)).toBe(11);
  });

  it('knows which tiers are unlocked', () => {
    expect(isTierUnlocked(25, 3)).toBe(true);
    expect(isTierUnlocked(25, 4)).toBe(false);
    expect(isTierUnlocked(25, 0)).toBe(false);
    expect(unlockedTiers(25)).toEqual([1, 2, 3]);
  });

  it('scales damage and speed with level', () => {
    expect(damageMultiplier(1)).toBe(1);
    expect(damageMultiplier(100)).toBeCloseTo(1.495);
    expect(speedMultiplier(1)).toBe(1);
    expect(speedMultiplier(100)).toBeCloseTo(1.099);
  });

  it('levels up once', () => {
    expect(addXp({ level: 1, xp: 0 }, 42)).toEqual({ level: 2, xp: 0, levelsGained: 1, newTiers: [] });
  });

  it('levels up several times with leftover XP', () => {
    const r = addXp({ level: 1, xp: 0 }, 96);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(10);
    expect(r.levelsGained).toBe(2);
  });

  it('reports newly unlocked tiers', () => {
    expect(addXp({ level: 9, xp: 0 }, xpToNext(9)).newTiers).toEqual([2]);
  });

  it('caps at level 100 with 0 XP', () => {
    const r = addXp({ level: 99, xp: 0 }, 1e6);
    expect(r).toEqual({ level: MAX_LEVEL, xp: 0, levelsGained: 1, newTiers: [11] });
    expect(addXp({ level: 100, xp: 0 }, 500)).toEqual({ level: 100, xp: 0, levelsGained: 0, newTiers: [] });
  });

  it('gives match rewards for wins and losses', () => {
    expect(matchRewards({ won: true, roundsWon: 2 })).toEqual({ xp: 160, coins: 40 });
    expect(matchRewards({ won: false, roundsWon: 1 })).toEqual({ xp: 80, coins: 20 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/progression.test.js`
Expected: FAIL — cannot resolve `../src/logic/progression.js`.

- [ ] **Step 3: Create `src/logic/progression.js`**

```js
export const MAX_LEVEL = 100;
export const TIER_COUNT = 11;

export function xpToNext(level) {
  return 40 + 2 * level;
}

export function unlockLevel(tier) {
  return tier === 1 ? 1 : 10 * (tier - 1);
}

export function tierForLevel(level) {
  return Math.min(TIER_COUNT, Math.floor(level / 10) + 1);
}

export function isTierUnlocked(level, tier) {
  return tier >= 1 && tier <= TIER_COUNT && level >= unlockLevel(tier);
}

export function unlockedTiers(level) {
  const tiers = [];
  for (let t = 1; t <= TIER_COUNT; t++) if (isTierUnlocked(level, t)) tiers.push(t);
  return tiers;
}

export function damageMultiplier(level) {
  return 1 + 0.005 * (level - 1);
}

export function speedMultiplier(level) {
  return 1 + 0.001 * (level - 1);
}

export function addXp(progress, amount) {
  let { level, xp } = progress;
  xp += amount;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = 0;
  }
  const newTiers = [];
  for (let t = tierForLevel(progress.level) + 1; t <= tierForLevel(level); t++) newTiers.push(t);
  return { level, xp, levelsGained: level - progress.level, newTiers };
}

export function matchRewards({ won, roundsWon }) {
  return {
    xp: (won ? 150 : 75) + 5 * roundsWon,
    coins: (won ? 30 : 15) + 5 * roundsWon,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/progression.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/progression.js tests/progression.test.js
git commit -m "feat: add XP curve, tiers, level scaling, match rewards"
```

---

### Task 4: Characters and weapons data

**Files:**
- Create: `src/data/characters.js`, `src/data/weapons.js`
- Test: `tests/data.test.js`

The validator test needs the list of step types. Define it in this task in `src/logic/stepTypes.js` so that the data test does not depend on `abilities.js` (Task 10).

- Create: `src/logic/stepTypes.js`, `tests/validate.js`

- [ ] **Step 1: Create the shared step validator `tests/validate.js`**

Both the weapons test and the pets test (Task 5) use this. It is a plain module, not a test file, so its checks don't run twice.

```js
import { expect } from 'vitest';
import { STEP_TYPES, STEP_REQUIRED, EFFECT_TYPES } from '../src/logic/stepTypes.js';

export function checkSteps(steps, where) {
  expect(Array.isArray(steps), `${where} steps`).toBe(true);
  expect(steps.length, `${where} has steps`).toBeGreaterThan(0);
  for (const step of steps) {
    expect(STEP_TYPES, `${where} step type ${step.type}`).toContain(step.type);
    for (const key of STEP_REQUIRED[step.type]) {
      expect(typeof step[key], `${where} ${step.type}.${key}`).toBe('number');
    }
    if (step.damage !== undefined) expect(step.damage).toBeGreaterThanOrEqual(0);
    for (const e of step.effects ?? []) expect(EFFECT_TYPES).toContain(e.type);
    if (step.onEnd) checkSteps(step.onEnd, `${where} onEnd`);
  }
}
```

- [ ] **Step 2: Write the failing test `tests/data.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CHARACTERS, CHARACTER_IDS, getCharacter } from '../src/data/characters.js';
import { getWeapon, getWeaponLine } from '../src/data/weapons.js';
import { unlockLevel, TIER_COUNT } from '../src/logic/progression.js';
import { checkSteps } from './validate.js';

function checkAbility(ability, where) {
  expect(typeof ability.name, `${where} name`).toBe('string');
  expect(ability.name.length).toBeGreaterThan(0);
  expect(typeof ability.description, `${where} description`).toBe('string');
  expect(ability.description.length).toBeGreaterThan(0);
  expect(ability.cooldown, `${where} cooldown`).toBeGreaterThan(0);
  checkSteps(ability.steps, where);
}

describe('characters', () => {
  it('has the 4 characters', () => {
    expect(CHARACTER_IDS).toEqual(['sparkle', 'bubbles', 'pancake', 'rex']);
    for (const c of CHARACTERS) {
      expect(c.speed).toBeGreaterThan(0);
      expect(c.damage).toBeGreaterThan(0);
      expect(c.defense).toBeGreaterThan(0);
      expect(c.preferredRange).toBeGreaterThan(0);
      expect(typeof c.colors.main).toBe('number');
    }
  });

  it('throws for an unknown character', () => {
    expect(() => getCharacter('nobody')).toThrow();
  });
});

describe('weapons', () => {
  it('has 11 tiers per character with correct unlock levels', () => {
    for (const id of CHARACTER_IDS) {
      const line = getWeaponLine(id);
      expect(line).toHaveLength(TIER_COUNT);
      line.forEach((w, i) => {
        expect(w.tier).toBe(i + 1);
        expect(w.unlockLevel).toBe(unlockLevel(i + 1));
        expect(w.characterId).toBe(id);
      });
    }
  });

  it('every weapon has a valid basic attack and special', () => {
    for (const id of CHARACTER_IDS) {
      for (const w of getWeaponLine(id)) {
        checkAbility(w.basic, `${w.name} basic`);
        checkAbility(w.special, `${w.name} special`);
      }
    }
  });

  it('has 44 unique weapon names and 44 unique special names', () => {
    const all = CHARACTER_IDS.flatMap((id) => getWeaponLine(id));
    expect(new Set(all.map((w) => w.name)).size).toBe(44);
    expect(new Set(all.map((w) => w.special.name)).size).toBe(44);
  });

  it('basic attacks get stronger with tier', () => {
    for (const id of CHARACTER_IDS) {
      expect(getWeapon(id, 11).basic.steps[0].damage).toBeGreaterThan(getWeapon(id, 1).basic.steps[0].damage);
    }
  });

  it('throws for bad tiers', () => {
    expect(() => getWeapon('sparkle', 0)).toThrow();
    expect(() => getWeapon('sparkle', 12)).toThrow();
    expect(() => getWeapon('nobody', 1)).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/data.test.js`
Expected: FAIL — cannot resolve `../src/data/characters.js`.

- [ ] **Step 4: Create `src/logic/stepTypes.js`**

```js
export const STEP_REQUIRED = {
  melee: ['damage', 'range', 'arc'],
  projectile: ['damage', 'speed', 'size', 'life'],
  dash: ['distance'],
  burst: ['radius', 'damage'],
  shield: ['duration', 'reduction'],
  heal: ['amount'],
  pull: ['range', 'strength'],
  zone: ['radius', 'duration'],
  leap: ['duration', 'radius', 'damage'],
  guard: ['hits'],
  strike: ['damage', 'range'],
};

export const STEP_TYPES = Object.keys(STEP_REQUIRED);

export const EFFECT_TYPES = ['slow', 'freeze', 'stun', 'pull'];
```

- [ ] **Step 5: Create `src/data/characters.js`**

```js
export const CHARACTERS = [
  {
    id: 'sparkle',
    name: 'Sir Sparkle',
    description: 'A brave little knight who loves close-up sword bonks.',
    style: 'melee',
    colors: { main: 0xff8fc7, accent: 0xdfe6ee, alt: 0xffd166 },
    speed: 1.0,
    damage: 1.15,
    defense: 1.0,
    preferredRange: 1.8,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    description: 'A tiny wizard who zaps from far away.',
    style: 'magic',
    colors: { main: 0x7b6cff, accent: 0xffe066, alt: 0x4cd4b0 },
    speed: 1.0,
    damage: 0.9,
    defense: 1.0,
    preferredRange: 7,
  },
  {
    id: 'pancake',
    name: 'Chef Pancake',
    description: 'A tough chef who throws tasty treats.',
    style: 'throw',
    colors: { main: 0xffffff, accent: 0xf4a259, alt: 0xff6b6b },
    speed: 0.9,
    damage: 1.0,
    defense: 0.9,
    preferredRange: 3,
  },
  {
    id: 'rex',
    name: 'Robo Rex',
    description: 'A speedy robot dino with foam blasters.',
    style: 'blaster',
    colors: { main: 0x5ad16a, accent: 0x9aa5b1, alt: 0xff9f1c },
    speed: 1.15,
    damage: 1.0,
    defense: 1.0,
    preferredRange: 5,
  },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export function getCharacter(id) {
  const character = CHARACTERS.find((c) => c.id === id);
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}
```

- [ ] **Step 6: Create `src/data/weapons.js`**

```js
import { unlockLevel } from '../logic/progression.js';

const special = (name, description, cooldown, steps) => ({ name, description, cooldown, steps });
const weapon = (name, specialAbility) => ({ name, special: specialAbility });

// Basic attacks get a little stronger each tier.
const BASICS = {
  sparkle: (t) => ({
    name: 'Sword Swing',
    description: 'Swing your sword up close.',
    cooldown: 0.45,
    steps: [{ type: 'melee', damage: 6 + 0.4 * (t - 1), range: 1.9, arc: 110, knockback: 3, popup: 'BONK!' }],
  }),
  bubbles: (t) => ({
    name: 'Bubble Shot',
    description: 'Shoot a bouncy bubble.',
    cooldown: 0.5,
    steps: [{ type: 'projectile', damage: 5 + 0.3 * (t - 1), speed: 14, size: 0.35, life: 1.2, style: 'bubble', popup: 'POP!' }],
  }),
  pancake: (t) => ({
    name: 'Utensil Smack',
    description: 'Smack with your kitchen tool.',
    cooldown: 0.55,
    steps: [{ type: 'melee', damage: 6.5 + 0.4 * (t - 1), range: 2.6, arc: 90, knockback: 4, popup: 'SMACK!' }],
  }),
  rex: (t) => ({
    name: 'Foam Dart',
    description: 'Fire a speedy foam dart.',
    cooldown: 0.35,
    steps: [{ type: 'projectile', damage: 4 + 0.3 * (t - 1), speed: 20, size: 0.22, life: 0.8, style: 'dart', popup: 'POW!' }],
  }),
};

const WEAPON_LINES = {
  sparkle: [
    weapon('Foam Sword', special('Dash Strike', 'Dash forward and bonk!', 4, [
      { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 10, knockback: 5, popup: 'BONK!' },
    ])),
    weapon('Wooden Sword', special('Spin Swing', 'Spin around and hit everything close.', 5, [
      { type: 'burst', at: 'self', radius: 2.6, damage: 12, knockback: 5, popup: 'WHOOSH!' },
    ])),
    weapon('Shiny Sword', special('Shield Block', 'Block all hits for a moment.', 6, [
      { type: 'shield', duration: 1.5, reduction: 1 },
    ])),
    weapon('Sparkle Saber', special('Sparkle Wave', 'Send a sparkly wave flying.', 4.5, [
      { type: 'projectile', damage: 14, speed: 13, size: 0.6, life: 1.0, style: 'wave', popup: 'SPARKLE!' },
    ])),
    weapon('Thunder Blade', special('Zap Dash', 'Dash with lightning and make them dizzy.', 6, [
      { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 12, knockback: 3, effects: [{ type: 'stun', duration: 0.6 }], popup: 'ZAP!' },
    ])),
    weapon('Frost Edge', special('Frost Wave', 'A chilly wave that freezes.', 6, [
      { type: 'projectile', damage: 12, speed: 12, size: 0.6, life: 1.0, style: 'frost', effects: [{ type: 'freeze', duration: 1 }], popup: 'BRRR!' },
    ])),
    weapon('Dragon Fang', special('Fire Spin', 'A fiery spin with a big push.', 6, [
      { type: 'burst', at: 'self', radius: 3, damage: 16, knockback: 9, popup: 'WHOOSH!' },
    ])),
    weapon('Crystal Claymore', special('Crystal Guard', 'Block hits, then explode with crystals.', 8, [
      { type: 'shield', duration: 1.5, reduction: 1, onEnd: [
        { type: 'burst', at: 'self', radius: 3, damage: 14, knockback: 6, popup: 'CLINK!' },
      ] },
    ])),
    weapon('Comet Sword', special('Comet Slam', 'Leap like a comet and slam down.', 7, [
      { type: 'leap', duration: 0.6, radius: 2.8, damage: 18, knockback: 7, popup: 'SLAM!' },
    ])),
    weapon('Royal Moonblade', special('Triple Moon', 'Three moon waves at once.', 6, [
      { type: 'projectile', count: 3, spread: 40, damage: 10, speed: 13, size: 0.55, life: 1.0, style: 'moon', popup: 'SHINE!' },
    ])),
    weapon('Rainbow Starblade', special('Rainbow Storm', 'A rainbow blast plus five rainbow waves.', 9, [
      { type: 'burst', at: 'self', radius: 3.2, damage: 15, knockback: 6, popup: 'RAINBOW!' },
      { type: 'projectile', count: 5, spread: 60, damage: 8, speed: 12, size: 0.5, life: 1.0, style: 'rainbow', popup: 'SPARKLE!' },
    ])),
  ],
  bubbles: [
    weapon('Bubble Wand', special('Big Bubble', 'A big slow bubble that slows them down.', 4, [
      { type: 'projectile', damage: 10, speed: 7, size: 0.8, life: 2, style: 'bigBubble', effects: [{ type: 'slow', duration: 2, amount: 0.4 }], popup: 'BLOOP!' },
    ])),
    weapon('Soapy Staff', special('Bubble Trio', 'Three bubbles at once.', 4, [
      { type: 'projectile', count: 3, spread: 30, damage: 7, speed: 14, size: 0.35, life: 1.2, style: 'bubble', popup: 'POP!' },
    ])),
    weapon('Sparkle Wand', special('Blink', 'Teleport away in a sparkle.', 5, [
      { type: 'dash', direction: 'escape', distance: 5, duration: 0 },
    ])),
    weapon('Frosty Wand', special('Snowball', 'A snowball that freezes.', 6, [
      { type: 'projectile', damage: 10, speed: 13, size: 0.45, life: 1.2, style: 'snowball', effects: [{ type: 'freeze', duration: 1 }], popup: 'BRRR!' },
    ])),
    weapon('Thunder Rod', special('Lightning Zap', 'A super fast zap that goes through.', 5, [
      { type: 'projectile', damage: 15, speed: 30, size: 0.3, life: 0.6, pierce: true, style: 'lightning', popup: 'ZAP!' },
    ])),
    weapon('Flower Staff', special('Healing Petals', 'Flower power gives you energy back.', 10, [
      { type: 'heal', amount: 20 },
    ])),
    weapon('Moon Wand', special('Bubble Shield', 'A bubble that soaks up most hits.', 9, [
      { type: 'shield', duration: 3, reduction: 0.7 },
    ])),
    weapon('Storm Scepter', special('Mini Tornado', 'A little tornado that pulls them in.', 7, [
      { type: 'projectile', damage: 10, speed: 6, size: 0.9, life: 2.2, style: 'tornado', effects: [{ type: 'pull', strength: 12 }], popup: 'WHIRL!' },
    ])),
    weapon('Phoenix Staff', special('Fire Bird', 'A fire bird that chases them.', 7, [
      { type: 'projectile', damage: 18, speed: 11, size: 0.8, life: 1.8, homing: 2.5, knockback: 6, style: 'firebird', popup: 'WHOOSH!' },
    ])),
    weapon('Starlight Scepter', special('Star Rain', 'Stars fall where they are standing!', 8, [
      { type: 'burst', at: 'target', delay: 0.5, radius: 2.2, damage: 20, knockback: 3, style: 'starRain', popup: 'TWINKLE!' },
    ])),
    weapon('Galaxy Bubble Staff', special('Galaxy Bubble', 'A giant galaxy bubble, then star rain.', 10, [
      { type: 'projectile', damage: 12, speed: 8, size: 1.1, life: 2, style: 'galaxy', effects: [{ type: 'freeze', duration: 1.2 }], popup: 'BLOOP!' },
      { type: 'burst', at: 'target', delay: 0.8, radius: 2.4, damage: 12, style: 'starRain', popup: 'TWINKLE!' },
    ])),
  ],
  pancake: [
    weapon('Spatula', special('Pancake Toss', 'Flip a pancake at them.', 3.5, [
      { type: 'projectile', damage: 10, speed: 13, size: 0.5, life: 1.1, style: 'pancake', popup: 'FLAP!' },
    ])),
    weapon('Frying Pan', special('Pan Block', 'Block everything with your pan. BOING!', 6, [
      { type: 'shield', duration: 1.5, reduction: 1 },
    ])),
    weapon('Rolling Pin', special('Rolling Charge', 'Roll forward and knock them back.', 5, [
      { type: 'dash', direction: 'forward', distance: 7, duration: 0.4, damage: 12, knockback: 7, popup: 'ROLL!' },
    ])),
    weapon('Pie Launcher', special('Cream Pie', 'A creamy pie that slows them down.', 5, [
      { type: 'projectile', damage: 12, speed: 12, size: 0.55, life: 1.2, style: 'pie', effects: [{ type: 'slow', duration: 2, amount: 0.4 }], popup: 'SPLAT!' },
    ])),
    weapon('Ice Cream Scoop', special('Brain Freeze', 'A scoop of ice cream that freezes.', 6, [
      { type: 'projectile', damage: 10, speed: 12, size: 0.5, life: 1.2, style: 'iceCream', effects: [{ type: 'freeze', duration: 1 }], popup: 'BRRR!' },
    ])),
    weapon('Pizza Cutter', special('Pizza Frisbee', 'A pizza frisbee that comes back.', 5, [
      { type: 'projectile', damage: 14, speed: 14, size: 0.6, life: 1.4, pierce: true, returning: true, style: 'pizza', popup: 'WHIZZ!' },
    ])),
    weapon('Jelly Blaster', special('Jelly Puddle', 'A wobbly puddle that slows them.', 8, [
      { type: 'zone', at: 'target', radius: 2.5, duration: 4, slow: 0.5, dps: 0, style: 'jelly' },
    ])),
    weapon('Cupcake Cannon', special('Cupcake Trio', 'Three cupcakes at once.', 5, [
      { type: 'projectile', count: 3, spread: 30, damage: 8, speed: 13, size: 0.4, life: 1.2, style: 'cupcake', popup: 'YUM!' },
    ])),
    weapon('Hot Sauce Sprayer', special('Spicy Spin', 'A spicy spin with a big push.', 6, [
      { type: 'burst', at: 'self', radius: 3, damage: 16, knockback: 9, popup: 'SPICY!' },
    ])),
    weapon('Grand Wok', special('Snack Time', 'Eat a snack and get a shield.', 10, [
      { type: 'heal', amount: 15 },
      { type: 'shield', duration: 2, reduction: 0.5 },
    ])),
    weapon('Golden Mega-Whisk', special('Sprinkle Tornado', 'Whisk them in, then sprinkle them!', 10, [
      { type: 'burst', at: 'self', radius: 3.2, damage: 14, knockback: 0, popup: 'WHISK!' },
      { type: 'pull', range: 8, strength: 20 },
      { type: 'projectile', delay: 0.3, count: 6, spread: 90, damage: 5, speed: 14, size: 0.25, life: 1.2, style: 'sprinkle', popup: 'YUM!' },
    ])),
  ],
  rex: [
    weapon('Toy Blaster', special('Rocket Hop', 'Zoom forward with rocket jets.', 4, [
      { type: 'dash', direction: 'forward', distance: 6, duration: 0.3, damage: 8, knockback: 4, popup: 'ZOOM!' },
    ])),
    weapon('Water Squirter', special('Splash Wave', 'A big splash that pushes them away.', 5, [
      { type: 'burst', at: 'self', radius: 2.8, damage: 10, knockback: 8, popup: 'SPLASH!' },
    ])),
    weapon('Dart Launcher', special('Triple Dart', 'Three darts at once.', 4, [
      { type: 'projectile', count: 3, spread: 25, damage: 7, speed: 20, size: 0.22, life: 0.8, style: 'dart', popup: 'POW!' },
    ])),
    weapon('Magnet Gun', special('Magnet Pull', 'Pull them close and bonk!', 7, [
      { type: 'pull', range: 10, strength: 28 },
      { type: 'melee', delay: 0.35, damage: 10, range: 2.2, arc: 140, knockback: 3, popup: 'CLANG!' },
    ])),
    weapon('Laser Tag Zapper', special('Laser Beam', 'A super fast laser that goes through.', 5, [
      { type: 'projectile', damage: 15, speed: 32, size: 0.25, life: 0.6, pierce: true, style: 'laser', popup: 'ZAP!' },
    ])),
    weapon('Goo Cannon', special('Goo Trap', 'A gooey puddle that slows and tickles.', 8, [
      { type: 'zone', at: 'target', radius: 2.5, duration: 4, slow: 0.5, dps: 3, style: 'goo' },
    ])),
    weapon('Freeze Ray', special('Freeze Beam', 'A frosty beam that freezes.', 7, [
      { type: 'projectile', damage: 10, speed: 22, size: 0.35, life: 0.8, style: 'freezeRay', effects: [{ type: 'freeze', duration: 1.2 }], popup: 'BRRR!' },
    ])),
    weapon('Dino Roar Cannon', special('Mega Roar', 'A roar so loud they get dizzy.', 7, [
      { type: 'burst', at: 'self', radius: 3.2, damage: 14, knockback: 4, effects: [{ type: 'stun', duration: 0.8 }], popup: 'ROAR!' },
    ])),
    weapon('Robo Shield Arm', special('Force Field', 'A force field that blocks everything.', 8, [
      { type: 'shield', duration: 2, reduction: 1 },
    ])),
    weapon('Thunder Lizard Launcher', special('Missile Swarm', 'Five mini rockets that chase them.', 8, [
      { type: 'projectile', count: 5, spread: 70, damage: 5, speed: 12, size: 0.3, life: 1.8, homing: 3, style: 'rocket', popup: 'POW!' },
    ])),
    weapon('Super Nova Cannon', special('Nova Blast', 'A giant glowing blast.', 10, [
      { type: 'projectile', damage: 25, speed: 18, size: 1.0, life: 1.0, pierce: true, knockback: 9, style: 'nova', popup: 'KA-POW!' },
    ])),
  ],
};

export function getWeapon(characterId, tier) {
  const line = WEAPON_LINES[characterId];
  if (!line) throw new Error(`Unknown character: ${characterId}`);
  const entry = line[tier - 1];
  if (!entry) throw new Error(`Unknown weapon tier ${tier} for ${characterId}`);
  return {
    characterId,
    tier,
    unlockLevel: unlockLevel(tier),
    name: entry.name,
    basic: BASICS[characterId](tier),
    special: entry.special,
  };
}

export function getWeaponLine(characterId) {
  const line = WEAPON_LINES[characterId];
  if (!line) throw new Error(`Unknown character: ${characterId}`);
  return line.map((_, i) => getWeapon(characterId, i + 1));
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/data.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 8: Commit**

```bash
git add src/data/characters.js src/data/weapons.js src/logic/stepTypes.js tests/validate.js tests/data.test.js
git commit -m "feat: add 4 characters and 44 weapon definitions"
```

---

### Task 5: Pets data

**Files:**
- Create: `src/data/pets.js`
- Test: `tests/petsData.test.js`

- [ ] **Step 1: Write the failing test `tests/petsData.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { PETS, PET_IDS, PET_TRIGGERS, getPet } from '../src/data/pets.js';
import { checkSteps } from './validate.js';

describe('pets data', () => {
  it('has 8 pets with unique ids and rising prices', () => {
    expect(PETS).toHaveLength(8);
    expect(new Set(PET_IDS).size).toBe(8);
    for (let i = 1; i < PETS.length; i++) expect(PETS[i].price).toBeGreaterThan(PETS[i - 1].price);
    expect(PETS[0].price).toBe(50);
  });

  it('every pet is well formed', () => {
    for (const p of PETS) {
      expect(typeof p.name).toBe('string');
      expect(typeof p.species).toBe('string');
      expect(p.interval).toBeGreaterThan(0);
      expect(PET_TRIGGERS).toContain(p.trigger);
      if (p.trigger === 'inRange') expect(p.range).toBeGreaterThan(0);
      expect(typeof p.move.name).toBe('string');
      expect(typeof p.move.description).toBe('string');
      checkSteps(p.move.steps, p.name);
    }
  });

  it('throws for unknown pets', () => {
    expect(() => getPet('dragonzilla')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/petsData.test.js`
Expected: FAIL — cannot resolve `../src/data/pets.js`.

- [ ] **Step 3: Create `src/data/pets.js`**

```js
// trigger: when the helper move may fire once its timer is ready.
//   inRange — opponent within `range` of the pet
//   hurt    — owner has less than full energy
//   noGuard — owner has no guard charge
//   always  — whenever ready
export const PET_TRIGGERS = ['inRange', 'hurt', 'noGuard', 'always'];

export const PETS = [
  {
    id: 'biscuit', name: 'Biscuit', species: 'Puppy', price: 50, interval: 4, trigger: 'inRange', range: 6,
    colors: { main: 0xc68b59, accent: 0xffffff },
    move: {
      name: 'Bonk Bark',
      description: 'Runs up and bonks a nearby opponent.',
      steps: [{ type: 'strike', damage: 4, range: 6, knockback: 2, popup: 'WOOF!' }],
    },
  },
  {
    id: 'whiskers', name: 'Whiskers', species: 'Kitty', price: 100, interval: 6, trigger: 'inRange', range: 8,
    colors: { main: 0xffa94d, accent: 0xffffff },
    move: {
      name: 'Pounce',
      description: 'Pounces on the opponent.',
      steps: [{ type: 'strike', damage: 6, range: 8, knockback: 3, popup: 'MEOW!' }],
    },
  },
  {
    id: 'hops', name: 'Hops', species: 'Bunny', price: 150, interval: 10, trigger: 'hurt',
    colors: { main: 0xf8f9fa, accent: 0xffa8c5 },
    move: {
      name: 'Carrot Snack',
      description: 'Drops a carrot that gives you energy.',
      steps: [{ type: 'heal', amount: 8 }],
    },
  },
  {
    id: 'shelly', name: 'Shelly', species: 'Turtle', price: 200, interval: 12, trigger: 'noGuard',
    colors: { main: 0x69db7c, accent: 0x8d6e63 },
    move: {
      name: 'Shell Guard',
      description: 'Blocks the next hit on you.',
      steps: [{ type: 'guard', hits: 1 }],
    },
  },
  {
    id: 'hoot', name: 'Hoot', species: 'Owl', price: 250, interval: 5, trigger: 'inRange', range: 14,
    colors: { main: 0xa07855, accent: 0xfff3bf },
    move: {
      name: 'Feather Shot',
      description: 'Shoots a feather at the opponent.',
      steps: [{ type: 'projectile', damage: 5, speed: 15, size: 0.3, life: 1.2, style: 'feather', popup: 'HOOT!' }],
    },
  },
  {
    id: 'pebble', name: 'Pebble', species: 'Penguin', price: 350, interval: 12, trigger: 'inRange', range: 8,
    colors: { main: 0x343a40, accent: 0xffffff },
    move: {
      name: 'Ice Slide',
      description: 'Slides into the opponent and freezes them.',
      steps: [{ type: 'strike', damage: 4, range: 8, effects: [{ type: 'freeze', duration: 0.8 }], popup: 'BRRR!' }],
    },
  },
  {
    id: 'ember', name: 'Ember', species: 'Baby Dragon', price: 450, interval: 6, trigger: 'inRange', range: 14,
    colors: { main: 0xff6b6b, accent: 0xffd43b },
    move: {
      name: 'Puff Ball',
      description: 'Puffs a little fireball.',
      steps: [{ type: 'projectile', damage: 8, speed: 13, size: 0.45, life: 1.3, style: 'puffball', popup: 'PUFF!' }],
    },
  },
  {
    id: 'twinkle', name: 'Twinkle', species: 'Unicorn', price: 600, interval: 12, trigger: 'always',
    colors: { main: 0xffffff, accent: 0xcc5de8 },
    move: {
      name: 'Rainbow Sparkle',
      description: 'Gives you energy and sparkles nearby opponents.',
      steps: [
        { type: 'heal', amount: 10 },
        { type: 'burst', at: 'self', radius: 3, damage: 8, knockback: 3, popup: 'SPARKLE!' },
      ],
    },
  },
];

export const PET_IDS = PETS.map((p) => p.id);

export function getPet(id) {
  const pet = PETS.find((p) => p.id === id);
  if (!pet) throw new Error(`Unknown pet: ${id}`);
  return pet;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/petsData.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/pets.js tests/petsData.test.js
git commit -m "feat: add 8 pet definitions"
```

---

### Task 6: Save system

**Files:**
- Create: `src/logic/save.js`
- Test: `tests/save.test.js`

`save.js` needs default Training Ground options. They are defined here and re-used by `training.js` in Task 15.

- [ ] **Step 1: Write the failing test `tests/save.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  SAVE_KEY, SAVE_VERSION, STARTING_COINS, DEFAULT_TRAINING_OPTIONS,
  createSave, createMemoryStorage, getStorage, loadSave, writeSave, resetSave,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/save.test.js`
Expected: FAIL — cannot resolve `../src/logic/save.js`.

- [ ] **Step 3: Create `src/logic/save.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/save.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/save.js tests/save.test.js
git commit -m "feat: add versioned save with safe fallback"
```

---

### Task 7: Pet Shop logic

**Files:**
- Create: `src/logic/shop.js`
- Test: `tests/shop.test.js`

- [ ] **Step 1: Write the failing test `tests/shop.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createSave } from '../src/logic/save.js';
import { ownsPet, canBuyPet, coinsNeeded, buyPet, equipPet } from '../src/logic/shop.js';

describe('shop', () => {
  it('buys a pet with enough coins', () => {
    const r = buyPet(createSave(), 'biscuit');
    expect(r.ok).toBe(true);
    expect(r.save.coins).toBe(0);
    expect(ownsPet(r.save, 'biscuit')).toBe(true);
  });

  it('cannot buy twice', () => {
    const once = buyPet({ ...createSave(), coins: 500 }, 'biscuit').save;
    const twice = buyPet(once, 'biscuit');
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('owned');
    expect(twice.save).toBe(once);
  });

  it('cannot buy without enough coins', () => {
    const save = createSave();
    expect(canBuyPet(save, 'whiskers')).toBe(false);
    expect(coinsNeeded(save, 'whiskers')).toBe(50);
    const r = buyPet(save, 'whiskers');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('coins');
    expect(r.save).toBe(save);
  });

  it('does not change the original save', () => {
    const save = createSave();
    buyPet(save, 'biscuit');
    expect(save.coins).toBe(50);
    expect(save.ownedPets).toEqual([]);
  });

  it('equips only owned pets, or none', () => {
    const owned = buyPet(createSave(), 'biscuit').save;
    expect(equipPet(owned, 'p1', 'biscuit').lastPets.p1).toBe('biscuit');
    expect(equipPet(owned, 'p1', 'twinkle')).toBe(owned);
    expect(equipPet(equipPet(owned, 'p2', 'biscuit'), 'p2', null).lastPets.p2).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shop.test.js`
Expected: FAIL — cannot resolve `../src/logic/shop.js`.

- [ ] **Step 3: Create `src/logic/shop.js`**

```js
import { getPet } from '../data/pets.js';

export function ownsPet(save, petId) {
  return save.ownedPets.includes(petId);
}

export function canBuyPet(save, petId) {
  return !ownsPet(save, petId) && save.coins >= getPet(petId).price;
}

export function coinsNeeded(save, petId) {
  return Math.max(0, getPet(petId).price - save.coins);
}

export function buyPet(save, petId) {
  if (ownsPet(save, petId)) return { ok: false, reason: 'owned', save };
  const { price } = getPet(petId);
  if (save.coins < price) return { ok: false, reason: 'coins', save };
  return {
    ok: true,
    save: { ...save, coins: save.coins - price, ownedPets: [...save.ownedPets, petId] },
  };
}

export function equipPet(save, slot, petId) {
  if (petId !== null && !ownsPet(save, petId)) return save;
  return { ...save, lastPets: { ...save.lastPets, [slot]: petId } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shop.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/shop.js tests/shop.test.js
git commit -m "feat: add pet shop buy/equip logic"
```

---

### Task 8: Fighter state and status effects

**Files:**
- Create: `src/logic/fighter.js`
- Test: `tests/fighter.test.js`

- [ ] **Step 1: Write the failing test `tests/fighter.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  createFighter, resetFighter, setLoadout, applyStatus, isDisabled, isFrozen, slowFactor, cooldownFraction,
} from '../src/logic/fighter.js';
import { getCharacter } from '../src/data/characters.js';
import { getWeapon } from '../src/data/weapons.js';

const sparkle = () => createFighter({ id: 'p1', character: getCharacter('sparkle'), level: 1, weapon: getWeapon('sparkle', 1) });

describe('fighter', () => {
  it('starts with full energy and level-scaled stats', () => {
    const f = createFighter({ id: 'p1', character: getCharacter('sparkle'), level: 100, weapon: getWeapon('sparkle', 11) });
    expect(f.energy).toBe(100);
    expect(f.damageMult).toBeCloseTo(1.15 * 1.495);
    expect(f.speedMult).toBeCloseTo(1.099);
    expect(f.ko).toBe(false);
  });

  it('caps freeze at 1.2s and grants 2s immunity after', () => {
    const f = sparkle();
    expect(applyStatus(f, 0, { type: 'freeze', duration: 3 })).toBe(true);
    expect(f.status.freezeUntil).toBeCloseTo(1.2);
    expect(isFrozen(f, 1.0)).toBe(true);
    expect(isDisabled(f, 1.3)).toBe(false);
    expect(applyStatus(f, 2.0, { type: 'stun', duration: 0.5 })).toBe(false);
    expect(applyStatus(f, 3.3, { type: 'stun', duration: 0.5 })).toBe(true);
    expect(isDisabled(f, 3.5)).toBe(true);
  });

  it('caps slow at 50% and keeps the stronger slow', () => {
    const f = sparkle();
    applyStatus(f, 0, { type: 'slow', duration: 2, amount: 0.9 });
    expect(slowFactor(f, 1)).toBeCloseTo(0.5);
    applyStatus(f, 1, { type: 'slow', duration: 2, amount: 0.2 });
    expect(slowFactor(f, 1.5)).toBeCloseTo(0.5);
    expect(slowFactor(f, 3.5)).toBe(1);
  });

  it('reports cooldown fraction', () => {
    const f = sparkle();
    f.cooldowns.special = 2; // ready at t=2, cooldown 4
    expect(cooldownFraction(f, 'special', 0)).toBeCloseTo(0.5);
    expect(cooldownFraction(f, 'special', 3)).toBe(0);
  });

  it('resets for a new round', () => {
    const f = sparkle();
    f.energy = 3;
    f.ko = true;
    f.guardHits = 1;
    f.status.freezeUntil = 99;
    resetFighter(f, { x: 5, y: 0, z: 0 });
    expect(f.energy).toBe(100);
    expect(f.ko).toBe(false);
    expect(f.guardHits).toBe(0);
    expect(f.status.freezeUntil).toBe(0);
    expect(f.pos).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('changes loadout and recomputes stats', () => {
    const f = sparkle();
    f.cooldowns.special = 10;
    setLoadout(f, { character: getCharacter('rex'), level: 50, weapon: getWeapon('rex', 6) });
    expect(f.character.id).toBe('rex');
    expect(f.weapon.name).toBe('Goo Cannon');
    expect(f.damageMult).toBeCloseTo(1.245);
    expect(f.cooldowns.special).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fighter.test.js`
Expected: FAIL — cannot resolve `../src/logic/fighter.js`.

- [ ] **Step 3: Create `src/logic/fighter.js`**

```js
import { MAX_ENERGY, MAX_CC_DURATION, CC_IMMUNITY, MAX_SLOW } from './constants.js';
import { damageMultiplier, speedMultiplier } from './progression.js';

function freshState(pos) {
  return {
    energy: MAX_ENERGY,
    pos: { x: pos.x, y: pos.y ?? 0, z: pos.z },
    velY: 0,
    knock: { x: 0, z: 0 },
    onGround: true,
    cooldowns: { basic: 0, special: 0 },
    status: { slowUntil: 0, slowAmount: 0, freezeUntil: 0, stunUntil: 0, ccImmuneUntil: 0 },
    shield: null,
    guardHits: 0,
    dash: null,
    leap: null,
    ko: false,
    input: { moveX: 0, moveZ: 0, jump: false, attack: false, special: false },
  };
}

export function createFighter({ id, character, level = 1, weapon = null, pos = { x: 0, y: 0, z: 0 } }) {
  const f = {
    id,
    facing: 0,
    infiniteEnergy: false,
    noCooldowns: false,
    ...freshState(pos),
  };
  setLoadout(f, { character, level, weapon });
  return f;
}

export function setLoadout(f, { character, level, weapon }) {
  f.character = character;
  f.level = level;
  f.weapon = weapon;
  f.damageMult = character.damage * damageMultiplier(level);
  f.speedMult = character.speed * speedMultiplier(level);
  f.cooldowns = { basic: 0, special: 0 };
}

export function resetFighter(f, pos) {
  Object.assign(f, freshState(pos));
}

export function isFrozen(f, now) {
  return now < f.status.freezeUntil;
}

export function isDisabled(f, now) {
  return now < f.status.freezeUntil || now < f.status.stunUntil;
}

export function slowFactor(f, now) {
  return now < f.status.slowUntil ? 1 - f.status.slowAmount : 1;
}

export function applyStatus(f, now, effect) {
  const s = f.status;
  if (effect.type === 'slow') {
    const amount = Math.min(MAX_SLOW, effect.amount);
    s.slowAmount = now < s.slowUntil ? Math.max(s.slowAmount, amount) : amount;
    s.slowUntil = Math.max(s.slowUntil, now + effect.duration);
    return true;
  }
  if (effect.type === 'freeze' || effect.type === 'stun') {
    if (now < s.ccImmuneUntil) return false;
    const duration = Math.min(MAX_CC_DURATION, effect.duration);
    if (effect.type === 'freeze') s.freezeUntil = now + duration;
    else s.stunUntil = now + duration;
    s.ccImmuneUntil = now + duration + CC_IMMUNITY;
    return true;
  }
  return false;
}

export function cooldownFraction(f, slot, now) {
  const def = f.weapon?.[slot];
  if (!def) return 0;
  const left = f.cooldowns[slot] - now;
  return left <= 0 ? 0 : Math.min(1, left / def.cooldown);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fighter.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/fighter.js tests/fighter.test.js
git commit -m "feat: add fighter state and capped status effects"
```

---

### Task 9: World container and combat resolution

**Files:**
- Create: `src/logic/world.js`, `src/logic/combat.js`, `tests/helpers.js`
- Test: `tests/combat.test.js`

- [ ] **Step 1: Create shared test fixtures `tests/helpers.js`**

```js
import { createFighter } from '../src/logic/fighter.js';
import { createWorld } from '../src/logic/world.js';

export const TEST_CHAR = { id: 'test', name: 'Tester', speed: 1, damage: 1, defense: 1, preferredRange: 2, colors: { main: 0, accent: 0, alt: 0 } };

export function weaponWith(basicSteps, specialSteps = [{ type: 'heal', amount: 1 }], cooldown = 1) {
  return {
    characterId: 'test',
    tier: 1,
    name: 'Test Weapon',
    basic: { name: 'Test Basic', description: 'test', cooldown, steps: basicSteps },
    special: { name: 'Test Special', description: 'test', cooldown, steps: specialSteps },
  };
}

export function duel({ a = {}, b = {} } = {}) {
  const f1 = createFighter({ id: 'p1', character: a.character ?? TEST_CHAR, weapon: a.weapon ?? null, pos: a.pos ?? { x: -2, y: 0, z: 0 } });
  const f2 = createFighter({ id: 'p2', character: b.character ?? TEST_CHAR, weapon: b.weapon ?? null, pos: b.pos ?? { x: 2, y: 0, z: 0 } });
  return { world: createWorld([f1, f2]), f1, f2 };
}
```

- [ ] **Step 2: Write the failing test `tests/combat.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { applyDamage, heal, hitTarget, pullToward } from '../src/logic/combat.js';
import { opponentOf, schedule, runTimers, drainEvents, nextId } from '../src/logic/world.js';
import { getCharacter } from '../src/data/characters.js';
import { duel } from './helpers.js';

describe('world', () => {
  it('faces fighters toward each other', () => {
    const { f1, f2 } = duel();
    expect(f1.facing).toBeCloseTo(0);
    expect(Math.abs(f2.facing)).toBeCloseTo(Math.PI);
  });

  it('finds the opponent', () => {
    const { world, f1, f2 } = duel();
    expect(opponentOf(world, f1)).toBe(f2);
  });

  it('runs scheduled timers when due', () => {
    const { world } = duel();
    let ran = 0;
    schedule(world, 0.5, () => { ran += 1; });
    world.time = 0.4;
    runTimers(world);
    expect(ran).toBe(0);
    world.time = 0.5;
    runTimers(world);
    runTimers(world);
    expect(ran).toBe(1);
  });

  it('drains events and hands out ids', () => {
    const { world } = duel();
    world.events.push({ type: 'x' });
    expect(drainEvents(world)).toEqual([{ type: 'x' }]);
    expect(world.events).toEqual([]);
    expect(nextId(world)).toBe(1);
    expect(nextId(world)).toBe(2);
  });
});

describe('combat', () => {
  it('deals damage and emits a hit', () => {
    const { world, f1, f2 } = duel();
    expect(applyDamage(world, f2, 10, f1, 'BONK!')).toBe(10);
    expect(f2.energy).toBe(90);
    expect(world.events.at(-1)).toMatchObject({ type: 'hit', targetId: 'p2', attackerId: 'p1', damage: 10, popup: 'BONK!' });
  });

  it('applies character defense', () => {
    const { world, f1, f2 } = duel({ b: { character: getCharacter('pancake') } });
    expect(applyDamage(world, f2, 10, f1)).toBeCloseTo(9);
  });

  it('blocks fully with a full shield', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 1, onEnd: null };
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(f2.energy).toBe(100);
    expect(world.events.at(-1).type).toBe('blocked');
  });

  it('reduces damage with a partial shield', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 0.7, onEnd: null };
    expect(applyDamage(world, f2, 10, f1)).toBeCloseTo(3);
  });

  it('guard blocks exactly one hit', () => {
    const { world, f1, f2 } = duel();
    f2.guardHits = 1;
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(applyDamage(world, f2, 10, f1)).toBe(10);
    expect(f2.guardHits).toBe(0);
  });

  it('knocks out at zero energy, once', () => {
    const { world, f1, f2 } = duel();
    applyDamage(world, f2, 150, f1);
    expect(f2.energy).toBe(0);
    expect(f2.ko).toBe(true);
    expect(world.events.filter((e) => e.type === 'ko')).toHaveLength(1);
    expect(applyDamage(world, f2, 10, f1)).toBe(0);
    expect(world.events.filter((e) => e.type === 'ko')).toHaveLength(1);
  });

  it('infinite energy takes hits without losing energy', () => {
    const { world, f1, f2 } = duel();
    f2.infiniteEnergy = true;
    expect(applyDamage(world, f2, 30, f1)).toBe(30);
    expect(f2.energy).toBe(100);
  });

  it('heals up to the max', () => {
    const { world, f1 } = duel();
    f1.energy = 95;
    heal(world, f1, 20);
    expect(f1.energy).toBe(100);
    expect(world.events.at(-1)).toMatchObject({ type: 'heal', targetId: 'p1', amount: 5 });
  });

  it('hitTarget scales damage, knocks back, and applies effects', () => {
    const { world, f1, f2 } = duel();
    hitTarget(world, f1, f2, { damage: 10, knockback: 5, effects: [{ type: 'freeze', duration: 1 }] }, f1.pos, 2);
    expect(f2.energy).toBe(80);
    expect(f2.knock.x).toBeGreaterThan(0);
    expect(f2.status.freezeUntil).toBeCloseTo(1);
  });

  it('hitTarget applies no effects when blocked', () => {
    const { world, f1, f2 } = duel();
    f2.shield = { until: 5, reduction: 1, onEnd: null };
    hitTarget(world, f1, f2, { damage: 10, knockback: 5, effects: [{ type: 'freeze', duration: 1 }] }, f1.pos, 1);
    expect(f2.knock.x).toBe(0);
    expect(f2.status.freezeUntil).toBe(0);
  });

  it('pull effect pulls toward the attacker', () => {
    const { world, f1, f2 } = duel();
    hitTarget(world, f1, f2, { damage: 1, effects: [{ type: 'pull', strength: 10 }] }, f1.pos, 1);
    expect(f2.knock.x).toBeLessThan(0);
    pullToward(f1, f2.pos, 4);
    expect(f1.knock.x).toBeCloseTo(4);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/combat.test.js`
Expected: FAIL — cannot resolve `../src/logic/world.js`.

- [ ] **Step 4: Create `src/logic/world.js`**

```js
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
```

- [ ] **Step 5: Create `src/logic/combat.js`**

```js
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/combat.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 7: Commit**

```bash
git add src/logic/world.js src/logic/combat.js tests/helpers.js tests/combat.test.js
git commit -m "feat: add world container and combat resolution"
```

---

### Task 10: Abilities (using abilities + the instant primitives)

**Files:**
- Create: `src/logic/abilities.js`
- Test: `tests/abilities.test.js`

- [ ] **Step 1: Write the failing test `tests/abilities.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { tryUseAbility, runStep } from '../src/logic/abilities.js';
import { duel, weaponWith } from './helpers.js';

const melee = { type: 'melee', damage: 10, range: 2, arc: 90, knockback: 2, popup: 'BONK!' };

describe('tryUseAbility', () => {
  it('hits with melee in front and in range', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([melee]) }, b: { pos: { x: 0, y: 0, z: 0 } } });
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
    expect(f2.energy).toBe(90);
    expect(world.events.some((e) => e.type === 'ability' && e.name === 'Test Basic')).toBe(true);
    expect(world.events.some((e) => e.type === 'shape' && e.shape === 'arc')).toBe(true);
  });

  it('misses melee out of range or behind', () => {
    const far = duel({ a: { weapon: weaponWith([melee]) } });
    tryUseAbility(far.world, far.f1, 'basic');
    expect(far.f2.energy).toBe(100);

    const behind = duel({ a: { weapon: weaponWith([melee]) }, b: { pos: { x: 0, y: 0, z: 0 } } });
    behind.f1.facing = Math.PI;
    tryUseAbility(behind.world, behind.f1, 'basic');
    expect(behind.f2.energy).toBe(100);
  });

  it('respects cooldowns', () => {
    const { world, f1 } = duel({ a: { weapon: weaponWith([melee]) } });
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    world.time = 1.01;
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
  });

  it('No Cooldowns allows rapid use', () => {
    const { world, f1 } = duel({ a: { weapon: weaponWith([melee]) } });
    f1.noCooldowns = true;
    tryUseAbility(world, f1, 'basic');
    world.time = 0.11;
    expect(tryUseAbility(world, f1, 'basic')).toBe(true);
  });

  it('cannot act while frozen, knocked out, or without a weapon', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([melee]) } });
    f1.status.freezeUntil = 5;
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    f1.status.freezeUntil = 0;
    f1.ko = true;
    expect(tryUseAbility(world, f1, 'basic')).toBe(false);
    expect(tryUseAbility(world, f2, 'basic')).toBe(false);
  });
});

describe('primitives', () => {
  it('spawns spread projectiles aimed at the opponent', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'projectile', count: 3, spread: 30, damage: 5, speed: 10, size: 0.3, life: 1 }, f1, 1);
    expect(world.projectiles).toHaveLength(3);
    const angles = world.projectiles.map((p) => Math.atan2(p.vel.z, p.vel.x));
    expect(angles[0]).toBeCloseTo(-Math.PI / 12);
    expect(angles[1]).toBeCloseTo(0);
    expect(angles[2]).toBeCloseTo(Math.PI / 12);
    expect(world.projectiles[0]).toMatchObject({ ownerId: 'p1', damage: 5, scale: 1, pierce: false });
  });

  it('bursts hit within radius only', () => {
    const near = duel({ b: { pos: { x: 0, y: 0, z: 0 } } });
    runStep(near.world, near.f1, { type: 'burst', at: 'self', radius: 2, damage: 10 }, near.f1, 1);
    expect(near.f2.energy).toBe(90);
    const far = duel();
    runStep(far.world, far.f1, { type: 'burst', at: 'self', radius: 2, damage: 10 }, far.f1, 1);
    expect(far.f2.energy).toBe(100);
  });

  it('bursts at the target position', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'burst', at: 'target', radius: 1, damage: 10 }, f1, 1);
    expect(f2.energy).toBe(90);
  });

  it('heals, shields, and guards the caster', () => {
    const { world, f1 } = duel();
    f1.energy = 50;
    runStep(world, f1, { type: 'heal', amount: 20 }, f1, 1);
    expect(f1.energy).toBe(70);
    runStep(world, f1, { type: 'shield', duration: 2, reduction: 1 }, f1, 1);
    expect(f1.shield).toMatchObject({ until: 2, reduction: 1 });
    runStep(world, f1, { type: 'guard', hits: 1 }, f1, 1);
    expect(f1.guardHits).toBe(1);
  });

  it('pulls the opponent toward the caster when in range', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'pull', range: 10, strength: 20 }, f1, 1);
    expect(f2.knock.x).toBeLessThan(0);
  });

  it('places a zone at the target', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'zone', at: 'target', radius: 2, duration: 3, slow: 0.5, dps: 2, style: 'goo' }, f1, 1);
    expect(world.zones).toHaveLength(1);
    expect(world.zones[0]).toMatchObject({ ownerId: 'p1', pos: { x: 2, y: 0, z: 0 }, radius: 2, until: 3, slow: 0.5, dps: 2 });
  });

  it('strike hits from the source (pet) position when in range', () => {
    const { world, f1, f2 } = duel();
    const pet = { pos: { x: 1, y: 0, z: 0 }, facing: 0, strikeAnim: null };
    runStep(world, f1, { type: 'strike', damage: 4, range: 2 }, pet, 1);
    expect(f2.energy).toBe(96);
    expect(pet.strikeAnim).not.toBe(null);
  });

  it('blink teleports away from the opponent instantly', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'escape', distance: 5, duration: 0 }, f1, 1);
    expect(f1.pos.x).toBeCloseTo(-7);
    expect(f1.dash).toBe(null);
  });

  it('starts a dash toward the opponent', () => {
    const { world, f1 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 10 }, f1, 1);
    expect(f1.dash.speed).toBeCloseTo(20);
    expect(f1.dash.dir.x).toBeCloseTo(1);
  });

  it('throws on unknown step types', () => {
    const { world, f1 } = duel();
    expect(() => runStep(world, f1, { type: 'banana' }, f1, 1)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/abilities.test.js`
Expected: FAIL — cannot resolve `../src/logic/abilities.js`.

- [ ] **Step 3: Create `src/logic/abilities.js`**

```js
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
        if (!caster.ko) runStep(world, caster, step, source, scale, point);
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
      if (opp && !opp.ko && dist2D(source.pos, opp.pos) <= step.range) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/abilities.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/abilities.js tests/abilities.test.js
git commit -m "feat: add ability system with step primitives"
```

---

### Task 11: Movement, projectiles, zones, and the simulation step

**Files:**
- Create: `src/logic/movement.js`, `src/logic/projectiles.js`, `src/logic/simulation.js`
- Modify: `tests/helpers.js` (add `run`)
- Test: `tests/simulation.test.js`

- [ ] **Step 1: Add `run` to `tests/helpers.js`**

Add this import at the top of the file:

```js
import { stepWorld } from '../src/logic/simulation.js';
import { DT } from '../src/logic/constants.js';
```

And add this function at the bottom:

```js
export function run(world, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepWorld(world, DT);
}
```

- [ ] **Step 2: Write the failing test `tests/simulation.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { tryUseAbility, runStep } from '../src/logic/abilities.js';
import { stepWorld } from '../src/logic/simulation.js';
import { ARENA_RADIUS, FIGHTER_RADIUS, DT } from '../src/logic/constants.js';
import { dist2D } from '../src/logic/vec.js';
import { duel, weaponWith, run } from './helpers.js';

const shot = { type: 'projectile', damage: 10, speed: 14, size: 0.35, life: 1.2 };

describe('movement', () => {
  it('moves with input at base speed', () => {
    const { world, f1 } = duel({ b: { pos: { x: 10, y: 0, z: 0 } } });
    f1.input.moveX = 1;
    run(world, 1);
    expect(f1.pos.x).toBeCloseTo(4, 1);
  });

  it('moves at half speed when slowed', () => {
    const { world, f1 } = duel({ b: { pos: { x: 10, y: 0, z: 0 } } });
    f1.status.slowUntil = 5;
    f1.status.slowAmount = 0.5;
    f1.input.moveX = 1;
    run(world, 1);
    expect(f1.pos.x).toBeCloseTo(1, 1);
  });

  it('cannot move while frozen', () => {
    const { world, f1 } = duel();
    f1.status.freezeUntil = 5;
    f1.input.moveX = -1;
    run(world, 0.5);
    expect(f1.pos.x).toBeCloseTo(-2);
  });

  it('jumps and lands', () => {
    const { world, f1 } = duel();
    f1.input.jump = true;
    stepWorld(world, DT);
    f1.input.jump = false;
    expect(f1.pos.y).toBeGreaterThan(0);
    run(world, 1.5);
    expect(f1.pos.y).toBe(0);
    expect(f1.onGround).toBe(true);
  });

  it('stays inside the arena', () => {
    const { world, f1 } = duel();
    f1.input.moveX = -1;
    run(world, 5);
    expect(Math.hypot(f1.pos.x, f1.pos.z)).toBeLessThanOrEqual(ARENA_RADIUS - FIGHTER_RADIUS + 1e-9);
  });

  it('keeps fighters from overlapping', () => {
    const { world, f1, f2 } = duel({ a: { pos: { x: 0, y: 0, z: 0 } }, b: { pos: { x: 0.5, y: 0, z: 0 } } });
    stepWorld(world, DT);
    expect(dist2D(f1.pos, f2.pos)).toBeGreaterThanOrEqual(FIGHTER_RADIUS * 2 - 1e-6);
  });

  it('uses abilities from held input', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([shot]) } });
    f1.input.attack = true;
    stepWorld(world, DT);
    expect(world.projectiles).toHaveLength(1);
    f1.input.attack = false;
    run(world, 0.5);
    expect(f2.energy).toBe(90);
  });
});

describe('projectiles', () => {
  it('travels, hits once, and disappears', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, shot, f1, 1);
    run(world, 0.5);
    expect(f2.energy).toBe(90);
    expect(world.projectiles).toHaveLength(0);
  });

  it('a jumping target dodges', () => {
    const { world, f1, f2 } = duel({ b: { pos: { x: 4, y: 0, z: 0 } } });
    runStep(world, f1, shot, f1, 1);
    f2.input.jump = true;
    run(world, 0.5);
    expect(f2.energy).toBe(100);
  });

  it('expires after its life', () => {
    const { world, f1 } = duel({ b: { pos: { x: 2, y: 0, z: 8 } } });
    runStep(world, f1, { ...shot, life: 0.2 }, f1, 1);
    world.projectiles[0].vel = { x: -14, z: 0 };
    run(world, 0.3);
    expect(world.projectiles).toHaveLength(0);
  });

  it('a piercing, returning projectile can hit twice', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { ...shot, damage: 14, life: 1.4, pierce: true, returning: true }, f1, 1);
    run(world, 1.5);
    expect(f2.energy).toBe(72);
  });

  it('homing projectiles curve toward the target', () => {
    const homing = duel({ b: { pos: { x: 6, y: 0, z: 0 } } });
    runStep(homing.world, homing.f1, { ...shot, speed: 10, size: 0.3, life: 2, homing: 3 }, homing.f1, 1);
    homing.f2.pos.z = 3;
    run(homing.world, 2);
    expect(homing.f2.energy).toBe(90);

    const straight = duel({ b: { pos: { x: 6, y: 0, z: 0 } } });
    runStep(straight.world, straight.f1, { ...shot, speed: 10, size: 0.3, life: 2 }, straight.f1, 1);
    straight.f2.pos.z = 3;
    run(straight.world, 2);
    expect(straight.f2.energy).toBe(100);
  });
});

describe('timed primitives', () => {
  it('dash hits once on contact then stops', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'dash', direction: 'forward', distance: 5, duration: 0.25, damage: 10, knockback: 3 }, f1, 1);
    run(world, 0.4);
    expect(f2.energy).toBe(90);
    expect(f1.dash).toBe(null);
  });

  it('leap lands on the opponent and bursts', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'leap', duration: 0.6, radius: 2, damage: 10 }, f1, 1);
    run(world, 0.7);
    expect(f1.leap).toBe(null);
    expect(f1.pos.y).toBe(0);
    expect(f2.energy).toBe(90);
  });

  it('shield runs its onEnd steps when it expires', () => {
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([shot], [{ type: 'shield', duration: 1, reduction: 1, onEnd: [{ type: 'burst', at: 'self', radius: 5, damage: 10 }] }]) } });
    tryUseAbility(world, f1, 'special');
    run(world, 0.9);
    expect(f2.energy).toBe(100);
    run(world, 0.2);
    expect(f1.shield).toBe(null);
    expect(f2.energy).toBe(90);
  });

  it('delayed target burst can be dodged by moving', () => {
    const step = { type: 'burst', at: 'target', delay: 0.5, radius: 1.5, damage: 10 };
    const { world, f1, f2 } = duel({ a: { weapon: weaponWith([step]) } });
    tryUseAbility(world, f1, 'basic');
    expect(world.events.some((e) => e.shape === 'warning')).toBe(true);
    f2.pos.x = 8;
    run(world, 0.6);
    expect(f2.energy).toBe(100);

    const hit = duel({ a: { weapon: weaponWith([step]) } });
    tryUseAbility(hit.world, hit.f1, 'basic');
    run(hit.world, 0.6);
    expect(hit.f2.energy).toBe(90);
  });

  it('zones slow and damage over time', () => {
    const { world, f1, f2 } = duel();
    runStep(world, f1, { type: 'zone', at: 'target', radius: 2, duration: 2, slow: 0.5, dps: 4 }, f1, 1);
    run(world, 1.2);
    expect(f2.energy).toBeCloseTo(94, 5);
    expect(f2.status.slowUntil).toBeGreaterThan(world.time);
    run(world, 1.5);
    expect(world.zones).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/simulation.test.js`
Expected: FAIL — cannot resolve `../src/logic/simulation.js`.

- [ ] **Step 4: Create `src/logic/movement.js`**

```js
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

  if (f.leap && !f.ko) {
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
```

- [ ] **Step 5: Create `src/logic/projectiles.js`**

```js
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
```

- [ ] **Step 6: Create `src/logic/simulation.js`**

Pets are added to this loop in Task 12. Create it now without pets:

```js
import { FIGHTER_RADIUS } from './constants.js';
import { dist2D, dirTo } from './vec.js';
import { tryUseAbility } from './abilities.js';
import { updateFighter } from './movement.js';
import { updateProjectiles, updateZones } from './projectiles.js';
import { runTimers } from './world.js';

export function stepWorld(world, dt) {
  world.time += dt;
  runTimers(world);
  for (const f of world.fighters) updateFighter(world, f, dt);
  separateFighters(world);
  for (const f of world.fighters) {
    if (f.input.attack) tryUseAbility(world, f, 'basic');
    if (f.input.special) tryUseAbility(world, f, 'special');
  }
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/simulation.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/logic/movement.js src/logic/projectiles.js src/logic/simulation.js tests/helpers.js tests/simulation.test.js
git commit -m "feat: add movement, projectiles, zones, simulation step"
```

---

### Task 12: Pet companions

**Files:**
- Create: `src/logic/pets.js`
- Modify: `src/logic/simulation.js` (call `updatePet`)
- Test: `tests/pets.test.js`

- [ ] **Step 1: Write the failing test `tests/pets.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createPet, PET_FIRST_DELAY } from '../src/logic/pets.js';
import { getPet } from '../src/data/pets.js';
import { duel, run } from './helpers.js';

function withPet(petId, opts) {
  const d = duel(opts);
  const pet = createPet(getPet(petId), d.f1, 0);
  d.world.pets.push(pet);
  return { ...d, pet };
}

describe('pets', () => {
  it('waits for its first timer, then strikes a nearby opponent', () => {
    const { world, f2 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    run(world, PET_FIRST_DELAY - 0.1);
    expect(f2.energy).toBe(100);
    run(world, 0.2);
    expect(f2.energy).toBe(96);
    expect(world.events.some((e) => e.type === 'petMove' && e.petId === 'biscuit')).toBe(true);
  });

  it('pet damage is credited to the owner and not level-scaled', () => {
    const { world, f1 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.damageMult = 3;
    run(world, PET_FIRST_DELAY + 0.1);
    const hit = world.events.find((e) => e.type === 'hit');
    expect(hit.attackerId).toBe('p1');
    expect(hit.damage).toBe(4);
  });

  it('does not strike when the opponent is out of range', () => {
    const { world, f2 } = withPet('biscuit', { a: { pos: { x: -10, y: 0, z: 0 } }, b: { pos: { x: 10, y: 0, z: 0 } } });
    run(world, 3);
    expect(f2.energy).toBe(100);
  });

  it('heal pet only heals when the owner is hurt', () => {
    const full = withPet('hops');
    run(full.world, PET_FIRST_DELAY + 0.1);
    expect(full.world.events.some((e) => e.type === 'petMove')).toBe(false);

    const hurt = withPet('hops');
    hurt.f1.energy = 50;
    run(hurt.world, PET_FIRST_DELAY + 0.1);
    expect(hurt.f1.energy).toBe(58);
  });

  it('Shelly guards the owner against exactly one hit', () => {
    const { world, f1 } = withPet('shelly');
    run(world, PET_FIRST_DELAY + 0.1);
    expect(f1.guardHits).toBe(1);
  });

  it('No Cooldowns makes the pet act every half second', () => {
    const { world, f1, pet } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.noCooldowns = true;
    run(world, PET_FIRST_DELAY + 0.05);
    expect(pet.nextAt).toBeCloseTo(world.time + 0.5, 1);
  });

  it('follows its owner', () => {
    const { world, f1, pet } = withPet('hoot', { b: { pos: { x: 8, y: 0, z: 0 } } });
    f1.input.moveZ = 1;
    run(world, 1);
    f1.input.moveZ = 0;
    run(world, 1);
    expect(Math.hypot(pet.pos.x - f1.pos.x, pet.pos.z - f1.pos.z)).toBeLessThan(2.5);
  });

  it('pets are not fighters and cannot be hurt', () => {
    const { world, pet } = withPet('hoot');
    expect(world.fighters).not.toContain(pet);
    expect(pet.energy).toBeUndefined();
  });

  it('stops helping when the owner is knocked out', () => {
    const { world, f1, f2 } = withPet('biscuit', { a: { pos: { x: -1.5, y: 0, z: 0 } }, b: { pos: { x: 1.5, y: 0, z: 0 } } });
    f1.ko = true;
    run(world, 3);
    expect(f2.energy).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pets.test.js`
Expected: FAIL — cannot resolve `../src/logic/pets.js`.

- [ ] **Step 3: Create `src/logic/pets.js`**

```js
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
```

- [ ] **Step 4: Wire pets into `src/logic/simulation.js`**

Add the import:

```js
import { updatePet } from './pets.js';
```

And in `stepWorld`, between the ability loop and `updateProjectiles(world, dt);`, add:

```js
  for (const pet of world.pets) updatePet(world, pet, dt);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/pets.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/logic/pets.js src/logic/simulation.js tests/pets.test.js
git commit -m "feat: add pet companions with timed helper moves"
```

---

### Task 13: Match flow and rewards

**Files:**
- Create: `src/logic/match.js`, `src/logic/rewards.js`
- Test: `tests/match.test.js`

- [ ] **Step 1: Write the failing test `tests/match.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  createMatch, stepMatch, matchResults, INTRO_TIME, ROUND_OVER_TIME, MAX_ROUNDS,
} from '../src/logic/match.js';
import { applyMatchRewards } from '../src/logic/rewards.js';
import { createSave } from '../src/logic/save.js';
import { DT, ROUND_TIME } from '../src/logic/constants.js';

const cfg = (characterId, petId = null) => ({ characterId, level: 1, tier: 1, petId });
const newMatch = (mode = '2p') => createMatch({ mode, p1: cfg('sparkle', 'biscuit'), p2: cfg('rex') });

function toFighting(m) {
  stepMatch(m, INTRO_TIME);
  expect(m.state).toBe('fighting');
}
function ko(m, index) {
  const f = m.world.fighters[index];
  f.energy = 0;
  f.ko = true;
  stepMatch(m, DT);
}

describe('match', () => {
  it('starts in the intro with fighters and pets', () => {
    const m = newMatch();
    expect(m.state).toBe('intro');
    expect(m.round).toBe(1);
    expect(m.timeLeft).toBe(ROUND_TIME);
    expect(m.world.fighters.map((f) => f.character.id)).toEqual(['sparkle', 'rex']);
    expect(m.world.pets).toHaveLength(1);
    expect(m.world.pets[0].ownerId).toBe('p1');
  });

  it('does not simulate during the intro', () => {
    const m = newMatch();
    m.world.fighters[0].input.moveX = 1;
    stepMatch(m, 1);
    expect(m.world.fighters[0].pos.x).toBe(-5);
  });

  it('a knockout wins the round', () => {
    const m = newMatch();
    toFighting(m);
    ko(m, 1);
    expect(m.state).toBe('roundOver');
    expect(m.roundWinner).toBe('p1');
    expect(m.wins).toEqual({ p1: 1, p2: 0 });
    expect(m.world.events.some((e) => e.type === 'roundOver')).toBe(true);
  });

  it('starts the next round with everything reset', () => {
    const m = newMatch();
    toFighting(m);
    ko(m, 1);
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.state).toBe('intro');
    expect(m.round).toBe(2);
    expect(m.world.fighters[1].energy).toBe(100);
    expect(m.world.fighters[1].ko).toBe(false);
    expect(m.world.projectiles).toEqual([]);
    expect(m.timeLeft).toBe(ROUND_TIME);
  });

  it('first to 2 rounds wins the match', () => {
    const m = newMatch();
    toFighting(m); ko(m, 1); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 1);
    expect(m.winner).toBe('p1');
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.state).toBe('matchOver');
    expect(m.world.events.some((e) => e.type === 'matchOver' && e.winner === 'p1')).toBe(true);
  });

  it('on timeout, more energy wins the round', () => {
    const m = newMatch();
    toFighting(m);
    m.world.fighters[0].energy = 40;
    m.world.fighters[1].energy = 70;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.roundWinner).toBe('p2');
  });

  it('a tie gives both a point and 2-2 goes to sudden death', () => {
    const m = newMatch();
    toFighting(m);
    m.wins = { p1: 1, p2: 1 };
    m.round = 3;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.roundWinner).toBe('tie');
    expect(m.wins).toEqual({ p1: 2, p2: 2 });
    expect(m.winner).toBe(null);
    stepMatch(m, ROUND_OVER_TIME);
    expect(m.round).toBe(4);
  });

  it('a double knockout is a tie', () => {
    const m = newMatch();
    toFighting(m);
    m.world.fighters[0].ko = true;
    ko(m, 1);
    expect(m.roundWinner).toBe('tie');
  });

  it('declares a draw if still tied at the round limit', () => {
    const m = newMatch();
    toFighting(m);
    m.wins = { p1: 1, p2: 1 };
    m.round = MAX_ROUNDS;
    m.timeLeft = DT / 2;
    stepMatch(m, DT);
    expect(m.winner).toBe('draw');
  });

  it('results include only Player 1 in Vs Computer', () => {
    const m = newMatch('cpu');
    toFighting(m); ko(m, 1); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 1);
    expect(matchResults(m)).toEqual([{ playerId: 'p1', characterId: 'sparkle', won: true, roundsWon: 2 }]);
  });

  it('results include both players in 2 Players', () => {
    const m = newMatch('2p');
    toFighting(m); ko(m, 0); stepMatch(m, ROUND_OVER_TIME);
    toFighting(m); ko(m, 0);
    expect(matchResults(m)).toEqual([
      { playerId: 'p1', characterId: 'sparkle', won: false, roundsWon: 0 },
      { playerId: 'p2', characterId: 'rex', won: true, roundsWon: 2 },
    ]);
  });
});

describe('rewards', () => {
  it('adds XP and coins to the save', () => {
    const { save, summary } = applyMatchRewards(createSave(), [
      { playerId: 'p1', characterId: 'sparkle', won: true, roundsWon: 2 },
    ]);
    expect(save.characters.sparkle).toEqual({ level: 4, xp: 28 });
    expect(save.coins).toBe(90);
    expect(summary).toEqual([{
      playerId: 'p1', characterId: 'sparkle', xpGained: 160, coinsGained: 40, fromLevel: 1, toLevel: 4, newTiers: [],
    }]);
  });

  it('applies both players, even with the same character', () => {
    const { save } = applyMatchRewards(createSave(), [
      { playerId: 'p1', characterId: 'rex', won: true, roundsWon: 2 },
      { playerId: 'p2', characterId: 'rex', won: false, roundsWon: 0 },
    ]);
    expect(save.coins).toBe(50 + 40 + 15);
    expect(save.characters.rex.level).toBe(6); // 160 XP → L4 (28 left), +75 → L6 (5 left)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/match.test.js`
Expected: FAIL — cannot resolve `../src/logic/match.js`.

- [ ] **Step 3: Create `src/logic/match.js`**

```js
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
```

- [ ] **Step 4: Create `src/logic/rewards.js`**

```js
import { addXp, matchRewards } from './progression.js';

// results: [{ playerId, characterId, won, roundsWon }] from matchResults()
export function applyMatchRewards(save, results) {
  const characters = { ...save.characters };
  let coins = save.coins;
  const summary = [];
  for (const r of results) {
    const reward = matchRewards(r);
    const before = characters[r.characterId];
    const after = addXp(before, reward.xp);
    characters[r.characterId] = { level: after.level, xp: after.xp };
    coins += reward.coins;
    summary.push({
      playerId: r.playerId,
      characterId: r.characterId,
      xpGained: reward.xp,
      coinsGained: reward.coins,
      fromLevel: before.level,
      toLevel: after.level,
      newTiers: after.newTiers,
    });
  }
  return { save: { ...save, characters, coins }, summary };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/match.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add src/logic/match.js src/logic/rewards.js tests/match.test.js
git commit -m "feat: add match rounds, win rules, and rewards"
```

---

### Task 14: Computer opponent (AI)

**Files:**
- Create: `src/logic/ai.js`
- Test: `tests/ai.test.js`

- [ ] **Step 1: Write the failing test `tests/ai.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  AI_SETTINGS, pickAIOpponent, createAI, updateAI, abilityReach, isSelfAbility, findIncomingProjectile,
} from '../src/logic/ai.js';
import { getCharacter } from '../src/data/characters.js';
import { getWeapon } from '../src/data/weapons.js';
import { runStep } from '../src/logic/abilities.js';
import { duel } from './helpers.js';

const always = (v) => () => v;

describe('pickAIOpponent', () => {
  it('scales level by difficulty and clamps 1-100', () => {
    expect(pickAIOpponent({ playerLevel: 5, difficulty: 'easy', playerHasPet: false, rng: always(0) }).level).toBe(1);
    expect(pickAIOpponent({ playerLevel: 30, difficulty: 'medium', playerHasPet: false, rng: always(0) }).level).toBe(30);
    expect(pickAIOpponent({ playerLevel: 98, difficulty: 'hard', playerHasPet: false, rng: always(0) }).level).toBe(100);
  });

  it('uses the highest tier for its level', () => {
    expect(pickAIOpponent({ playerLevel: 35, difficulty: 'medium', playerHasPet: false, rng: always(0) }).tier).toBe(4);
  });

  it('gets a pet only if the player has one', () => {
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: false, rng: always(0) }).petId).toBe(null);
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: true, rng: always(0) }).petId).toBe('biscuit');
  });

  it('picks a character from the rng', () => {
    expect(pickAIOpponent({ playerLevel: 1, difficulty: 'easy', playerHasPet: false, rng: always(0.99) }).characterId).toBe('rex');
  });
});

describe('ability helpers', () => {
  it('estimates reach', () => {
    expect(abilityReach(getWeapon('sparkle', 1).basic)).toBeCloseTo(2.5);
    expect(abilityReach(getWeapon('rex', 1).basic)).toBeCloseTo(16);
    expect(abilityReach(getWeapon('bubbles', 10).special)).toBe(15);
  });

  it('detects self abilities', () => {
    expect(isSelfAbility(getWeapon('bubbles', 6).special)).toBe(true); // heal
    expect(isSelfAbility(getWeapon('bubbles', 3).special)).toBe(true); // blink
    expect(isSelfAbility(getWeapon('sparkle', 1).special)).toBe(false);
  });
});

describe('updateAI', () => {
  const setup = (characterId, oppX) => duel({
    a: { character: getCharacter(characterId), weapon: getWeapon(characterId, 1), pos: { x: 0, y: 0, z: 0 } },
    b: { pos: { x: oppX, y: 0, z: 0 } },
  });

  it('walks toward a far opponent', () => {
    const { world, f1 } = setup('sparkle', 10);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.moveX).toBeGreaterThan(0);
    expect(f1.input.attack).toBe(false);
  });

  it('attacks when in reach', () => {
    const { world, f1 } = setup('rex', 5);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.attack).toBe(true);
  });

  it('backs away when a ranged fighter is too close', () => {
    const { world, f1 } = setup('bubbles', 2);
    updateAI(createAI('medium', always(0.5)), world, f1);
    expect(f1.input.moveX).toBeLessThan(0);
  });

  it('uses the special when ready and in reach', () => {
    const { world, f1 } = setup('rex', 3);
    updateAI(createAI('hard', always(0.5)), world, f1);
    expect(f1.input.special).toBe(true);
  });

  it('easy rarely uses specials', () => {
    const { world, f1 } = setup('rex', 3);
    updateAI(createAI('easy', always(0.5)), world, f1);
    expect(f1.input.special).toBe(false);
  });

  it('only re-thinks after its reaction time, and does not hold special/jump', () => {
    const { world, f1 } = setup('rex', 3);
    const ai = createAI('hard', always(0.5));
    updateAI(ai, world, f1);
    expect(ai.nextThinkAt).toBeCloseTo(AI_SETTINGS.hard.reaction);
    world.time = 0.01;
    updateAI(ai, world, f1);
    expect(f1.input.special).toBe(false);
    expect(f1.input.attack).toBe(true);
  });

  it('hard AI jumps over incoming projectiles', () => {
    const { world, f1, f2 } = setup('sparkle', 4);
    runStep(world, f2, { type: 'projectile', damage: 5, speed: 14, size: 0.3, life: 1 }, f2, 1);
    expect(findIncomingProjectile(world, f1)).not.toBe(null);
    updateAI(createAI('hard', always(0.1)), world, f1);
    expect(f1.input.jump).toBe(true);
  });

  it('does nothing when knocked out', () => {
    const { world, f1 } = setup('rex', 3);
    f1.ko = true;
    updateAI(createAI('hard', always(0.5)), world, f1);
    expect(f1.input).toEqual({ moveX: 0, moveZ: 0, jump: false, attack: false, special: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai.test.js`
Expected: FAIL — cannot resolve `../src/logic/ai.js`.

- [ ] **Step 3: Create `src/logic/ai.js`**

```js
import { FIGHTER_RADIUS } from './constants.js';
import { CHARACTER_IDS } from '../data/characters.js';
import { PET_IDS } from '../data/pets.js';
import { MAX_LEVEL, tierForLevel } from './progression.js';
import { dist2D, dirTo } from './vec.js';
import { opponentOf } from './world.js';

export const AI_SETTINGS = {
  easy: { reaction: 0.8, specialChance: 0.15, dodgeChance: 0, blocks: false, levelOffset: -10 },
  medium: { reaction: 0.45, specialChance: 0.6, dodgeChance: 0.1, blocks: false, levelOffset: 0 },
  hard: { reaction: 0.25, specialChance: 0.85, dodgeChance: 0.5, blocks: true, levelOffset: 5 },
};

const TARGETED_REACH = 15;
const IDLE_INPUT = { moveX: 0, moveZ: 0, jump: false, attack: false, special: false };

export function pickAIOpponent({ playerLevel, difficulty, playerHasPet, rng = Math.random }) {
  const level = Math.min(MAX_LEVEL, Math.max(1, playerLevel + AI_SETTINGS[difficulty].levelOffset));
  const characterId = CHARACTER_IDS[Math.floor(rng() * CHARACTER_IDS.length)];
  const petId = playerHasPet ? PET_IDS[Math.floor(rng() * PET_IDS.length)] : null;
  return { characterId, level, tier: tierForLevel(level), petId };
}

export function createAI(difficulty, rng = Math.random) {
  return { settings: AI_SETTINGS[difficulty], rng, nextThinkAt: 0, plan: { ...IDLE_INPUT }, strafe: 1 };
}

export function abilityReach(def) {
  let reach = 0;
  for (const s of def.steps) {
    let r = 0;
    if (s.type === 'melee') r = s.range + FIGHTER_RADIUS;
    else if (s.type === 'projectile') r = s.speed * s.life;
    else if (s.type === 'dash') r = s.distance;
    else if (s.type === 'burst' || s.type === 'zone') r = s.at === 'target' ? TARGETED_REACH : s.radius;
    else if (s.type === 'leap') r = TARGETED_REACH;
    else if (s.type === 'strike' || s.type === 'pull') r = s.range;
    reach = Math.max(reach, r);
  }
  return reach;
}

export function isSelfAbility(def) {
  return def.steps.every((s) => ['shield', 'heal', 'guard'].includes(s.type) || (s.type === 'dash' && s.direction === 'escape'));
}

export function findIncomingProjectile(world, f, radius = 4) {
  return world.projectiles.find((p) => p.ownerId !== f.id
    && dist2D(p.pos, f.pos) < radius
    && p.vel.x * (f.pos.x - p.pos.x) + p.vel.z * (f.pos.z - p.pos.z) > 0) ?? null;
}

export function updateAI(ai, world, me) {
  const now = world.time;
  if (now < ai.nextThinkAt) {
    me.input = { ...ai.plan, jump: false, special: false };
    return;
  }
  const { settings, rng } = ai;
  ai.nextThinkAt = now + settings.reaction * (0.7 + 0.6 * rng());
  const plan = { ...IDLE_INPUT };
  const opp = opponentOf(world, me);

  if (!opp || opp.ko || me.ko || !me.weapon) {
    ai.plan = plan;
    me.input = { ...plan };
    return;
  }

  const d = dist2D(me.pos, opp.pos);
  const to = dirTo(me.pos, opp.pos);
  const pref = me.character.preferredRange;
  if (rng() < 0.2) ai.strafe *= -1;

  if (d > pref + 1) {
    plan.moveX = to.x;
    plan.moveZ = to.z;
  } else if (d < pref - 1.5) {
    plan.moveX = -to.x;
    plan.moveZ = -to.z;
  } else {
    plan.moveX = -to.z * ai.strafe;
    plan.moveZ = to.x * ai.strafe;
  }

  plan.attack = d <= abilityReach(me.weapon.basic) + 0.3;

  const special = me.weapon.special;
  if (now >= me.cooldowns.special && rng() < settings.specialChance) {
    if (isSelfAbility(special)) {
      const hasHeal = special.steps.some((s) => s.type === 'heal');
      const hasShield = special.steps.some((s) => s.type === 'shield');
      if (hasHeal && me.energy < 60) plan.special = true;
      else if (hasShield && d < 4 && (settings.blocks || rng() < 0.3)) plan.special = true;
      else if (!hasHeal && !hasShield && d < 2.5) plan.special = true;
    } else if (d <= abilityReach(special) + 0.5) {
      plan.special = true;
    }
  }

  if (settings.dodgeChance > 0 && rng() < settings.dodgeChance && findIncomingProjectile(world, me)) {
    plan.jump = true;
  }

  ai.plan = plan;
  me.input = { ...plan };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ai.test.js`
Expected: PASS, 14 tests.

Note on the "hard AI jumps" test: with `rng` always `0.1`, `0.1 < 0.5` (dodge chance) passes. In the "easy rarely uses specials" test, `0.5 < 0.15` fails, so no special.

- [ ] **Step 5: Commit**

```bash
git add src/logic/ai.js tests/ai.test.js
git commit -m "feat: add computer opponent AI"
```

---

### Task 15: Training Ground session

**Files:**
- Create: `src/logic/training.js`
- Test: `tests/training.test.js`

- [ ] **Step 1: Write the failing test `tests/training.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  BOT_REFILL_DELAY, STATS_WINDOW, createTrainingSession, stepTraining, setOption, switchWeapon, damagePerSecond, resetStats,
} from '../src/logic/training.js';
import { DEFAULT_TRAINING_OPTIONS } from '../src/logic/save.js';
import { DT } from '../src/logic/constants.js';

function runTraining(session, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepTraining(session, DT);
}
const sparkle = (extra = {}) => createTrainingSession({ characterId: 'sparkle', level: 1, tier: 1, ...extra });

describe('training', () => {
  it('starts with default options, the player and a bot', () => {
    const s = sparkle();
    expect(s.options).toEqual(DEFAULT_TRAINING_OPTIONS);
    expect(s.world.fighters.map((f) => f.id)).toEqual(['p1', 'bot']);
    expect(s.world.fighters[1].weapon).toBe(null);
  });

  it('refuses locked weapon tiers', () => {
    expect(() => createTrainingSession({ characterId: 'sparkle', level: 5, tier: 2 })).toThrow();
    const s = sparkle();
    expect(() => switchWeapon(s, { characterId: 'rex', level: 1, tier: 3 })).toThrow();
  });

  it('tracks damage stats from player hits', () => {
    const s = sparkle();
    const [player, bot] = s.world.fighters;
    bot.pos.x = -2.5;
    player.input.attack = true;
    stepTraining(s, DT);
    expect(s.stats.last).toBeGreaterThan(0);
    expect(s.stats.total).toBeCloseTo(s.stats.last);
    expect(damagePerSecond(s)).toBeCloseTo(s.stats.total / STATS_WINDOW);
    resetStats(s);
    expect(s.stats).toEqual({ last: 0, total: 0, recent: [] });
  });

  it('counts pet damage in the stats', () => {
    const s = sparkle({ petId: 'hoot' });
    runTraining(s, 3);
    expect(s.stats.total).toBeGreaterThan(0);
  });

  it('the bot pops back with full energy after a knockout', () => {
    const s = sparkle();
    const bot = s.world.fighters[1];
    bot.energy = 0;
    bot.ko = true;
    runTraining(s, BOT_REFILL_DELAY + 0.1);
    expect(bot.ko).toBe(false);
    expect(bot.energy).toBe(100);
    expect(s.world.events.some((e) => e.type === 'botRefill')).toBe(true);
  });

  it('applies No Cooldowns and Infinite Energy to the player', () => {
    const s = sparkle();
    setOption(s, 'noCooldowns', true);
    setOption(s, 'infiniteEnergy', true);
    expect(s.world.fighters[0].noCooldowns).toBe(true);
    expect(s.world.fighters[0].infiniteEnergy).toBe(true);
  });

  it('block behavior raises a shield every few seconds', () => {
    const s = sparkle({ options: { botBehavior: 'block' } });
    runTraining(s, 2.1);
    expect(s.world.fighters[1].shield).not.toBe(null);
  });

  it('walk behavior moves the bot', () => {
    const s = sparkle({ options: { botBehavior: 'walk' } });
    const start = { ...s.world.fighters[1].pos };
    runTraining(s, 1);
    expect(s.world.fighters[1].pos).not.toEqual(start);
  });

  it('dodge behavior sidesteps incoming projectiles', () => {
    const s = createTrainingSession({ characterId: 'rex', level: 1, tier: 1, options: { botBehavior: 'dodge' } });
    const [player, bot] = s.world.fighters;
    player.input.attack = true;
    runTraining(s, 0.3);
    expect(Math.abs(bot.pos.z)).toBeGreaterThan(0);
  });

  it('switches weapons in place', () => {
    const s = sparkle();
    switchWeapon(s, { characterId: 'rex', level: 25, tier: 3 });
    const player = s.world.fighters[0];
    expect(player.character.id).toBe('rex');
    expect(player.weapon.name).toBe('Dart Launcher');
    expect(player.level).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training.test.js`
Expected: FAIL — cannot resolve `../src/logic/training.js`.

- [ ] **Step 3: Create `src/logic/training.js`**

```js
import { MAX_ENERGY } from './constants.js';
import { getCharacter } from '../data/characters.js';
import { getWeapon } from '../data/weapons.js';
import { getPet } from '../data/pets.js';
import { isTierUnlocked } from './progression.js';
import { DEFAULT_TRAINING_OPTIONS } from './save.js';
import { createFighter, setLoadout } from './fighter.js';
import { createPet } from './pets.js';
import { createWorld } from './world.js';
import { stepWorld } from './simulation.js';
import { dirTo } from './vec.js';
import { findIncomingProjectile } from './ai.js';

export const BOT_CHARACTER = {
  id: 'bot',
  name: 'Training Bot',
  speed: 0.6,
  damage: 0,
  defense: 1,
  preferredRange: 4,
  colors: { main: 0xffb703, accent: 0x8ecae6, alt: 0xffffff },
};
export const BOT_BEHAVIORS = ['still', 'walk', 'dodge', 'block'];
export const BOT_REFILL_DELAY = 2;
export const STATS_WINDOW = 5;
const BLOCK_EVERY = 4;
const BLOCK_DURATION = 1.5;
const WALK_RADIUS = 6;

function assertUnlocked(level, tier) {
  if (!isTierUnlocked(level, tier)) throw new Error(`Weapon tier ${tier} is locked at level ${level}`);
}

export function createTrainingSession({ characterId, level, tier, petId = null, options = {} }) {
  assertUnlocked(level, tier);
  const player = createFighter({
    id: 'p1', character: getCharacter(characterId), level, weapon: getWeapon(characterId, tier), pos: { x: -4, y: 0, z: 0 },
  });
  const bot = createFighter({ id: 'bot', character: BOT_CHARACTER, level: 1, weapon: null, pos: { x: 4, y: 0, z: 0 } });
  const world = createWorld([player, bot]);
  if (petId) world.pets.push(createPet(getPet(petId), player, 0));
  const session = {
    world,
    options: { ...DEFAULT_TRAINING_OPTIONS, ...options },
    stats: { last: 0, total: 0, recent: [] },
    botRefillAt: null,
    nextBlockAt: 2,
    walkAngle: 0,
  };
  applyOptions(session);
  return session;
}

function applyOptions(session) {
  const player = session.world.fighters[0];
  player.noCooldowns = session.options.noCooldowns;
  player.infiniteEnergy = session.options.infiniteEnergy;
}

export function setOption(session, key, value) {
  session.options[key] = value;
  applyOptions(session);
}

export function switchWeapon(session, { characterId, level, tier }) {
  assertUnlocked(level, tier);
  setLoadout(session.world.fighters[0], { character: getCharacter(characterId), level, weapon: getWeapon(characterId, tier) });
}

export function resetStats(session) {
  session.stats = { last: 0, total: 0, recent: [] };
}

export function damagePerSecond(session) {
  return session.stats.recent.reduce((sum, h) => sum + h.damage, 0) / STATS_WINDOW;
}

export function stepTraining(session, dt) {
  const { world, stats } = session;
  const bot = world.fighters[1];
  updateBot(session, bot, dt);

  const firstNew = world.events.length;
  stepWorld(world, dt);
  for (let i = firstNew; i < world.events.length; i++) {
    const e = world.events[i];
    if (e.type === 'hit' && e.attackerId === 'p1') {
      stats.last = e.damage;
      stats.total += e.damage;
      stats.recent.push({ time: world.time, damage: e.damage });
    }
  }
  stats.recent = stats.recent.filter((h) => h.time > world.time - STATS_WINDOW);

  if (bot.ko && session.botRefillAt === null) session.botRefillAt = world.time + BOT_REFILL_DELAY;
  if (session.botRefillAt !== null && world.time >= session.botRefillAt) {
    bot.ko = false;
    bot.energy = MAX_ENERGY;
    session.botRefillAt = null;
    world.events.push({ type: 'botRefill' });
  }
}

function updateBot(session, bot, dt) {
  const { world } = session;
  bot.input = { moveX: 0, moveZ: 0, jump: false, attack: false, special: false };
  if (bot.ko) return;
  switch (session.options.botBehavior) {
    case 'walk': {
      session.walkAngle += dt * 0.6;
      const target = { x: Math.cos(session.walkAngle) * WALK_RADIUS, z: Math.sin(session.walkAngle) * WALK_RADIUS };
      const d = dirTo(bot.pos, target);
      bot.input.moveX = d.x;
      bot.input.moveZ = d.z;
      break;
    }
    case 'dodge': {
      const p = findIncomingProjectile(world, bot, 5);
      if (p) {
        bot.input.moveX = -p.vel.z;
        bot.input.moveZ = p.vel.x;
      }
      break;
    }
    case 'block':
      if (world.time >= session.nextBlockAt) {
        bot.shield = { until: world.time + BLOCK_DURATION, reduction: 1, onEnd: null };
        world.events.push({ type: 'shield', fighterId: bot.id, duration: BLOCK_DURATION, reduction: 1 });
        session.nextBlockAt = world.time + BLOCK_EVERY;
      }
      break;
    default:
      break;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/training.js tests/training.test.js
git commit -m "feat: add Training Ground session logic"
```

---

### Task 16: Headless AI-vs-AI smoke test

**Files:**
- Test: `tests/headless.test.js`

- [ ] **Step 1: Write the test `tests/headless.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CHARACTER_IDS } from '../src/data/characters.js';
import { PET_IDS } from '../src/data/pets.js';
import { createMatch, stepMatch } from '../src/logic/match.js';
import { createAI, updateAI } from '../src/logic/ai.js';
import { drainEvents } from '../src/logic/world.js';
import { mulberry32 } from '../src/logic/random.js';
import { DT } from '../src/logic/constants.js';

const MAX_STEPS = 40000;

function playMatch({ c1, c2, level, tier, pet1, pet2, seed }) {
  const match = createMatch({
    mode: 'cpu',
    p1: { characterId: c1, level, tier, petId: pet1 },
    p2: { characterId: c2, level, tier, petId: pet2 },
  });
  const rng = mulberry32(seed);
  const ai1 = createAI('hard', rng);
  const ai2 = createAI('medium', rng);
  const [f1, f2] = match.world.fighters;
  let hits = 0;
  for (let i = 0; i < MAX_STEPS && match.state !== 'matchOver'; i++) {
    updateAI(ai1, match.world, f1);
    updateAI(ai2, match.world, f2);
    stepMatch(match, DT);
    for (const f of match.world.fighters) {
      if (!Number.isFinite(f.pos.x) || !Number.isFinite(f.pos.z) || !Number.isFinite(f.energy)) {
        throw new Error(`Bad fighter state: ${JSON.stringify(f.pos)} energy ${f.energy}`);
      }
    }
    hits += drainEvents(match.world).filter((e) => e.type === 'hit').length;
  }
  return { match, hits };
}

describe('headless AI vs AI', () => {
  for (const [level, tier] of [[1, 1], [50, 6], [100, 11]]) {
    for (const c1 of CHARACTER_IDS) {
      for (const c2 of CHARACTER_IDS) {
        it(`${c1} vs ${c2} at level ${level} finishes with a result`, () => {
          const seed = level * 100 + CHARACTER_IDS.indexOf(c1) * 10 + CHARACTER_IDS.indexOf(c2);
          const pet1 = PET_IDS[seed % PET_IDS.length];
          const pet2 = PET_IDS[(seed + 3) % PET_IDS.length];
          const { match, hits } = playMatch({ c1, c2, level, tier, pet1, pet2, seed });
          expect(match.state).toBe('matchOver');
          expect(['p1', 'p2', 'draw']).toContain(match.winner);
          expect(hits).toBeGreaterThan(0);
        });
      }
    }
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/headless.test.js`
Expected: PASS, 48 tests. If any match fails to finish or produces NaN, use superpowers:systematic-debugging to find the root cause in the logic modules before changing anything.

- [ ] **Step 3: Run the full suite and build**

Run: `npm test && npx vite build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 4: Remove the scaffold smoke test**

```bash
git rm tests/smoke.test.js
```

- [ ] **Step 5: Commit**

```bash
git add tests/headless.test.js
git commit -m "test: add headless AI-vs-AI match smoke test"
```

---

## Done criteria for Plan 1

- `npm test` passes: data validation, progression, save, shop, fighter, combat, abilities, simulation, pets, match, rewards, AI, training, and 48 headless matches.
- `npx vite build` succeeds.
- No file in `src/logic/` or `src/data/` imports Three.js or touches the DOM.

Next: write Plan 2 (Playable battle) against the real code from this plan.
