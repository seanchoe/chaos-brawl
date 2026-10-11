# Chaos Brawl — Plan 2: Playable Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Chaos Brawl playable in the browser: a 3D arena with cartoon fighters, every weapon and projectile visible, pop-ups and confetti, keyboard controls for 1 or 2 players, a battle HUD, pause, a results screen, a quick-start screen, and fairer character balance.

**Architecture:** The Plan 1 engine (`src/logic`, `src/data`) stays headless and is the source of truth. New code reads engine state and never changes game rules (the one exception is the balance tuning in Task 13).
- `src/render/` turns world state into Three.js objects. Data tables and math are pure. Model builders use Three.js only, so they run in Node tests.
- `src/input/` turns key presses into engine `input` objects.
- `src/game/` holds the fixed-timestep loop and the battle controller. These are pure and testable. It also holds `battleScreen.js`, which wires everything together.
- `src/ui/` holds the DOM overlays: HUD, quick start, messages and CSS.

**Tech Stack:** JavaScript ES modules, Three.js, Vite, Vitest. DOM tests use jsdom via a `// @vitest-environment jsdom` comment at the top of the test file.

**Spec:** `docs/superpowers/specs/2026-10-11-chaos-brawl-design.md`
**Roadmap and carry-over notes:** `docs/superpowers/plans/2026-10-11-chaos-brawl-roadmap.md`

---

## Engine facts this plan relies on (from Plan 1 code)

- `createMatch({ mode: 'cpu'|'2p', p1, p2 })`, where each player is `{ characterId, level, tier, petId }`. `stepMatch(match, dt)` advances it.
- Match fields:
  - `state`: one of `'intro' | 'fighting' | 'roundOver' | 'matchOver'`
  - `stateTime`, `timeLeft`, `round`
  - `wins: { p1, p2 }`
  - `roundWinner`: `'p1' | 'p2' | 'tie'`
  - `winner`: `'p1' | 'p2' | 'draw' | null`
  - `mode`, `config`
  - `world`
- `world.fighters` is `[p1, p2]`. Each fighter has:
  - `id`, `character` (`id`, `name`, `colors{main, accent, alt}`), `level`, `weapon` (`name`, `tier`, `characterId`, `basic`, `special`), `energy`, `ko`
  - position and motion: `pos{x, y, z}`, `facing`, `input`, `dash`, `leap`
  - protection: `shield{until, reduction}`, `guardHits`
  - status: `status{slowUntil, freezeUntil, stunUntil}`, `cooldowns`
- Other world contents:
  - `world.projectiles`: `{ id, style, size, pos{x, y, z}, vel{x, z} }`
  - `world.zones`: `{ id, style, radius, pos, until }`
  - `world.pets`: unused in this plan; Plan 5 renders pets.
  - `world.time`
- `drainEvents(world)` returns and clears these events:
  - `ability{fighterId, slot, name}`, `hit{targetId, attackerId, damage, dealt, popup, pos}`, `blocked{targetId, pos, popup}`, `heal{targetId, amount, pos}`, `ko{targetId}`
  - `status{targetId, status}`, `shape{shape: 'arc'|'circle'|'warning', pos, radius, duration}`, `blink{fighterId}`
  - `fight`, `roundOver`, `matchOver`
- `cooldownFraction(f, slot, now)` returns a value in [0, 1].
- `createAI(difficulty, rng)` and `updateAI(ai, world, f)` set the AI's `f.input`. `pickAIOpponent({ playerLevel, difficulty, playerHasPet, rng })` picks a CPU opponent.
- Coordinates: x and z are the ground and y is up. Facing angle θ means forward is `(cos θ, sin θ)` in x/z. The arena radius is 12.
- Camera convention for this plan: the camera sits on the **+z side** looking toward −z. Screen right is +x, and the W key moves "away from the camera", which is −z.

## File structure

```
src/render/math.js            facing→rotation, camera framing, smoothing (pure)
src/render/weaponVisuals.js   44 weapon looks (pure data)
src/render/projectileVisuals.js projectile/zone looks (pure data)
src/render/models.js          fighter/weapon/status/projectile/zone meshes from primitives
src/render/arena.js           floating island arena + lights
src/render/view.js            syncs world state → scene objects; reacts to events
src/render/effects.js         particles + DOM pop-up text
src/render/renderer.js        WebGL check, renderer/scene/camera/resize
src/input/keyboard.js         key bindings, key state → engine input
src/game/loop.js              fixed-timestep loop with pause + tab-hidden auto-pause
src/game/battleController.js  match + AI + inputs + pause (pure)
src/game/battleScreen.js      wires renderer/view/effects/HUD/keyboard/loop/overlays
src/ui/hud.js                 HUD state (pure) + DOM HUD
src/ui/quickstart.js          quick-start screen (mode, difficulty, characters, test weapon tier)
src/ui/messages.js            full-screen friendly message (e.g. no WebGL)
src/ui/styles.css             all styles
src/main.js                   boot (replaces placeholder)
tools/balance.js              AI-vs-AI win-rate measurement (used by test + report)
tools/balance-report.mjs      prints the win-rate table
tests/render/*.test.js, tests/game/*.test.js, tests/ui/*.test.js, tests/input/*.test.js, tests/balance.test.js
```

---

### Task 1: Dependencies and render math

**Files:**
- Modify: `package.json` (dependencies)
- Create: `src/render/math.js`
- Test: `tests/render/math.test.js`

- [ ] **Step 1: Install Three.js and jsdom**

Run: `npm install three && npm install --save-dev jsdom`
Expected: `three` in `dependencies`, `jsdom` in `devDependencies`.

- [ ] **Step 2: Write the failing test `tests/render/math.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { facingToRotationY, computeCamera, smoothToward, CAMERA } from '../../src/render/math.js';
import { forward } from '../../src/logic/vec.js';

describe('facingToRotationY', () => {
  for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    it(`turns a +z-facing model to the logic forward for facing ${facing.toFixed(2)}`, () => {
      const obj = new THREE.Object3D();
      obj.rotation.y = facingToRotationY(facing);
      const dir = obj.getWorldDirection(new THREE.Vector3());
      const f = forward(facing);
      expect(dir.x).toBeCloseTo(f.x);
      expect(dir.z).toBeCloseTo(f.z);
    });
  }
});

describe('computeCamera', () => {
  it('looks at the midpoint from the +z side', () => {
    const c = computeCamera({ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(c.target).toEqual({ x: 0, y: CAMERA.lookHeight, z: 0 });
    expect(c.position.x).toBe(0);
    expect(c.position.z).toBeCloseTo(17);
    expect(c.position.y).toBeCloseTo(17 * CAMERA.height);
  });

  it('clamps the distance', () => {
    expect(computeCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).position.z).toBeCloseTo(CAMERA.minDistance);
    expect(computeCamera({ x: -12, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }).position.z).toBeCloseTo(CAMERA.maxDistance);
  });

  it('follows fighters that move in z', () => {
    const c = computeCamera({ x: 0, y: 0, z: -4 }, { x: 0, y: 0, z: -2 });
    expect(c.target.z).toBe(-3);
    expect(c.position.z).toBeGreaterThan(c.target.z);
  });
});

describe('smoothToward', () => {
  it('moves part of the way, more with more time', () => {
    expect(smoothToward(0, 10, 3, 0)).toBe(0);
    expect(smoothToward(0, 10, 3, 1)).toBeCloseTo(10 * (1 - Math.exp(-3)));
    expect(smoothToward(0, 10, 3, 100)).toBeCloseTo(10);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/render/math.test.js`
Expected: FAIL — cannot resolve `../../src/render/math.js`.

- [ ] **Step 4: Create `src/render/math.js`**

```js
// Models are built facing +z. Logic facing θ points along (cos θ, sin θ) in x/z.
export function facingToRotationY(facing) {
  return Math.PI / 2 - facing;
}

export const CAMERA = {
  minDistance: 11,
  maxDistance: 24,
  baseDistance: 8,
  spreadFactor: 0.9,
  height: 0.55,
  lookHeight: 1.2,
  smoothing: 3,
};

// Frame both fighters from the front (+z side). Returns plain objects.
export function computeCamera(a, b) {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const spread = Math.hypot(a.x - b.x, a.z - b.z);
  const distance = Math.min(
    CAMERA.maxDistance,
    Math.max(CAMERA.minDistance, CAMERA.baseDistance + spread * CAMERA.spreadFactor),
  );
  return {
    position: { x: mid.x, y: distance * CAMERA.height, z: mid.z + distance },
    target: { x: mid.x, y: CAMERA.lookHeight, z: mid.z },
  };
}

export function smoothToward(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/math.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/render/math.js tests/render/math.test.js
git commit -m "feat: add three.js and render math helpers"
```

---

### Task 2: Fixed-timestep game loop

**Files:**
- Create: `src/game/loop.js`
- Test: `tests/game/loop.test.js`

- [ ] **Step 1: Write the failing test `tests/game/loop.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { advanceClock, createLoop, MAX_FRAME } from '../../src/game/loop.js';

const DT = 1 / 60;

describe('advanceClock', () => {
  it('turns frame time into whole steps', () => {
    expect(advanceClock(0, 1 / 30, DT).steps).toBe(2);
    const r = advanceClock(0.01, 0.01, DT);
    expect(r.steps).toBe(1);
    expect(r.accumulator).toBeCloseTo(0.02 - DT);
  });

  it('clamps long frames so nothing teleports', () => {
    const { steps } = advanceClock(0, 5, DT);
    expect(steps).toBeGreaterThanOrEqual(Math.floor(MAX_FRAME / DT) - 1);
    expect(steps).toBeLessThanOrEqual(Math.floor(MAX_FRAME / DT));
  });

  it('ignores negative time', () => {
    expect(advanceClock(0, -1, DT)).toEqual({ steps: 0, accumulator: 0 });
  });
});

function fakeEnv() {
  const callbacks = [];
  const doc = new EventTarget();
  doc.hidden = false;
  return { callbacks, doc, raf: (cb) => { callbacks.push(cb); return callbacks.length; } };
}

describe('createLoop', () => {
  it('runs fixed steps and renders every frame', () => {
    const env = fakeEnv();
    let steps = 0;
    const renders = [];
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: (s, paused) => renders.push([s, paused]), raf: env.raf, now: () => 0, doc: env.doc });
    loop.start();
    env.callbacks.shift()(1000 / 30);
    expect(steps).toBe(2);
    expect(renders).toHaveLength(1);
    expect(renders[0][0]).toBeCloseTo(1 / 30);
    expect(renders[0][1]).toBe(false);
    expect(env.callbacks).toHaveLength(1);
  });

  it('does not step while paused but still renders', () => {
    const env = fakeEnv();
    let steps = 0;
    const changes = [];
    let lastPaused = null;
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: (s, p) => { lastPaused = p; }, raf: env.raf, now: () => 0, doc: env.doc, onPauseChange: (p) => changes.push(p) });
    loop.start();
    loop.pause();
    env.callbacks.shift()(100);
    expect(steps).toBe(0);
    expect(lastPaused).toBe(true);
    loop.resume();
    expect(changes).toEqual([true, false]);
    env.callbacks.shift()(100 + 1000 / 30);
    expect(steps).toBe(2);
  });

  it('auto-pauses when the tab is hidden', () => {
    const env = fakeEnv();
    const changes = [];
    const loop = createLoop({ dt: DT, step: () => {}, render: () => {}, raf: env.raf, now: () => 0, doc: env.doc, onPauseChange: (p) => changes.push(p) });
    loop.start();
    env.doc.hidden = true;
    env.doc.dispatchEvent(new Event('visibilitychange'));
    expect(loop.paused).toBe(true);
    expect(changes).toEqual([true]);
  });

  it('stops scheduling frames after stop', () => {
    const env = fakeEnv();
    let steps = 0;
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: () => {}, raf: env.raf, now: () => 0, doc: env.doc });
    loop.start();
    loop.stop();
    env.callbacks.shift()(1000);
    expect(steps).toBe(0);
    expect(env.callbacks).toHaveLength(0);
    expect(loop.running).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/loop.test.js`
Expected: FAIL — cannot resolve `../../src/game/loop.js`.

- [ ] **Step 3: Create `src/game/loop.js`**

```js
export const MAX_FRAME = 0.25;

export function advanceClock(accumulator, frameSeconds, dt) {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
  let steps = 0;
  while (acc >= dt) {
    acc -= dt;
    steps += 1;
  }
  return { steps, accumulator: acc };
}

// step(dt) runs at a fixed rate; render(frameSeconds, paused) runs once per animation frame.
export function createLoop({
  step,
  render,
  dt,
  onPauseChange = () => {},
  raf = (cb) => globalThis.requestAnimationFrame(cb),
  now = () => globalThis.performance.now(),
  doc = globalThis.document,
}) {
  let running = false;
  let paused = false;
  let accumulator = 0;
  let last = 0;

  function frame(t) {
    if (!running) return;
    const seconds = Math.min(Math.max((t - last) / 1000, 0), MAX_FRAME);
    last = t;
    if (!paused) {
      const r = advanceClock(accumulator, seconds, dt);
      accumulator = r.accumulator;
      for (let i = 0; i < r.steps; i++) step(dt);
    }
    render(seconds, paused);
    raf(frame);
  }

  function onVisibility() {
    if (doc.hidden && !paused) loop.pause();
  }

  const loop = {
    start() {
      if (running) return;
      running = true;
      accumulator = 0;
      last = now();
      doc?.addEventListener('visibilitychange', onVisibility);
      raf(frame);
    },
    stop() {
      running = false;
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
    pause() {
      if (paused) return;
      paused = true;
      onPauseChange(true);
    },
    resume() {
      if (!paused) return;
      paused = false;
      accumulator = 0;
      onPauseChange(false);
    },
    get paused() { return paused; },
    get running() { return running; },
  };
  return loop;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/loop.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/loop.js tests/game/loop.test.js
git commit -m "feat: add fixed-timestep loop with pause and auto-pause"
```

---

### Task 3: Keyboard input

**Files:**
- Create: `src/input/keyboard.js`
- Test: `tests/input/keyboard.test.js`

- [ ] **Step 1: Write the failing test `tests/input/keyboard.test.js`**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BINDINGS, readInput, createKeyboard, keyLabel } from '../../src/input/keyboard.js';

const press = (target, code, type = 'keydown', extra = {}) => {
  const e = new KeyboardEvent(type, { code, cancelable: true, ...extra });
  target.dispatchEvent(e);
  return e;
};

describe('readInput', () => {
  it('maps P1 keys to engine input (W is away from the camera = -z)', () => {
    const down = new Set(['KeyW', 'KeyD', 'KeyF']);
    expect(readInput(down, BINDINGS.p1)).toEqual({ moveX: 1, moveZ: -1, jump: false, attack: true, special: false });
  });

  it('opposite keys cancel out', () => {
    expect(readInput(new Set(['ArrowLeft', 'ArrowRight', 'Enter', 'KeyL']), BINDINGS.p2))
      .toEqual({ moveX: 0, moveZ: 0, jump: true, attack: false, special: true });
  });
});

describe('createKeyboard', () => {
  it('tracks key presses and stops game keys from scrolling the page', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    const e = press(target, 'ArrowUp');
    expect(e.defaultPrevented).toBe(true);
    expect(kb.input('p2').moveZ).toBe(-1);
    press(target, 'ArrowUp', 'keyup');
    expect(kb.input('p2').moveZ).toBe(0);
  });

  it('does not block non-game keys', () => {
    const target = new EventTarget();
    createKeyboard(target);
    expect(press(target, 'KeyQ').defaultPrevented).toBe(false);
  });

  it('reports a key press only once', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    press(target, 'Escape');
    press(target, 'Escape', 'keydown', { repeat: true });
    expect(kb.consumePress('Escape')).toBe(true);
    expect(kb.consumePress('Escape')).toBe(false);
  });

  it('forgets held keys when the window loses focus', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    press(target, 'KeyA');
    target.dispatchEvent(new Event('blur'));
    expect(kb.input('p1').moveX).toBe(0);
  });

  it('stops listening after dispose', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    kb.dispose();
    press(target, 'KeyD');
    expect(kb.input('p1').moveX).toBe(0);
  });
});

describe('keyLabel', () => {
  it('gives short friendly labels', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Enter')).toBe('Enter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/input/keyboard.test.js`
Expected: FAIL — cannot resolve `../../src/input/keyboard.js`.

- [ ] **Step 3: Create `src/input/keyboard.js`**

```js
export const BINDINGS = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', attack: 'KeyF', special: 'KeyG' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'Enter', attack: 'KeyK', special: 'KeyL' },
};

const GAME_KEYS = new Set(Object.values(BINDINGS).flatMap((b) => Object.values(b)));

const LABELS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', Escape: 'Esc' };

export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  return LABELS[code] ?? code;
}

export function readInput(down, b) {
  return {
    moveX: (down.has(b.right) ? 1 : 0) - (down.has(b.left) ? 1 : 0),
    moveZ: (down.has(b.down) ? 1 : 0) - (down.has(b.up) ? 1 : 0),
    jump: down.has(b.jump),
    attack: down.has(b.attack),
    special: down.has(b.special),
  };
}

export function createKeyboard(target = globalThis.window) {
  const down = new Set();
  const pressed = new Set();

  const onDown = (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  };
  const onUp = (e) => { down.delete(e.code); };
  const onBlur = () => { down.clear(); };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  return {
    input(player) {
      return readInput(down, BINDINGS[player]);
    },
    consumePress(code) {
      const had = pressed.has(code);
      pressed.delete(code);
      return had;
    },
    clearPresses() {
      pressed.clear();
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
      pressed.clear();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/input/keyboard.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/input/keyboard.js tests/input/keyboard.test.js
git commit -m "feat: add keyboard bindings and input reading"
```

---

### Task 4: Visual data tables (weapons, projectiles, zones)

**Files:**
- Create: `src/render/weaponVisuals.js`, `src/render/projectileVisuals.js`
- Test: `tests/render/visuals.test.js`

- [ ] **Step 1: Write the failing test `tests/render/visuals.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CHARACTER_IDS } from '../../src/data/characters.js';
import { getWeaponLine } from '../../src/data/weapons.js';
import { PETS } from '../../src/data/pets.js';
import { weaponVisual, WEAPON_HEADS } from '../../src/render/weaponVisuals.js';
import { projectileVisual, zoneVisual, PROJECTILE_SHAPES, PROJECTILE_STYLES } from '../../src/render/projectileVisuals.js';

function allSteps() {
  const steps = [];
  const add = (list) => {
    for (const s of list) {
      steps.push(s);
      if (s.onEnd) add(s.onEnd);
    }
  };
  for (const id of CHARACTER_IDS) {
    for (const w of getWeaponLine(id)) {
      add(w.basic.steps);
      add(w.special.steps);
    }
  }
  for (const p of PETS) add(p.move.steps);
  return steps;
}

describe('weapon visuals', () => {
  it('gives every weapon a known head and a unique color within its line', () => {
    for (const id of CHARACTER_IDS) {
      const colors = new Set();
      for (let tier = 1; tier <= 11; tier++) {
        const v = weaponVisual(id, tier);
        expect(WEAPON_HEADS).toContain(v.head);
        expect(typeof v.color).toBe('number');
        colors.add(v.color);
      }
      expect(colors.size).toBe(11);
    }
  });

  it('grows and glows at higher tiers', () => {
    expect(weaponVisual('sparkle', 11).scale).toBeGreaterThan(weaponVisual('sparkle', 1).scale);
    expect(weaponVisual('sparkle', 5).glow).toBe(false);
    expect(weaponVisual('sparkle', 6).glow).toBe(true);
    expect(weaponVisual('rex', 11).sparkle).toBe(true);
  });

  it('throws for unknown weapons', () => {
    expect(() => weaponVisual('nobody', 1)).toThrow();
    expect(() => weaponVisual('sparkle', 12)).toThrow();
  });
});

describe('projectile and zone visuals', () => {
  it('has a visual for every projectile style used in the data', () => {
    const styles = new Set(allSteps().filter((s) => s.type === 'projectile').map((s) => s.style ?? 'ball'));
    for (const style of styles) {
      expect(PROJECTILE_STYLES, style).toContain(style);
      expect(PROJECTILE_SHAPES).toContain(projectileVisual(style).shape);
    }
  });

  it('falls back to a plain ball', () => {
    expect(projectileVisual('mystery')).toEqual(projectileVisual('ball'));
  });

  it('has a visual for every zone style used in the data', () => {
    const styles = new Set(allSteps().filter((s) => s.type === 'zone').map((s) => s.style ?? 'zone'));
    for (const style of styles) expect(typeof zoneVisual(style).color).toBe('number');
    expect(zoneVisual('mystery')).toEqual(zoneVisual('zone'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/visuals.test.js`
Expected: FAIL — cannot resolve `../../src/render/weaponVisuals.js`.

- [ ] **Step 3: Create `src/render/weaponVisuals.js`**

```js
import { TIER_COUNT } from '../logic/progression.js';

export const WEAPON_HEADS = ['blade', 'orb', 'spatula', 'pan', 'pin', 'tube', 'scoop', 'disc', 'whisk', 'blaster', 'tank', 'magnet', 'shield'];

// One entry per tier (index 0 = tier 1). Heads pick the mesh builder in models.js.
const LINES = {
  sparkle: {
    heads: ['blade', 'blade', 'blade', 'blade', 'blade', 'blade', 'blade', 'blade', 'blade', 'blade', 'blade'],
    colors: [0xffc9de, 0xc8a165, 0xdee2e6, 0xff9de2, 0xffe066, 0xa5d8ff, 0xff6b6b, 0xb197fc, 0xffa94d, 0xe5dbff, 0xff8fc7],
  },
  bubbles: {
    heads: ['orb', 'orb', 'orb', 'orb', 'orb', 'orb', 'orb', 'orb', 'orb', 'orb', 'orb'],
    colors: [0x99e9f2, 0x74c0fc, 0xf783ac, 0xd0ebff, 0xffd43b, 0x8ce99a, 0xfff3bf, 0x868e96, 0xff922b, 0xffec99, 0x7048e8],
  },
  pancake: {
    heads: ['spatula', 'pan', 'pin', 'tube', 'scoop', 'disc', 'tube', 'tube', 'tube', 'pan', 'whisk'],
    colors: [0xadb5bd, 0x495057, 0xd9a066, 0xfff0f6, 0xffc9de, 0xffd43b, 0xff8cc6, 0xf783ac, 0xfa5252, 0x343a40, 0xfcc419],
  },
  rex: {
    heads: ['blaster', 'tank', 'blaster', 'magnet', 'blaster', 'tube', 'blaster', 'tube', 'shield', 'tube', 'tube'],
    colors: [0x4dabf7, 0x339af0, 0xff922b, 0xe03131, 0x51cf66, 0x94d82d, 0x66d9e8, 0x845ef7, 0xadb5bd, 0xfab005, 0xfff3bf],
  },
};

export function weaponVisual(characterId, tier) {
  const line = LINES[characterId];
  if (!line) throw new Error(`No weapon visuals for ${characterId}`);
  if (!Number.isInteger(tier) || tier < 1 || tier > TIER_COUNT) throw new Error(`Bad weapon tier ${tier}`);
  return {
    head: line.heads[tier - 1],
    color: line.colors[tier - 1],
    scale: 1 + (tier - 1) * 0.05,
    glow: tier >= 6,
    sparkle: tier === TIER_COUNT,
  };
}
```

- [ ] **Step 4: Create `src/render/projectileVisuals.js`**

```js
export const PROJECTILE_SHAPES = ['sphere', 'disc', 'ring', 'cone', 'funnel', 'rod', 'box'];

// opacity < 1 makes it see-through; glow adds emissive; spin spins it; rainbow cycles hue.
const PROJECTILES = {
  ball: { shape: 'sphere', color: 0xffffff },
  bubble: { shape: 'sphere', color: 0x8ce9ff, opacity: 0.6 },
  bigBubble: { shape: 'sphere', color: 0x74c0fc, opacity: 0.55 },
  galaxy: { shape: 'sphere', color: 0x5f3dc4, glow: true, opacity: 0.8 },
  wave: { shape: 'ring', color: 0xffc9f5, glow: true },
  frost: { shape: 'ring', color: 0xa5d8ff, glow: true },
  moon: { shape: 'ring', color: 0xfff3bf, glow: true },
  rainbow: { shape: 'ring', color: 0xff6bd6, glow: true, rainbow: true },
  snowball: { shape: 'sphere', color: 0xffffff },
  lightning: { shape: 'rod', color: 0xffe066, glow: true },
  laser: { shape: 'rod', color: 0xff4d6d, glow: true },
  freezeRay: { shape: 'rod', color: 0x99e9f2, glow: true },
  dart: { shape: 'rod', color: 0xff922b },
  rocket: { shape: 'cone', color: 0xff6b6b },
  tornado: { shape: 'funnel', color: 0xced4da, opacity: 0.8, spin: true },
  firebird: { shape: 'cone', color: 0xff7f11, glow: true },
  nova: { shape: 'sphere', color: 0xfff3bf, glow: true },
  pancake: { shape: 'disc', color: 0xf4c27a, spin: true },
  pie: { shape: 'disc', color: 0xfff0f6 },
  pizza: { shape: 'disc', color: 0xffd43b, spin: true },
  iceCream: { shape: 'sphere', color: 0xffc9de },
  cupcake: { shape: 'cone', color: 0xf783ac },
  sprinkle: { shape: 'box', color: 0xff6bd6, rainbow: true },
  feather: { shape: 'cone', color: 0xd9c2a7 },
  puffball: { shape: 'sphere', color: 0xff8787, glow: true },
};

export const PROJECTILE_STYLES = Object.keys(PROJECTILES);

export function projectileVisual(style) {
  return PROJECTILES[style] ?? PROJECTILES.ball;
}

const ZONES = {
  zone: { color: 0xffffff },
  jelly: { color: 0xff8cc6 },
  goo: { color: 0x69db7c },
};

export function zoneVisual(style) {
  return ZONES[style] ?? ZONES.zone;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/visuals.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/render/weaponVisuals.js src/render/projectileVisuals.js tests/render/visuals.test.js
git commit -m "feat: add weapon, projectile, and zone visual tables"
```

---

### Task 5: Models built from primitives

**Files:**
- Create: `src/render/models.js`
- Test: `tests/render/models.test.js`

- [ ] **Step 1: Write the failing test `tests/render/models.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CHARACTER_IDS, getCharacter } from '../../src/data/characters.js';
import { getWeapon } from '../../src/data/weapons.js';
import { BOT_CHARACTER } from '../../src/logic/training.js';
import { PROJECTILE_STYLES } from '../../src/render/projectileVisuals.js';
import {
  buildFighterModel, buildWeaponModel, buildStatusEffects, buildProjectileMesh, buildZoneMesh, buildWarningMesh, disposeObject,
} from '../../src/render/models.js';

describe('fighter models', () => {
  it('builds every character with every weapon', () => {
    for (const id of CHARACTER_IDS) {
      for (let tier = 1; tier <= 11; tier++) {
        const model = buildFighterModel(getCharacter(id), getWeapon(id, tier));
        expect(model).toBeInstanceOf(THREE.Group);
        const { body, head, weaponMount, effects } = model.userData.parts;
        expect(body).toBeInstanceOf(THREE.Mesh);
        expect(head).toBeInstanceOf(THREE.Mesh);
        expect(effects).toBeInstanceOf(THREE.Group);
        expect(weaponMount.children).toHaveLength(1);
        expect(weaponMount.children[0].userData).toEqual({ characterId: id, tier });
      }
    }
  });

  it('tints player 2 with the alternate color', () => {
    const c = getCharacter('sparkle');
    expect(buildFighterModel(c, null).userData.parts.body.material.color.getHex()).toBe(c.colors.main);
    expect(buildFighterModel(c, null, { tint: true }).userData.parts.body.material.color.getHex()).toBe(c.colors.alt);
  });

  it('builds a weaponless model (training bot)', () => {
    const model = buildFighterModel(BOT_CHARACTER, null);
    expect(model.userData.parts.weaponMount.children).toHaveLength(0);
  });

  it('weapon models get bigger at higher tiers', () => {
    expect(buildWeaponModel('pancake', 11).scale.x).toBeGreaterThan(buildWeaponModel('pancake', 1).scale.x);
  });
});

describe('status effects', () => {
  it('builds hidden status pieces', () => {
    const s = buildStatusEffects();
    expect(s.group).toBeInstanceOf(THREE.Group);
    for (const key of ['shield', 'ice', 'stars', 'slow', 'guard']) expect(s[key].visible).toBe(false);
  });
});

describe('projectile, zone, and warning meshes', () => {
  it('builds a mesh for every projectile style', () => {
    for (const style of PROJECTILE_STYLES) {
      const m = buildProjectileMesh(style, 0.4);
      expect(m).toBeInstanceOf(THREE.Mesh);
      expect(m.userData.visual).toBeDefined();
    }
  });

  it('builds zone and warning meshes at the given radius', () => {
    const zone = buildZoneMesh('goo', 2.5);
    expect(zone.geometry.parameters.radiusTop).toBe(2.5);
    const warning = buildWarningMesh(2);
    expect(warning.geometry.parameters.outerRadius).toBe(2);
  });
});

describe('disposeObject', () => {
  it('disposes geometries and materials in a tree', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    group.add(mesh);
    const g = vi.spyOn(mesh.geometry, 'dispose');
    const m = vi.spyOn(mesh.material, 'dispose');
    disposeObject(group);
    expect(g).toHaveBeenCalled();
    expect(m).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/models.test.js`
Expected: FAIL — cannot resolve `../../src/render/models.js`.

- [ ] **Step 3: Create `src/render/models.js`**

```js
import * as THREE from 'three';
import { weaponVisual } from './weaponVisuals.js';
import { projectileVisual, zoneVisual } from './projectileVisuals.js';

const BLACK = 0x2b2d42;
const HANDLE = 0x8d6e63;
const METAL = 0x495057;
const SKIN = { sparkle: 0xffe0bd, bubbles: 0xffe0bd, pancake: 0xffd8a8 };

export function toonMaterial(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, ...extra });
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------- Fighters ----------

export function buildFighterModel(character, weapon, { tint = false } = {}) {
  const colors = character.colors;
  const bodyMat = toonMaterial(tint ? colors.alt : colors.main);
  const accentMat = toonMaterial(colors.accent);
  const skinMat = SKIN[character.id] ? toonMaterial(SKIN[character.id]) : bodyMat;
  const eyeMat = toonMaterial(BLACK);

  const root = new THREE.Group();
  root.name = `fighter-${character.id}`;

  const body = mesh(new THREE.CapsuleGeometry(0.45, 0.5, 6, 12), bodyMat, 0, 0.75, 0);
  const head = mesh(new THREE.SphereGeometry(0.4, 16, 12), skinMat, 0, 1.55, 0);
  const eyeL = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, -0.14, 1.6, 0.35);
  const eyeR = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, 0.14, 1.6, 0.35);
  const footL = mesh(new THREE.SphereGeometry(0.16, 10, 8), accentMat, -0.2, 0.1, 0.08);
  const footR = mesh(new THREE.SphereGeometry(0.16, 10, 8), accentMat, 0.2, 0.1, 0.08);
  root.add(body, head, eyeL, eyeR, footL, footR);

  addAccessory(root, character.id, { bodyMat, accentMat });

  const weaponMount = new THREE.Group();
  weaponMount.name = 'weaponMount';
  weaponMount.position.set(0.55, 0.9, 0.15);
  if (weapon) weaponMount.add(buildWeaponModel(weapon.characterId, weapon.tier));
  root.add(weaponMount);

  const effects = new THREE.Group();
  effects.name = 'effects';
  root.add(effects);

  root.userData.parts = { body, head, weaponMount, effects };
  return root;
}

function addAccessory(root, id, { bodyMat, accentMat }) {
  switch (id) {
    case 'sparkle': {
      const helmet = mesh(new THREE.SphereGeometry(0.43, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat, 0, 1.6, 0);
      const plume = mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat, 0, 2.08, -0.05);
      root.add(helmet, plume);
      break;
    }
    case 'bubbles': {
      const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20), bodyMat, 0, 1.82, 0);
      const hat = mesh(new THREE.ConeGeometry(0.45, 1.0, 16), bodyMat, 0, 2.35, 0);
      const star = mesh(new THREE.SphereGeometry(0.1, 8, 6), accentMat, 0, 2.2, 0.3);
      root.add(brim, hat, star);
      break;
    }
    case 'pancake': {
      const white = toonMaterial(0xffffff);
      const band = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 16), white, 0, 2.05, 0);
      const puff = mesh(new THREE.SphereGeometry(0.38, 14, 10), white, 0, 2.4, 0);
      const apron = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.05), accentMat, 0, 0.7, 0.44);
      root.add(band, puff, apron);
      break;
    }
    case 'rex': {
      const snout = mesh(new THREE.BoxGeometry(0.45, 0.25, 0.35), bodyMat, 0, 1.45, 0.4);
      root.add(snout);
      [1.95, 1.45, 1.0].forEach((y) => {
        const spike = mesh(new THREE.ConeGeometry(0.1, 0.25, 8), accentMat, 0, y, -0.42);
        spike.rotation.x = -0.6;
        root.add(spike);
      });
      const tail = mesh(new THREE.ConeGeometry(0.25, 0.8, 10), bodyMat, 0, 0.5, -0.65);
      tail.rotation.x = -Math.PI / 2;
      root.add(tail);
      break;
    }
    default:
      break;
  }
}

// ---------- Weapons ----------

const HEADS = {
  blade(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), handle, 0, 0.15, 0));
    g.add(mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handle, 0, 0.32, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.04), color, 0, 0.8, 0));
  },
  orb(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), handle, 0, 0.5, 0));
    g.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), color, 0, 1.08, 0));
  },
  spatula(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), handle, 0, 0.3, 0));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.35, 0.03), color, 0, 0.75, 0));
  },
  pan(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), handle, 0, 0.22, 0));
    const pan = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20), color, 0, 0.62, 0);
    pan.rotation.x = Math.PI / 2;
    g.add(pan);
  },
  pin(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), handle, 0, 0.1, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), color, 0, 0.6, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), handle, 0, 1.1, 0));
  },
  tube(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const tube = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12), color, 0, 0.3, 0.25);
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
  },
  scoop(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), handle, 0, 0.3, 0));
    g.add(mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, 0.62, 0));
  },
  disc(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), handle, 0, 0.25, 0));
    const disc = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), color, 0, 0.7, 0);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
  },
  whisk(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), handle, 0, 0.25, 0));
    for (let i = 0; i < 4; i++) {
      const loop = mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16), color, 0, 0.72, 0);
      loop.rotation.y = (i * Math.PI) / 4;
      g.add(loop);
    }
  },
  blaster(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), color, 0, 0.3, 0.15));
    const barrel = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), toonMaterial(METAL), 0, 0.32, 0.5);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
  },
  tank(g, color, handle) {
    HEADS.blaster(g, color, handle);
    g.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), color, 0, 0.5, 0));
  },
  magnet(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const magnet = mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 16, Math.PI), color, 0, 0.35, 0.25);
    magnet.rotation.x = Math.PI / 2;
    g.add(magnet);
  },
  shield(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const shield = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 20), color, 0, 0.4, 0.1);
    shield.rotation.x = Math.PI / 2;
    g.add(shield);
  },
};

export function buildWeaponModel(characterId, tier) {
  const v = weaponVisual(characterId, tier);
  const g = new THREE.Group();
  g.name = 'weapon';
  g.userData = { characterId, tier };
  const color = toonMaterial(v.color, v.glow ? { emissive: v.color, emissiveIntensity: 0.35 } : {});
  HEADS[v.head](g, color, toonMaterial(HANDLE));
  if (v.sparkle) {
    const twinkle = toonMaterial(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
    [[0.2, 0.9, 0], [-0.2, 0.6, 0.1], [0.1, 1.2, -0.1]].forEach(([x, y, z]) => g.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), twinkle, x, y, z)));
  }
  g.scale.setScalar(v.scale);
  return g;
}

// ---------- Status effects (shown on top of a fighter) ----------

export function buildStatusEffects() {
  const group = new THREE.Group();
  group.name = 'status';
  const see = (color, opacity) => toonMaterial(color, { transparent: true, opacity, depthWrite: false });

  const shield = mesh(new THREE.SphereGeometry(1.1, 20, 14), see(0x74c0fc, 0.3), 0, 0.95, 0);
  const ice = mesh(new THREE.BoxGeometry(1.2, 2.1, 1.2), see(0xa5d8ff, 0.45), 0, 1.0, 0);
  const stars = new THREE.Group();
  stars.position.y = 2.15;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    stars.add(mesh(new THREE.OctahedronGeometry(0.1), toonMaterial(0xffe066, { emissive: 0xffe066, emissiveIntensity: 0.5 }), Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45));
  }
  const slow = mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), toonMaterial(0xb197fc), 0, 0.05, 0);
  slow.rotation.x = Math.PI / 2;
  const guard = mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial(0x69db7c), 0, 1.0, -0.45);
  guard.rotation.x = -Math.PI / 2;

  for (const piece of [shield, ice, stars, slow, guard]) {
    piece.visible = false;
    group.add(piece);
  }
  return { group, shield, ice, stars, slow, guard };
}

// ---------- Projectiles, zones, warnings ----------

function projectileGeometry(shape, s) {
  switch (shape) {
    case 'disc': return new THREE.CylinderGeometry(s, s, s * 0.3, 16);
    case 'ring': return new THREE.TorusGeometry(s, s * 0.25, 8, 16, Math.PI);
    case 'cone': return new THREE.ConeGeometry(s * 0.6, s * 2, 10).rotateX(Math.PI / 2);
    case 'funnel': return new THREE.ConeGeometry(s, s * 2.2, 12).rotateX(Math.PI);
    case 'rod': return new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 4, 8).rotateX(Math.PI / 2);
    case 'box': return new THREE.BoxGeometry(s, s, s * 2);
    default: return new THREE.SphereGeometry(s, 12, 10);
  }
}

export function buildProjectileMesh(style, size) {
  const v = projectileVisual(style);
  const material = toonMaterial(v.color, {
    transparent: v.opacity !== undefined,
    opacity: v.opacity ?? 1,
    emissive: v.glow ? v.color : 0x000000,
    emissiveIntensity: v.glow ? 0.6 : 0,
  });
  const m = new THREE.Mesh(projectileGeometry(v.shape, size), material);
  m.userData.visual = v;
  return m;
}

export function buildZoneMesh(style, radius) {
  const v = zoneVisual(style);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.08, 32),
    toonMaterial(v.color, { transparent: true, opacity: 0.55, depthWrite: false }),
  );
  m.position.y = 0.05;
  return m;
}

export function buildWarningMesh(radius) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.8, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return m;
}

// ---------- Cleanup ----------

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of materials) m.dispose();
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/models.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/models.js tests/render/models.test.js
git commit -m "feat: build fighter, weapon, status, and projectile models"
```

---

### Task 6: Arena

**Files:**
- Create: `src/render/arena.js`
- Test: `tests/render/arena.test.js`

- [ ] **Step 1: Write the failing test `tests/render/arena.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildArena } from '../../src/render/arena.js';
import { ARENA_RADIUS } from '../../src/logic/constants.js';

describe('arena', () => {
  it('builds an island with a wall outside the play area and lights', () => {
    const arena = buildArena();
    expect(arena).toBeInstanceOf(THREE.Group);
    expect(arena.userData.wallRadius).toBeGreaterThan(ARENA_RADIUS);
    const lights = [];
    arena.traverse((o) => { if (o.isLight) lights.push(o); });
    expect(lights.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/arena.test.js`
Expected: FAIL — cannot resolve `../../src/render/arena.js`.

- [ ] **Step 3: Create `src/render/arena.js`**

```js
import * as THREE from 'three';
import { ARENA_RADIUS } from '../logic/constants.js';
import { toonMaterial } from './models.js';

const WALL_RADIUS = ARENA_RADIUS + 0.6;
const ISLAND_RADIUS = ARENA_RADIUS + 2;

export function buildArena() {
  const arena = new THREE.Group();
  arena.name = 'arena';
  arena.userData.wallRadius = WALL_RADIUS;

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 1, 48), toonMaterial(0x8ce99a));
  grass.position.y = -0.5;
  grass.receiveShadow = true;
  arena.add(grass);

  const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS - 0.3, ARENA_RADIUS, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  arena.add(ring);

  const dirt = new THREE.Mesh(new THREE.ConeGeometry(ISLAND_RADIUS, 7, 48), toonMaterial(0xc08552));
  dirt.rotation.x = Math.PI;
  dirt.position.y = -4.5;
  arena.add(dirt);

  const wall = new THREE.Mesh(new THREE.TorusGeometry(WALL_RADIUS, 0.35, 10, 64), toonMaterial(0xffd6e7));
  wall.rotation.x = Math.PI / 2;
  wall.position.y = 0.35;
  wall.castShadow = true;
  arena.add(wall);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    arena.add(buildTree(Math.cos(a) * (ISLAND_RADIUS - 0.8), Math.sin(a) * (ISLAND_RADIUS - 0.8)));
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    arena.add(buildCloud(Math.cos(a) * 30, 6 + (i % 3) * 3, Math.sin(a) * 30 - 10));
  }

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8ce99a, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = ISLAND_RADIUS;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 });
  sun.shadow.camera.updateProjectionMatrix();
  arena.add(hemi, sun);

  return arena;
}

function buildTree(x, z) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 8), toonMaterial(0x8d6e63));
  trunk.position.y = 0.6;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), toonMaterial(0x51cf66));
  top.position.y = 1.7;
  trunk.castShadow = true;
  top.castShadow = true;
  tree.add(trunk, top);
  tree.position.set(x, 0, z);
  return tree;
}

function buildCloud(x, y, z) {
  const cloud = new THREE.Group();
  const white = toonMaterial(0xffffff);
  [[0, 0, 0, 1.6], [1.5, -0.2, 0, 1.2], [-1.5, -0.3, 0, 1.1], [0.5, 0.6, 0.3, 1.0]].forEach(([cx, cy, cz, r]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), white);
    puff.position.set(cx, cy, cz);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  return cloud;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/arena.test.js`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/render/arena.js tests/render/arena.test.js
git commit -m "feat: add floating island arena"
```

---

### Task 7: Battle view (world → scene sync)

**Files:**
- Create: `src/render/view.js`
- Test: `tests/render/view.test.js`

- [ ] **Step 1: Write the failing test `tests/render/view.test.js`**

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBattleView, KO_SHRINK_TIME } from '../../src/render/view.js';
import { createMatch } from '../../src/logic/match.js';
import { runStep } from '../../src/logic/abilities.js';
import { setLoadout, resetFighter } from '../../src/logic/fighter.js';
import { getCharacter } from '../../src/data/characters.js';
import { getWeapon } from '../../src/data/weapons.js';
import { facingToRotationY } from '../../src/render/math.js';

const loadout = (characterId) => ({ characterId, level: 1, tier: 1, petId: null });
function setup(tintP2 = false) {
  const match = createMatch({ mode: '2p', p1: loadout('sparkle'), p2: loadout('sparkle') });
  const scene = new THREE.Scene();
  const view = createBattleView(scene, { tintP2 });
  view.sync(match.world, 0.016);
  return { match, world: match.world, scene, view };
}

describe('battle view', () => {
  it('adds and places a model for each fighter', () => {
    const { world, view } = setup(true);
    const m1 = view.fighterModel('p1');
    expect(m1.position.x).toBe(-5);
    expect(m1.rotation.y).toBeCloseTo(facingToRotationY(world.fighters[0].facing));
    const alt = getCharacter('sparkle').colors.alt;
    expect(view.fighterModel('p2').userData.parts.body.material.color.getHex()).toBe(alt);
  });

  it('adds and removes projectile meshes', () => {
    const { world, view, scene } = setup();
    const before = scene.children.length;
    runStep(world, world.fighters[0], { type: 'projectile', damage: 1, speed: 10, size: 0.3, life: 1, style: 'bubble' }, world.fighters[0], 1);
    view.sync(world, 0.016);
    expect(view.projectileCount).toBe(1);
    expect(scene.children.length).toBe(before + 1);
    world.projectiles = [];
    view.sync(world, 0.016);
    expect(view.projectileCount).toBe(0);
    expect(scene.children.length).toBe(before);
  });

  it('adds and removes zone meshes', () => {
    const { world, view } = setup();
    runStep(world, world.fighters[0], { type: 'zone', at: 'target', radius: 2, duration: 3, slow: 0.5, dps: 0, style: 'jelly' }, world.fighters[0], 1);
    view.sync(world, 0.016);
    expect(view.zoneCount).toBe(1);
    world.zones = [];
    view.sync(world, 0.016);
    expect(view.zoneCount).toBe(0);
  });

  it('spins and hides knocked-out fighters, and restores them', () => {
    const { world, view } = setup();
    const f = world.fighters[1];
    f.ko = true;
    for (let t = 0; t <= KO_SHRINK_TIME + 0.1; t += 0.1) view.sync(world, 0.1);
    expect(view.fighterModel('p2').visible).toBe(false);
    resetFighter(f, { x: 5, y: 0, z: 0 });
    view.sync(world, 0.016);
    expect(view.fighterModel('p2').visible).toBe(true);
    expect(view.fighterModel('p2').scale.x).toBe(1);
  });

  it('shows shield and ice status pieces', () => {
    const { world, view } = setup();
    const f = world.fighters[0];
    f.shield = { until: world.time + 1, reduction: 1, onEnd: null };
    f.status.freezeUntil = world.time + 1;
    view.sync(world, 0.016);
    const status = view.statusFor('p1');
    expect(status.shield.visible).toBe(true);
    expect(status.ice.visible).toBe(true);
    f.shield = null;
    f.status.freezeUntil = 0;
    view.sync(world, 0.016);
    expect(status.shield.visible).toBe(false);
    expect(status.ice.visible).toBe(false);
  });

  it('rebuilds the model when the weapon changes', () => {
    const { world, view } = setup();
    setLoadout(world.fighters[0], { character: getCharacter('sparkle'), level: 20, weapon: getWeapon('sparkle', 3) });
    view.sync(world, 0.016);
    expect(view.fighterModel('p1').userData.parts.weaponMount.children[0].userData.tier).toBe(3);
  });

  it('reacts to events: swing, hit flash, and warnings', () => {
    const { world, view } = setup();
    view.handleEvents([
      { type: 'ability', fighterId: 'p1', slot: 'basic', name: 'Sword Swing' },
      { type: 'hit', targetId: 'p2', attackerId: 'p1', damage: 5, popup: 'BONK!', pos: { x: 5, y: 0, z: 0 } },
      { type: 'shape', shape: 'warning', pos: { x: 0, y: 0, z: 0 }, radius: 2, duration: 0.5 },
    ]);
    view.sync(world, 0.05);
    expect(view.fighterModel('p1').userData.parts.weaponMount.rotation.x).not.toBe(0);
    expect(view.fighterModel('p2').userData.parts.body.material.emissive.getHex()).toBe(0xffffff);
    expect(view.warningCount).toBe(1);
    view.sync(world, 0.6);
    expect(view.warningCount).toBe(0);
  });

  it('clear removes everything it added', () => {
    const { world, view, scene } = setup();
    runStep(world, world.fighters[0], { type: 'projectile', damage: 1, speed: 10, size: 0.3, life: 1 }, world.fighters[0], 1);
    view.sync(world, 0.016);
    view.clear();
    expect(scene.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/view.test.js`
Expected: FAIL — cannot resolve `../../src/render/view.js`.

- [ ] **Step 3: Create `src/render/view.js`**

```js
import {
  buildFighterModel, buildStatusEffects, buildProjectileMesh, buildZoneMesh, buildWarningMesh, disposeObject,
} from './models.js';
import { facingToRotationY } from './math.js';

export const KO_SHRINK_TIME = 0.6;
const KO_SPIN = 14;
const SWING_TIME = 0.22;
const BOUNCE_TIME = 0.35;
const FLASH_TIME = 0.12;

export function createBattleView(scene, { tintP2 = false } = {}) {
  const fighters = new Map();
  const projectiles = new Map();
  const zones = new Map();
  let warnings = [];
  let clock = 0;

  const keyOf = (f) => `${f.character.id}:${f.weapon ? f.weapon.tier : 0}`;

  function remove(object) {
    scene.remove(object);
    disposeObject(object);
  }

  function makeFighter(f) {
    const model = buildFighterModel(f.character, f.weapon, { tint: tintP2 && f.id === 'p2' });
    const status = buildStatusEffects();
    model.userData.parts.effects.add(status.group);
    scene.add(model);
    return { model, status, key: keyOf(f), koTime: 0, flash: 0, swing: 0, bounce: 0 };
  }

  function syncFighter(f, now, dt) {
    let e = fighters.get(f.id);
    if (e && e.key !== keyOf(f)) {
      remove(e.model);
      e = null;
    }
    if (!e) {
      e = makeFighter(f);
      fighters.set(f.id, e);
    }
    const { model, status } = e;
    const parts = model.userData.parts;
    model.position.set(f.pos.x, f.pos.y, f.pos.z);

    if (f.ko) {
      e.koTime += dt;
      const t = Math.min(1, e.koTime / KO_SHRINK_TIME);
      model.rotation.y += KO_SPIN * dt;
      model.scale.setScalar(1 - t);
      model.visible = t < 1;
    } else {
      e.koTime = 0;
      model.visible = true;
      model.rotation.y = facingToRotationY(f.facing);
      const bounce = e.bounce > 0 ? 1 + Math.sin((1 - e.bounce / BOUNCE_TIME) * Math.PI) * 0.15 : 1;
      model.scale.set(1, bounce, f.dash ? 1.3 : 1);
    }

    e.flash = Math.max(0, e.flash - dt);
    parts.body.material.emissive.setHex(e.flash > 0 ? 0xffffff : 0x000000);

    e.swing = Math.max(0, e.swing - dt);
    parts.weaponMount.rotation.x = e.swing > 0 ? -Math.sin((1 - e.swing / SWING_TIME) * Math.PI) * 1.6 : 0;

    e.bounce = Math.max(0, e.bounce - dt);
    updateStatus(status, f, now, dt);
  }

  function updateStatus(s, f, now, dt) {
    const shielded = !!f.shield && now < f.shield.until;
    s.shield.visible = shielded;
    if (shielded) s.shield.material.color.setHex(f.shield.reduction >= 1 ? 0xffd43b : 0x74c0fc);
    s.ice.visible = now < f.status.freezeUntil;
    s.stars.visible = now < f.status.stunUntil;
    if (s.stars.visible) s.stars.rotation.y += dt * 6;
    s.slow.visible = now < f.status.slowUntil;
    s.guard.visible = f.guardHits > 0;
  }

  function syncProjectiles(world, dt) {
    const seen = new Set();
    for (const p of world.projectiles) {
      seen.add(p.id);
      let m = projectiles.get(p.id);
      if (!m) {
        m = buildProjectileMesh(p.style, p.size);
        scene.add(m);
        projectiles.set(p.id, m);
      }
      m.position.set(p.pos.x, p.pos.y, p.pos.z);
      const v = m.userData.visual;
      if (v.spin) m.rotation.y += dt * 12;
      else m.rotation.y = facingToRotationY(Math.atan2(p.vel.z, p.vel.x));
      if (v.rainbow) m.material.color.setHSL((clock * 1.5) % 1, 0.8, 0.65);
    }
    for (const [id, m] of projectiles) {
      if (!seen.has(id)) {
        remove(m);
        projectiles.delete(id);
      }
    }
  }

  function syncZones(world) {
    const seen = new Set();
    for (const z of world.zones) {
      seen.add(z.id);
      let m = zones.get(z.id);
      if (!m) {
        m = buildZoneMesh(z.style, z.radius);
        m.position.x = z.pos.x;
        m.position.z = z.pos.z;
        scene.add(m);
        zones.set(z.id, m);
      }
      m.material.opacity = 0.45 + 0.15 * Math.sin(clock * 6);
    }
    for (const [id, m] of zones) {
      if (!seen.has(id)) {
        remove(m);
        zones.delete(id);
      }
    }
  }

  function syncWarnings(dt) {
    for (const w of warnings) {
      w.left -= dt;
      w.mesh.material.opacity = 0.4 + 0.4 * Math.abs(Math.sin(clock * 10));
      if (w.left <= 0) remove(w.mesh);
    }
    warnings = warnings.filter((w) => w.left > 0);
  }

  return {
    sync(world, dt) {
      clock += dt;
      for (const f of world.fighters) syncFighter(f, world.time, dt);
      syncProjectiles(world, dt);
      syncZones(world);
      syncWarnings(dt);
    },
    handleEvents(events) {
      for (const e of events) {
        if (e.type === 'ability') {
          const f = fighters.get(e.fighterId);
          if (f && e.slot === 'basic') f.swing = SWING_TIME;
          else if (f) f.bounce = BOUNCE_TIME;
        } else if (e.type === 'hit') {
          const f = fighters.get(e.targetId);
          if (f) f.flash = FLASH_TIME;
        } else if (e.type === 'shape' && e.shape === 'warning') {
          const mesh = buildWarningMesh(e.radius);
          mesh.position.x = e.pos.x;
          mesh.position.z = e.pos.z;
          scene.add(mesh);
          warnings.push({ mesh, left: e.duration });
        }
      }
    },
    fighterModel: (id) => fighters.get(id)?.model ?? null,
    statusFor: (id) => fighters.get(id)?.status ?? null,
    get projectileCount() { return projectiles.size; },
    get zoneCount() { return zones.size; },
    get warningCount() { return warnings.length; },
    clear() {
      for (const e of fighters.values()) remove(e.model);
      for (const m of projectiles.values()) remove(m);
      for (const m of zones.values()) remove(m);
      for (const w of warnings) remove(w.mesh);
      fighters.clear();
      projectiles.clear();
      zones.clear();
      warnings = [];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/view.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/view.js tests/render/view.test.js
git commit -m "feat: sync world state to the 3D scene"
```

---

### Task 8: Effects (particles and pop-up text)

**Files:**
- Create: `src/render/effects.js`
- Test: `tests/render/effects.test.js`

- [ ] **Step 1: Write the failing test `tests/render/effects.test.js`**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { toScreen, createParticles, createPopups, createEffects, POPUP_LIFE } from '../../src/render/effects.js';

function camera() {
  const cam = new THREE.PerspectiveCamera(45, 2, 0.1, 100);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}
const world = { fighters: [{ id: 'p1', pos: { x: 0, y: 0, z: 0 } }, { id: 'p2', pos: { x: 3, y: 0, z: 0 } }] };

describe('toScreen', () => {
  it('maps the point the camera looks at to the screen center', () => {
    const s = toScreen({ x: 0, y: 0, z: 0 }, camera(), 200, 100);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(50);
    expect(s.visible).toBe(true);
  });
});

describe('particles', () => {
  it('bursts and fades away', () => {
    const scene = new THREE.Scene();
    const p = createParticles(scene);
    p.burst({ x: 0, y: 1, z: 0 }, { count: 10, colors: [0xffffff], life: 0.5 });
    expect(p.count).toBe(10);
    expect(scene.children).toHaveLength(10);
    p.update(0.6);
    expect(p.count).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});

describe('popups', () => {
  it('shows floating text that disappears', () => {
    const container = document.createElement('div');
    const popups = createPopups(container);
    popups.show('BONK!', { x: 0, y: 2, z: 0 });
    expect(container.querySelectorAll('.popup')).toHaveLength(1);
    expect(container.querySelector('.popup').textContent).toBe('BONK!');
    popups.update(0.1, camera(), 200, 100);
    expect(popups.count).toBe(1);
    popups.update(POPUP_LIFE, camera(), 200, 100);
    expect(popups.count).toBe(0);
    expect(container.querySelectorAll('.popup')).toHaveLength(0);
  });
});

describe('createEffects', () => {
  function setup() {
    const scene = new THREE.Scene();
    const container = document.createElement('div');
    return { container, effects: createEffects({ scene, container }) };
  }

  it('hits make a pop-up and sparkles', () => {
    const { container, effects } = setup();
    effects.handleEvents([{ type: 'hit', targetId: 'p2', damage: 5, popup: 'ZAP!', pos: { x: 3, y: 0, z: 0 } }], world);
    expect(container.querySelector('.popup').textContent).toBe('ZAP!');
    expect(effects.particles.count).toBeGreaterThan(0);
  });

  it('knockouts make a confetti burst', () => {
    const { effects } = setup();
    effects.handleEvents([{ type: 'ko', targetId: 'p2' }], world);
    expect(effects.particles.count).toBeGreaterThanOrEqual(40);
  });

  it('shows status words and skips empty heals', () => {
    const { container, effects } = setup();
    effects.handleEvents([
      { type: 'status', targetId: 'p1', status: 'freeze' },
      { type: 'heal', targetId: 'p1', amount: 0, pos: { x: 0, y: 0, z: 0 } },
    ], world);
    const texts = [...container.querySelectorAll('.popup')].map((e) => e.textContent);
    expect(texts).toEqual(['FROZEN!']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/effects.test.js`
Expected: FAIL — cannot resolve `../../src/render/effects.js`.

- [ ] **Step 3: Create `src/render/effects.js`**

```js
import * as THREE from 'three';

export const POPUP_LIFE = 0.9;
const POPUP_RISE = 1.2;

const COLORS = {
  hit: [0xffe066, 0xffffff, 0xffa94d],
  block: [0x74c0fc, 0xffffff],
  heal: [0x8ce99a, 0xffffff],
  confetti: [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xffa94d],
  blink: [0xb197fc, 0xffffff],
};

const STATUS_WORDS = {
  freeze: ['FROZEN!', '#a5d8ff'],
  stun: ['DIZZY!', '#ffe066'],
  slow: ['SLOW!', '#d0bfff'],
};

export function toScreen(pos, camera, width, height) {
  const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera);
  return {
    x: ((v.x + 1) / 2) * width,
    y: ((1 - v.y) / 2) * height,
    visible: v.z < 1,
  };
}

export function createParticles(scene) {
  const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.04);
  let list = [];
  return {
    burst(pos, { count, colors, speed = 4, life = 0.8, gravity = 9, up = 3 }) {
      for (let i = 0; i < count; i++) {
        const material = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true });
        const m = new THREE.Mesh(geometry, material);
        m.position.set(pos.x, pos.y, pos.z);
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        list.push({ mesh: m, vel: { x: Math.cos(a) * s, y: up + Math.random() * up, z: Math.sin(a) * s }, life, max: life, gravity });
        scene.add(m);
      }
    },
    update(dt) {
      for (const p of list) {
        p.life -= dt;
        p.vel.y -= p.gravity * dt;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.y += dt * 6;
        p.mesh.material.opacity = Math.max(0, p.life / p.max);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
        }
      }
      list = list.filter((p) => p.life > 0);
    },
    get count() { return list.length; },
    clear() {
      for (const p of list) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
      }
      list = [];
    },
  };
}

export function createPopups(container) {
  const layer = document.createElement('div');
  layer.className = 'popup-layer';
  container.appendChild(layer);
  let list = [];
  return {
    show(text, pos, color = '#ffd43b') {
      const el = document.createElement('div');
      el.className = 'popup';
      el.textContent = text;
      el.style.color = color;
      layer.appendChild(el);
      list.push({ el, pos: { ...pos }, age: 0 });
    },
    update(dt, camera, width, height) {
      for (const p of list) {
        p.age += dt;
        if (p.age >= POPUP_LIFE) {
          p.el.remove();
          continue;
        }
        const s = toScreen({ x: p.pos.x, y: p.pos.y + p.age * POPUP_RISE, z: p.pos.z }, camera, width, height);
        const grow = 1 + Math.min(p.age * 4, 0.3);
        p.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${grow})`;
        p.el.style.opacity = String(Math.max(0, 1 - p.age / POPUP_LIFE));
        p.el.style.display = s.visible ? '' : 'none';
      }
      list = list.filter((p) => p.age < POPUP_LIFE);
    },
    get count() { return list.length; },
    dispose() {
      layer.remove();
      list = [];
    },
  };
}

const above = (pos, dy) => ({ x: pos.x, y: pos.y + dy, z: pos.z });

export function createEffects({ scene, container }) {
  const particles = createParticles(scene);
  const popups = createPopups(container);
  const fighterPos = (world, id) => world.fighters.find((f) => f.id === id)?.pos ?? { x: 0, y: 0, z: 0 };

  return {
    particles,
    popups,
    handleEvents(events, world) {
      for (const e of events) {
        switch (e.type) {
          case 'hit':
            popups.show(e.popup ?? 'POW!', above(e.pos, 2.3), '#ffd43b');
            particles.burst(above(e.pos, 1.1), { count: 8, colors: COLORS.hit, life: 0.5 });
            break;
          case 'blocked':
            popups.show(e.popup ?? 'BOING!', above(e.pos, 2.3), '#74c0fc');
            particles.burst(above(e.pos, 1.1), { count: 6, colors: COLORS.block, life: 0.4 });
            break;
          case 'heal':
            if (e.amount > 0) {
              popups.show(`+${Math.round(e.amount)}`, above(e.pos, 2.3), '#8ce99a');
              particles.burst(above(e.pos, 1), { count: 8, colors: COLORS.heal, life: 0.7, gravity: -2, up: 1 });
            }
            break;
          case 'ko': {
            const pos = fighterPos(world, e.targetId);
            popups.show('POOF!', above(pos, 2.5), '#ff8cc6');
            particles.burst(above(pos, 1), { count: 40, colors: COLORS.confetti, speed: 6, life: 1.4, up: 5 });
            break;
          }
          case 'status': {
            const word = STATUS_WORDS[e.status];
            if (word) popups.show(word[0], above(fighterPos(world, e.targetId), 2.8), word[1]);
            break;
          }
          case 'blink':
            particles.burst(above(fighterPos(world, e.fighterId), 1), { count: 12, colors: COLORS.blink, life: 0.5 });
            break;
          default:
            break;
        }
      }
    },
    update(dt, camera, width, height) {
      particles.update(dt);
      popups.update(dt, camera, width, height);
    },
    dispose() {
      particles.clear();
      popups.dispose();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/effects.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.js tests/render/effects.test.js
git commit -m "feat: add particles and pop-up text effects"
```

---

### Task 9: Battle HUD

**Files:**
- Create: `src/ui/hud.js`
- Test: `tests/ui/hud.test.js`

- [ ] **Step 1: Write the failing test `tests/ui/hud.test.js`**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hudState, bannerFor, createHud } from '../../src/ui/hud.js';
import { createMatch, stepMatch, INTRO_TIME } from '../../src/logic/match.js';
import { DT } from '../../src/logic/constants.js';

const loadout = (characterId) => ({ characterId, level: 1, tier: 1, petId: null });
const newMatch = (mode = 'cpu', c2 = 'rex') => createMatch({ mode, p1: loadout('sparkle'), p2: loadout(c2) });

describe('bannerFor', () => {
  it('announces the round, then FIGHT!, then the round winner', () => {
    const m = newMatch();
    expect(bannerFor(m)).toBe('ROUND 1');
    stepMatch(m, INTRO_TIME * 0.6);
    expect(bannerFor(m)).toBe('GET READY...');
    stepMatch(m, INTRO_TIME);
    expect(bannerFor(m)).toBe('FIGHT!');
    stepMatch(m, 1);
    expect(bannerFor(m)).toBe('');
    m.world.fighters[1].ko = true;
    stepMatch(m, DT);
    expect(bannerFor(m)).toBe('Sir Sparkle wins the round!');
  });

  it('calls round 4+ a bonus round and handles ties, draws, and mirror names', () => {
    const m = newMatch('2p', 'sparkle');
    m.round = 4;
    expect(bannerFor(m)).toBe('BONUS ROUND!');
    m.state = 'roundOver';
    m.roundWinner = 'tie';
    expect(bannerFor(m)).toBe('TIE ROUND!');
    m.roundWinner = 'p2';
    expect(bannerFor(m)).toBe('Sir Sparkle (P2) wins the round!');
    m.state = 'matchOver';
    m.winner = 'draw';
    expect(bannerFor(m)).toBe("IT'S A DRAW!");
    m.winner = 'p1';
    expect(bannerFor(m)).toBe('Sir Sparkle (P1) WINS!');
  });
});

describe('hudState', () => {
  it('describes both players', () => {
    const m = newMatch();
    m.world.fighters[0].energy = 50;
    const s = hudState(m);
    expect(s.timer).toBe('60');
    expect(s.players[0]).toMatchObject({ label: 'P1', name: 'Sir Sparkle', level: 1, energyPct: 50, wins: 0, specialName: 'Dash Strike', keys: { attack: 'F', special: 'G' } });
    expect(s.players[1]).toMatchObject({ label: 'CPU', name: 'Robo Rex', energyPct: 100, keys: null });
  });

  it('shows P2 keys in 2-player mode', () => {
    expect(hudState(newMatch('2p')).players[1].keys).toEqual({ attack: 'K', special: 'L' });
  });
});

describe('createHud', () => {
  it('renders names, bars, timer, banner, and cooldowns', () => {
    const container = document.createElement('div');
    const hud = createHud(container);
    const m = newMatch();
    m.world.fighters[1].energy = 25;
    hud.update(hudState(m));
    expect(container.querySelector('[data-id="p1"] .hud-name').textContent).toBe('P1 · Sir Sparkle · Lv 1');
    expect(container.querySelector('[data-id="p2"] .hud-bar-fill').style.width).toBe('25%');
    expect(container.querySelector('[data-id="p2"] .hud-bar-fill').classList.contains('low')).toBe(true);
    expect(container.querySelector('.hud-timer').textContent).toBe('60');
    expect(container.querySelector('.hud-banner').textContent).toBe('ROUND 1');
    expect(container.querySelectorAll('[data-id="p1"] .hud-ability')).toHaveLength(2);
    hud.dispose();
    expect(container.children).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/hud.test.js`
Expected: FAIL — cannot resolve `../../src/ui/hud.js`.

- [ ] **Step 3: Create `src/ui/hud.js`**

```js
import { cooldownFraction } from '../logic/fighter.js';
import { INTRO_TIME, WINS_NEEDED } from '../logic/match.js';
import { ROUND_TIME, MAX_ENERGY } from '../logic/constants.js';
import { BINDINGS, keyLabel } from '../input/keyboard.js';

export const FIGHT_BANNER_TIME = 0.8;
const LOW_ENERGY = 30;

export function playerLabel(match, id) {
  if (id === 'p1') return 'P1';
  return match.mode === 'cpu' ? 'CPU' : 'P2';
}

function displayName(match, id) {
  const [a, b] = match.world.fighters;
  const f = id === 'p1' ? a : b;
  const mirror = a.character.name === b.character.name;
  return mirror ? `${f.character.name} (${playerLabel(match, id)})` : f.character.name;
}

export function bannerFor(match) {
  switch (match.state) {
    case 'intro':
      if (match.stateTime > INTRO_TIME / 2) return match.round > 3 ? 'BONUS ROUND!' : `ROUND ${match.round}`;
      return 'GET READY...';
    case 'fighting':
      return ROUND_TIME - match.timeLeft < FIGHT_BANNER_TIME ? 'FIGHT!' : '';
    case 'roundOver':
      return match.roundWinner === 'tie' ? 'TIE ROUND!' : `${displayName(match, match.roundWinner)} wins the round!`;
    case 'matchOver':
      return match.winner === 'draw' ? "IT'S A DRAW!" : `${displayName(match, match.winner)} WINS!`;
    default:
      return '';
  }
}

export function hudState(match) {
  const now = match.world.time;
  return {
    timer: String(Math.ceil(match.timeLeft)),
    banner: bannerFor(match),
    players: match.world.fighters.map((f) => {
      const label = playerLabel(match, f.id);
      return {
        id: f.id,
        label,
        name: f.character.name,
        level: f.level,
        energyPct: Math.max(0, Math.min(100, (f.energy / MAX_ENERGY) * 100)),
        wins: match.wins[f.id],
        weaponName: f.weapon.name,
        basicName: f.weapon.basic.name,
        specialName: f.weapon.special.name,
        basicCooldown: cooldownFraction(f, 'basic', now),
        specialCooldown: cooldownFraction(f, 'special', now),
        keys: label === 'CPU' ? null : { attack: keyLabel(BINDINGS[f.id].attack), special: keyLabel(BINDINGS[f.id].special) },
      };
    }),
  };
}

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

function buildPlayer(parent, id, side) {
  const root = el('div', `hud-player ${side}`, parent);
  root.dataset.id = id;
  const name = el('div', 'hud-name', root);
  const bar = el('div', 'hud-bar', root);
  const fill = el('div', 'hud-bar-fill', bar);
  const wins = el('div', 'hud-wins', root);
  return { name, fill, wins };
}

function buildAbilities(parent, id, side) {
  const root = el('div', `hud-abilities ${side}`, parent);
  root.dataset.id = id;
  const make = () => {
    const box = el('div', 'hud-ability', root);
    const ring = el('div', 'hud-ring', box);
    const key = el('div', 'hud-key', ring);
    const label = el('div', 'hud-ability-name', box);
    return { box, ring, key, label };
  };
  return { basic: make(), special: make() };
}

export function createHud(container) {
  const root = el('div', 'hud', container);
  const top = el('div', 'hud-top', root);
  const players = { p1: buildPlayer(top, 'p1', 'left') };
  const timer = el('div', 'hud-timer', top);
  players.p2 = buildPlayer(top, 'p2', 'right');
  const banner = el('div', 'hud-banner', root);
  const bottom = el('div', 'hud-bottom', root);
  const abilities = { p1: buildAbilities(bottom, 'p1', 'left'), p2: buildAbilities(bottom, 'p2', 'right') };

  function setAbility(slot, name, cooldown, key) {
    slot.label.textContent = name;
    slot.key.textContent = key ?? '';
    slot.ring.style.setProperty('--cd', String(cooldown));
    slot.box.classList.toggle('ready', cooldown === 0);
  }

  return {
    update(state) {
      timer.textContent = state.timer;
      banner.textContent = state.banner;
      banner.classList.toggle('show', state.banner !== '');
      for (const p of state.players) {
        const ui = players[p.id];
        ui.name.textContent = `${p.label} · ${p.name} · Lv ${p.level}`;
        ui.fill.style.width = `${p.energyPct}%`;
        ui.fill.classList.toggle('low', p.energyPct <= LOW_ENERGY);
        const dots = Math.max(WINS_NEEDED, p.wins);
        ui.wins.textContent = '★'.repeat(p.wins) + '☆'.repeat(dots - p.wins);
        const ab = abilities[p.id];
        setAbility(ab.basic, p.basicName, p.basicCooldown, p.keys?.attack);
        setAbility(ab.special, p.specialName, p.specialCooldown, p.keys?.special);
      }
    },
    dispose() {
      root.remove();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/hud.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hud.js tests/ui/hud.test.js
git commit -m "feat: add battle HUD"
```

---

### Task 10: Renderer setup, WebGL check, friendly message

**Files:**
- Create: `src/render/renderer.js`, `src/ui/messages.js`
- Test: `tests/render/renderer.test.js`

- [ ] **Step 1: Write the failing test `tests/render/renderer.test.js`**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isWebGLAvailable } from '../../src/render/renderer.js';
import { showMessage } from '../../src/ui/messages.js';

const fakeDoc = (getContext) => ({ createElement: () => ({ getContext }) });

describe('isWebGLAvailable', () => {
  it('is true when a WebGL context can be made', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: { WebGLRenderingContext: function W() {} } })).toBe(true);
  });

  it('is false without a context, without WebGL, or on errors', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => null), win: { WebGLRenderingContext: function W() {} } })).toBe(false);
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: {} })).toBe(false);
    expect(isWebGLAvailable({ doc: { createElement: () => { throw new Error('no'); } }, win: { WebGLRenderingContext: function W() {} } })).toBe(false);
  });
});

describe('showMessage', () => {
  it('replaces the page with a friendly message', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>old</p>';
    showMessage(root, 'Oops! Try another browser.');
    expect(root.querySelector('.message-text').textContent).toBe('Oops! Try another browser.');
    expect(root.textContent).not.toContain('old');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/renderer.test.js`
Expected: FAIL — cannot resolve `../../src/render/renderer.js`.

- [ ] **Step 3: Create `src/render/renderer.js`**

```js
import * as THREE from 'three';

const SKY = 0x9bdcff;

export function isWebGLAvailable({ doc = globalThis.document, win = globalThis } = {}) {
  try {
    if (!win.WebGLRenderingContext) return false;
    const canvas = doc.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 45, 95);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  const size = () => ({ width: container.clientWidth || window.innerWidth, height: container.clientHeight || window.innerHeight });
  const resize = () => {
    const { width, height } = size();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    scene,
    camera,
    size,
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
```

- [ ] **Step 4: Create `src/ui/messages.js`**

```js
export function showMessage(root, text) {
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'screen message';
  const title = document.createElement('h1');
  title.className = 'logo';
  title.textContent = 'CHAOS BRAWL';
  const p = document.createElement('p');
  p.className = 'message-text';
  p.textContent = text;
  box.append(title, p);
  root.appendChild(box);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/renderer.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/render/renderer.js src/ui/messages.js tests/render/renderer.test.js
git commit -m "feat: add renderer setup and WebGL check"
```

---

### Task 11: Battle controller (match + AI + inputs + pause)

**Files:**
- Create: `src/game/battleController.js`
- Test: `tests/game/battleController.test.js`

- [ ] **Step 1: Write the failing test `tests/game/battleController.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { quickLoadout, buildMatchConfig, createBattleController, IDLE_INPUT } from '../../src/game/battleController.js';
import { INTRO_TIME } from '../../src/logic/match.js';
import { mulberry32 } from '../../src/logic/random.js';
import { DT } from '../../src/logic/constants.js';

const run = (c, seconds, inputs) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) c.step(DT, inputs);
};

describe('loadouts and config', () => {
  it('quick loadout uses the unlock level of the chosen tier', () => {
    expect(quickLoadout('rex', 3)).toEqual({ characterId: 'rex', tier: 3, level: 20, petId: null });
    expect(quickLoadout('rex', 1).level).toBe(1);
  });

  it('picks a CPU opponent in Vs Computer', () => {
    const cfg = buildMatchConfig({ mode: 'cpu', difficulty: 'medium', p1: { characterId: 'bubbles', tier: 3 } }, () => 0);
    expect(cfg.p1).toEqual(quickLoadout('bubbles', 3));
    expect(cfg.p2).toEqual({ characterId: 'sparkle', level: 20, tier: 3, petId: null });
    expect(cfg.difficulty).toBe('medium');
  });

  it('uses both choices in 2 Players', () => {
    const cfg = buildMatchConfig({ mode: '2p', p1: { characterId: 'bubbles', tier: 1 }, p2: { characterId: 'rex', tier: 2 } });
    expect(cfg.p2).toEqual(quickLoadout('rex', 2));
  });
});

describe('createBattleController', () => {
  it('drives both fighters from inputs in 2 Players', () => {
    const c = createBattleController(buildMatchConfig({ mode: '2p', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }));
    run(c, INTRO_TIME + DT, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    run(c, 0.5, { p1: { ...IDLE_INPUT, moveZ: 1 }, p2: { ...IDLE_INPUT, moveZ: -1 } });
    const [f1, f2] = c.match.world.fighters;
    expect(f1.pos.z).toBeGreaterThan(1);
    expect(f2.pos.z).toBeLessThan(-1);
  });

  it('lets the AI drive player 2 in Vs Computer', () => {
    const rng = mulberry32(7);
    const c = createBattleController(buildMatchConfig({ mode: 'cpu', difficulty: 'hard', p1: { characterId: 'sparkle', tier: 1 } }, rng), rng);
    run(c, INTRO_TIME + 1, { p1: IDLE_INPUT });
    const f2 = c.match.world.fighters[1];
    expect(f2.pos.x).not.toBe(5);
  });

  it('does nothing while paused or after the match ends', () => {
    const c = createBattleController(buildMatchConfig({ mode: '2p', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }));
    c.setPaused(true);
    run(c, 1, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    expect(c.match.stateTime).toBe(INTRO_TIME);
    c.setPaused(false);
    c.match.state = 'matchOver';
    const t = c.match.world.time;
    run(c, 1, { p1: IDLE_INPUT, p2: IDLE_INPUT });
    expect(c.match.world.time).toBe(t);
    expect(c.isOver).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/battleController.test.js`
Expected: FAIL — cannot resolve `../../src/game/battleController.js`.

- [ ] **Step 3: Create `src/game/battleController.js`**

```js
import { createMatch, stepMatch } from '../logic/match.js';
import { createAI, updateAI, pickAIOpponent } from '../logic/ai.js';
import { unlockLevel } from '../logic/progression.js';

export const IDLE_INPUT = Object.freeze({ moveX: 0, moveZ: 0, jump: false, attack: false, special: false });

// Quick-start only: picking a tier sets the level to the tier's unlock level.
// Plan 3 replaces this with real saved levels.
export function quickLoadout(characterId, tier) {
  return { characterId, tier, level: unlockLevel(tier), petId: null };
}

// choice: { mode, difficulty, p1: { characterId, tier }, p2?: { characterId, tier } }
export function buildMatchConfig(choice, rng = Math.random) {
  const p1 = quickLoadout(choice.p1.characterId, choice.p1.tier);
  const p2 = choice.mode === 'cpu'
    ? pickAIOpponent({ playerLevel: p1.level, difficulty: choice.difficulty, playerHasPet: false, rng })
    : quickLoadout(choice.p2.characterId, choice.p2.tier);
  return { mode: choice.mode, difficulty: choice.difficulty, p1, p2 };
}

export function createBattleController(config, rng = Math.random) {
  const match = createMatch({ mode: config.mode, p1: config.p1, p2: config.p2 });
  const ai = config.mode === 'cpu' ? createAI(config.difficulty ?? 'medium', rng) : null;
  let paused = false;

  return {
    match,
    get paused() { return paused; },
    setPaused(value) { paused = value; },
    get isOver() { return match.state === 'matchOver'; },
    // inputs: { p1, p2? } engine input objects
    step(dt, inputs) {
      if (paused || match.state === 'matchOver') return;
      const [f1, f2] = match.world.fighters;
      f1.input = { ...(inputs.p1 ?? IDLE_INPUT) };
      if (ai) updateAI(ai, match.world, f2);
      else f2.input = { ...(inputs.p2 ?? IDLE_INPUT) };
      stepMatch(match, dt);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/battleController.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/battleController.js tests/game/battleController.test.js
git commit -m "feat: add battle controller for match, AI, and inputs"
```

---

### Task 12: Quick-start screen, battle screen, styles, and boot

**Files:**
- Create: `src/ui/quickstart.js`, `src/game/battleScreen.js`, `src/ui/styles.css`
- Modify: `src/main.js` (replace placeholder), `index.html`
- Test: `tests/ui/quickstart.test.js`

- [ ] **Step 1: Write the failing test `tests/ui/quickstart.test.js`**

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderQuickStart } from '../../src/ui/quickstart.js';

function setup(initial) {
  const root = document.createElement('div');
  const picks = [];
  renderQuickStart(root, (choice) => picks.push(choice), initial);
  return { root, picks };
}
const click = (root, selector) => root.querySelector(selector).click();

describe('quick start', () => {
  it('starts Vs Computer with defaults', () => {
    const { root, picks } = setup();
    click(root, '.start-button');
    expect(picks).toEqual([{ mode: 'cpu', difficulty: 'medium', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }]);
  });

  it('hides player 2 in Vs Computer and shows it in 2 Players', () => {
    const { root } = setup();
    expect(root.querySelector('[data-panel="p2"]').hidden).toBe(true);
    click(root, '[data-mode="2p"]');
    expect(root.querySelector('[data-panel="p2"]').hidden).toBe(false);
    expect(root.querySelector('.difficulty-row').hidden).toBe(true);
  });

  it('picks characters, weapon tiers, and difficulty', () => {
    const { root, picks } = setup();
    click(root, '[data-difficulty="hard"]');
    click(root, '[data-panel="p1"] [data-character="bubbles"]');
    const select = root.querySelector('[data-panel="p1"] select');
    expect(select.options).toHaveLength(11);
    expect(select.options[4].textContent).toBe('Tier 5 · Thunder Rod');
    select.value = '5';
    select.dispatchEvent(new Event('change'));
    click(root, '[data-mode="2p"]');
    click(root, '[data-panel="p2"] [data-character="pancake"]');
    click(root, '.start-button');
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'hard', p1: { characterId: 'bubbles', tier: 5 }, p2: { characterId: 'pancake', tier: 1 } });
  });

  it('marks the selected buttons', () => {
    const { root } = setup();
    click(root, '[data-panel="p1"] [data-character="rex"]');
    expect(root.querySelector('[data-panel="p1"] [data-character="rex"]').classList.contains('selected')).toBe(true);
    expect(root.querySelector('[data-panel="p1"] [data-character="sparkle"]').classList.contains('selected')).toBe(false);
  });

  it('remembers the last choice', () => {
    const { root, picks } = setup({ mode: '2p', difficulty: 'easy', p1: { characterId: 'rex', tier: 2 }, p2: { characterId: 'bubbles', tier: 3 } });
    click(root, '.start-button');
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'easy', p1: { characterId: 'rex', tier: 2 }, p2: { characterId: 'bubbles', tier: 3 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/quickstart.test.js`
Expected: FAIL — cannot resolve `../../src/ui/quickstart.js`.

- [ ] **Step 3: Create `src/ui/quickstart.js`**

```js
import { CHARACTERS } from '../data/characters.js';
import { getWeaponLine } from '../data/weapons.js';

const DEFAULT_CHOICE = {
  mode: 'cpu',
  difficulty: 'medium',
  p1: { characterId: 'sparkle', tier: 1 },
  p2: { characterId: 'rex', tier: 1 },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function buttonRow(parent, className, items, dataKey) {
  const row = el('div', `button-row ${className}`, parent);
  for (const [value, label] of items) {
    const b = el('button', 'choice', row, label);
    b.type = 'button';
    b.dataset[dataKey] = value;
  }
  return row;
}

export function renderQuickStart(root, onStart, initial = DEFAULT_CHOICE) {
  const state = clone({ ...DEFAULT_CHOICE, ...initial });
  root.innerHTML = '';
  const screen = el('div', 'screen quickstart', root);
  el('h1', 'logo', screen, 'CHAOS BRAWL');
  el('p', 'subtitle', screen, 'Quick Battle');

  buttonRow(screen, 'mode-row', [['cpu', 'Vs Computer'], ['2p', '2 Players']], 'mode');
  const difficultyRow = buttonRow(screen, 'difficulty-row', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], 'difficulty');

  const panels = el('div', 'player-panels', screen);
  const panelUi = {};
  for (const [id, title, keys] of [['p1', 'Player 1', 'WASD move · Space jump · F attack · G special'], ['p2', 'Player 2', 'Arrows move · Enter jump · K attack · L special']]) {
    const panel = el('div', 'player-panel', panels);
    panel.dataset.panel = id;
    el('h2', null, panel, title);
    const chars = el('div', 'character-grid', panel);
    for (const c of CHARACTERS) {
      const b = el('button', 'character-button', chars, c.name);
      b.type = 'button';
      b.dataset.character = c.id;
      b.style.setProperty('--char-color', `#${c.colors.main.toString(16).padStart(6, '0')}`);
    }
    const label = el('label', 'weapon-label', panel, 'Weapon (test any tier) ');
    const select = el('select', 'weapon-select', label);
    el('p', 'keys-help', panel, keys);
    panelUi[id] = { panel, select };
  }

  const start = el('button', 'start-button', screen, 'FIGHT!');
  start.type = 'button';
  el('p', 'keys-help', screen, 'Esc pauses the game.');

  function fillWeapons(id) {
    const { select } = panelUi[id];
    select.innerHTML = '';
    getWeaponLine(state[id].characterId).forEach((w) => {
      const option = el('option', null, select, `Tier ${w.tier} · ${w.name}`);
      option.value = String(w.tier);
    });
    select.value = String(state[id].tier);
  }

  function refresh() {
    screen.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('selected', b.dataset.mode === state.mode));
    screen.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.toggle('selected', b.dataset.difficulty === state.difficulty));
    difficultyRow.hidden = state.mode !== 'cpu';
    panelUi.p2.panel.hidden = state.mode !== '2p';
    for (const id of ['p1', 'p2']) {
      panelUi[id].panel.querySelectorAll('[data-character]').forEach((b) => b.classList.toggle('selected', b.dataset.character === state[id].characterId));
      fillWeapons(id);
    }
  }

  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) state.mode = b.dataset.mode;
    if (b.dataset.difficulty) state.difficulty = b.dataset.difficulty;
    if (b.dataset.character) {
      const id = b.closest('[data-panel]').dataset.panel;
      state[id].characterId = b.dataset.character;
      state[id].tier = 1;
    }
    if (b === start) {
      onStart(clone(state));
      return;
    }
    refresh();
  });

  for (const id of ['p1', 'p2']) {
    panelUi[id].select.addEventListener('change', () => {
      state[id].tier = Number(panelUi[id].select.value);
    });
  }

  refresh();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/quickstart.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Create `src/game/battleScreen.js`**

```js
import { createRenderer } from '../render/renderer.js';
import { buildArena } from '../render/arena.js';
import { createBattleView } from '../render/view.js';
import { createEffects } from '../render/effects.js';
import { computeCamera, smoothToward, CAMERA } from '../render/math.js';
import { createHud, hudState, bannerFor } from '../ui/hud.js';
import { createKeyboard } from '../input/keyboard.js';
import { createLoop } from './loop.js';
import { createBattleController } from './battleController.js';
import { drainEvents } from '../logic/world.js';
import { DT } from '../logic/constants.js';

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function mountBattle({ root, config, onExit }) {
  root.innerHTML = '';
  const stage = el('div', 'stage', root);
  const gfx = createRenderer(stage);
  gfx.scene.add(buildArena());

  const tintP2 = config.p1.characterId === config.p2.characterId;
  let controller = createBattleController(config);
  let view = createBattleView(gfx.scene, { tintP2 });
  const effects = createEffects({ scene: gfx.scene, container: stage });
  const hud = createHud(stage);
  const keyboard = createKeyboard(window);
  const overlay = el('div', 'overlay', stage);
  overlay.hidden = true;

  const start = computeCamera(controller.match.world.fighters[0].pos, controller.match.world.fighters[1].pos);
  const cam = { pos: { ...start.position }, target: { ...start.target } };
  let resultShown = false;

  function showOverlay(title, buttons) {
    overlay.innerHTML = '';
    const box = el('div', 'overlay-box', overlay);
    el('h2', 'overlay-title', box, title);
    const row = el('div', 'button-row', box);
    for (const { label, onClick } of buttons) {
      const b = el('button', 'choice big', row, label);
      b.type = 'button';
      b.addEventListener('click', onClick);
    }
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  function showPause() {
    showOverlay('Paused', [
      { label: 'Resume', onClick: () => loop.resume() },
      { label: 'Quit', onClick: exit },
    ]);
  }

  function showResults() {
    resultShown = true;
    showOverlay(bannerFor(controller.match), [
      { label: 'Rematch', onClick: rematch },
      { label: 'Back', onClick: exit },
    ]);
  }

  function rematch() {
    view.clear();
    controller = createBattleController(config);
    view = createBattleView(gfx.scene, { tintP2 });
    resultShown = false;
    hideOverlay();
  }

  function step(dt) {
    controller.step(dt, { p1: keyboard.input('p1'), p2: keyboard.input('p2') });
  }

  function render(frameSeconds, paused) {
    if (keyboard.consumePress('Escape') && !resultShown) {
      if (loop.paused) loop.resume();
      else loop.pause();
    }
    keyboard.clearPresses();

    const { world } = controller.match;
    const events = drainEvents(world);
    view.handleEvents(events);
    effects.handleEvents(events, world);

    const dt = paused ? 0 : frameSeconds;
    view.sync(world, dt);

    const [a, b] = world.fighters;
    const goal = computeCamera(a.pos, b.pos);
    for (const k of ['x', 'y', 'z']) {
      cam.pos[k] = smoothToward(cam.pos[k], goal.position[k], CAMERA.smoothing, frameSeconds);
      cam.target[k] = smoothToward(cam.target[k], goal.target[k], CAMERA.smoothing, frameSeconds);
    }
    gfx.camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
    gfx.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
    gfx.camera.updateMatrixWorld();

    const { width, height } = gfx.size();
    effects.update(dt, gfx.camera, width, height);
    hud.update(hudState(controller.match));
    gfx.render();

    if (controller.isOver && !resultShown) showResults();
  }

  const loop = createLoop({
    step,
    render,
    dt: DT,
    onPauseChange: (paused) => {
      if (resultShown) return;
      if (paused) showPause();
      else hideOverlay();
    },
  });

  function exit() {
    loop.stop();
    keyboard.dispose();
    effects.dispose();
    view.clear();
    hud.dispose();
    gfx.dispose();
    root.innerHTML = '';
    onExit();
  }

  loop.start();
  return { exit };
}
```

- [ ] **Step 6: Create `src/ui/styles.css`**

```css
* { box-sizing: border-box; }

html, body, #app {
  margin: 0;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: "Trebuchet MS", "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif;
  background: linear-gradient(#9bdcff, #d0f4ff);
  color: #2b2d42;
  user-select: none;
}

button { font: inherit; cursor: pointer; }

/* ---------- Screens ---------- */

.screen {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 24px 16px 40px;
}

.logo {
  margin: 8px 0 0;
  font-size: clamp(40px, 8vw, 84px);
  letter-spacing: 2px;
  color: #ffd43b;
  -webkit-text-stroke: 3px #7048e8;
  text-shadow: 0 6px 0 #7048e8;
  animation: bounce 1.6s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-8px) rotate(2deg); }
}

.subtitle { margin: 0; font-size: 20px; font-weight: bold; }

.message-text {
  max-width: 520px;
  font-size: 22px;
  text-align: center;
  background: #fff;
  padding: 20px 24px;
  border-radius: 20px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.12);
}

.button-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.choice {
  border: none;
  border-radius: 999px;
  padding: 10px 22px;
  font-size: 18px;
  font-weight: bold;
  background: #fff;
  color: #2b2d42;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15);
  transition: transform 0.1s;
}

.choice:hover { transform: translateY(-2px); }
.choice.selected { background: #7048e8; color: #fff; }
.choice.big { font-size: 24px; padding: 14px 32px; }

.player-panels { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }

.player-panel {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 24px;
  padding: 14px 18px;
  width: min(420px, 92vw);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.1);
}

.player-panel h2 { margin: 0 0 10px; }

.character-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }

.character-button {
  border: 4px solid transparent;
  border-radius: 18px;
  padding: 14px 8px;
  font-size: 17px;
  font-weight: bold;
  background: var(--char-color);
  color: #2b2d42;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}

.character-button.selected { border-color: #2b2d42; transform: scale(1.04); }

.weapon-label { display: block; margin-top: 12px; font-weight: bold; }
.weapon-select { margin-top: 6px; width: 100%; font-size: 16px; padding: 6px; border-radius: 10px; }
.keys-help { margin: 8px 0 0; font-size: 14px; opacity: 0.8; }

.start-button {
  border: none;
  border-radius: 999px;
  padding: 16px 56px;
  font-size: 32px;
  font-weight: bold;
  color: #fff;
  background: #ff6b6b;
  box-shadow: 0 6px 0 #c92a2a;
}

.start-button:active { transform: translateY(4px); box-shadow: 0 2px 0 #c92a2a; }

/* ---------- Battle stage ---------- */

.stage { position: relative; width: 100%; height: 100%; }
.stage canvas { display: block; }

.hud { position: absolute; inset: 0; pointer-events: none; }

.hud-top {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.hud-player { flex: 1; }
.hud-player.right { text-align: right; }

.hud-name {
  font-weight: bold;
  font-size: 18px;
  color: #fff;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
}

.hud-bar {
  height: 22px;
  margin-top: 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  border: 3px solid #fff;
  overflow: hidden;
}

.hud-player.right .hud-bar { transform: scaleX(-1); }

.hud-bar-fill {
  height: 100%;
  background: linear-gradient(#8ce99a, #40c057);
  transition: width 0.15s;
}

.hud-bar-fill.low { background: linear-gradient(#ffa8a8, #fa5252); }

.hud-wins { font-size: 22px; color: #ffd43b; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); }

.hud-timer {
  min-width: 70px;
  text-align: center;
  font-size: 40px;
  font-weight: bold;
  color: #fff;
  background: #7048e8;
  border-radius: 18px;
  padding: 2px 10px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
}

.hud-banner {
  position: absolute;
  top: 38%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: clamp(32px, 7vw, 72px);
  font-weight: bold;
  color: #ffd43b;
  -webkit-text-stroke: 3px #7048e8;
  text-shadow: 0 5px 0 #7048e8;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.15s, transform 0.2s;
}

.hud-banner.show { opacity: 1; transform: scale(1); }

.hud-bottom {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;
}

.hud-abilities { display: flex; gap: 12px; }

.hud-ability { width: 86px; text-align: center; }

.hud-ring {
  --cd: 0;
  width: 58px;
  height: 58px;
  margin: 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(rgba(0, 0, 0, 0.45) calc(var(--cd) * 360deg), #ffd43b 0);
  border: 3px solid #fff;
}

.hud-ability.ready .hud-ring { box-shadow: 0 0 12px #ffd43b; }

.hud-key {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #fff;
  font-weight: bold;
  font-size: 15px;
}

.hud-ability-name {
  margin-top: 4px;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}

.popup-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

.popup {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 30px;
  font-weight: bold;
  -webkit-text-stroke: 2px #2b2d42;
  white-space: nowrap;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(43, 45, 66, 0.45);
}

.overlay[hidden] { display: none; }

.overlay-box {
  background: #fff;
  border-radius: 28px;
  padding: 24px 32px;
  text-align: center;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.15);
}

.overlay-title { margin: 0 0 16px; font-size: 36px; color: #7048e8; }

[hidden] { display: none !important; }
```

- [ ] **Step 7: Replace `src/main.js`**

```js
import './ui/styles.css';
import { isWebGLAvailable } from './render/renderer.js';
import { showMessage } from './ui/messages.js';
import { renderQuickStart } from './ui/quickstart.js';
import { mountBattle } from './game/battleScreen.js';
import { buildMatchConfig } from './game/battleController.js';

const root = document.getElementById('app');
let lastChoice;

function showStart() {
  renderQuickStart(root, (choice) => {
    lastChoice = choice;
    mountBattle({ root, config: buildMatchConfig(choice), onExit: showStart });
  }, lastChoice);
}

if (isWebGLAvailable()) {
  showStart();
} else {
  showMessage(root, "Your browser can't show 3D games. Try Chrome, Edge, Safari, or Firefox!");
}
```

- [ ] **Step 8: Update `index.html` title and theme**

Replace the `<head>` contents with:

```html
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#9bdcff" />
    <title>Chaos Brawl</title>
```

- [ ] **Step 9: Run all tests and build**

Run: `npm test && npx vite build`
Expected: all tests PASS; build succeeds (a chunk-size warning about three.js is fine).

- [ ] **Step 10: Smoke-run the dev server**

Run: `npx vite --port 5173 --strictPort` in the background, then `curl -s http://localhost:5173/ | grep -c "Chaos Brawl"`
Expected: `1`. Stop the server afterwards.

- [ ] **Step 11: Commit**

```bash
git add src/ui/quickstart.js src/game/battleScreen.js src/ui/styles.css src/main.js index.html tests/ui/quickstart.test.js
git commit -m "feat: add quick start and playable battle screen"
```

---

### Task 13: Character balance tuning

The Plan 1 review found that in AI-vs-AI, Sir Sparkle (melee) almost never wins. The ranged characters back away at the same speed. Chef Pancake also loses to both ranged characters. This task adds a measurable balance test and then tunes the numbers until it passes.

**Files:**
- Create: `tools/balance.js`, `tools/balance-report.mjs`, `tests/balance.test.js`
- Modify (tuning only): `src/data/characters.js`, `src/data/weapons.js` (the `BASICS` section only), `src/logic/ai.js` (movement decisions only)
- Modify if stats change: `tests/fighter.test.js`, `tests/ai.test.js`, spec Characters table

- [ ] **Step 1: Create `tools/balance.js`**

```js
import { CHARACTER_IDS } from '../src/data/characters.js';
import { createMatch, stepMatch } from '../src/logic/match.js';
import { createAI, updateAI } from '../src/logic/ai.js';
import { drainEvents } from '../src/logic/world.js';
import { mulberry32 } from '../src/logic/random.js';
import { tierForLevel } from '../src/logic/progression.js';
import { DT } from '../src/logic/constants.js';

const MAX_STEPS = 40000;

export function playMatch({ c1, c2, level, seed, difficulty = 'hard' }) {
  const tier = tierForLevel(level);
  const match = createMatch({
    mode: 'cpu',
    p1: { characterId: c1, level, tier, petId: null },
    p2: { characterId: c2, level, tier, petId: null },
  });
  const rng = mulberry32(seed);
  const ai1 = createAI(difficulty, rng);
  const ai2 = createAI(difficulty, rng);
  const [f1, f2] = match.world.fighters;
  for (let i = 0; i < MAX_STEPS && match.state !== 'matchOver'; i++) {
    updateAI(ai1, match.world, f1);
    updateAI(ai2, match.world, f2);
    stepMatch(match, DT);
    drainEvents(match.world);
  }
  return match.winner;
}

// Every ordered non-mirror pair, at each level and seed. Draws count half.
export function winRates({ levels = [1, 50, 100], seeds = [1, 2, 3, 4], difficulty = 'hard' } = {}) {
  const score = Object.fromEntries(CHARACTER_IDS.map((id) => [id, { points: 0, games: 0 }]));
  const matrix = Object.fromEntries(CHARACTER_IDS.map((id) => [id, Object.fromEntries(CHARACTER_IDS.map((o) => [o, 0]))]));
  for (const level of levels) {
    for (const seed of seeds) {
      for (const c1 of CHARACTER_IDS) {
        for (const c2 of CHARACTER_IDS) {
          if (c1 === c2) continue;
          const winner = playMatch({ c1, c2, level, seed, difficulty });
          score[c1].games += 1;
          score[c2].games += 1;
          if (winner === 'p1') { score[c1].points += 1; matrix[c1][c2] += 1; }
          else if (winner === 'p2') { score[c2].points += 1; matrix[c2][c1] += 1; }
          else { score[c1].points += 0.5; score[c2].points += 0.5; }
        }
      }
    }
  }
  const rates = Object.fromEntries(CHARACTER_IDS.map((id) => [id, score[id].points / score[id].games]));
  return { rates, matrix };
}
```

- [ ] **Step 2: Create `tools/balance-report.mjs`**

```js
import { winRates } from './balance.js';

const { rates, matrix } = winRates();
console.log('Overall win rate (hard AI vs hard AI, levels 1/50/100):');
for (const [id, rate] of Object.entries(rates)) console.log(`  ${id.padEnd(8)} ${(rate * 100).toFixed(0)}%`);
console.log('\nWins (row beat column):');
const ids = Object.keys(matrix);
console.log(`${''.padEnd(9)}${ids.map((i) => i.padEnd(9)).join('')}`);
for (const a of ids) console.log(`${a.padEnd(9)}${ids.map((b) => String(a === b ? '-' : matrix[a][b]).padEnd(9)).join('')}`);
```

- [ ] **Step 3: Write the failing test `tests/balance.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { winRates } from '../tools/balance.js';

describe('character balance (hard AI vs hard AI)', () => {
  it('every character wins 30%–70% of non-mirror matches', () => {
    const { rates } = winRates();
    for (const [id, rate] of Object.entries(rates)) {
      expect(rate, `${id} win rate ${(rate * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.3);
      expect(rate, `${id} win rate ${(rate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.7);
    }
  });
});
```

- [ ] **Step 4: Run it and the report to see the starting point**

Run: `npx vitest run tests/balance.test.js; node tools/balance-report.mjs`
Expected: FAIL (Sparkle and probably Pancake below 30%). Save the report output for your notes.

- [ ] **Step 5: Tune until the test passes**

Change one knob at a time and re-run `node tools/balance-report.mjs` after each change. Allowed knobs:
- `src/data/characters.js`: `speed`, `damage`, `defense`, `preferredRange`. Keep each character's identity: Sparkle is the strongest hitter up close, Bubbles has the longest range, Pancake is the toughest, and Rex is the fastest or tied for fastest.
- `src/data/weapons.js` **`BASICS` only**: basic `range`, `cooldown`, `damage` base and per-tier growth. Do not change specials; they match the spec tables.
- `src/logic/ai.js`: movement and retreat decisions only, e.g. the retreat threshold `d < pref - 1.5`, or letting a melee AI use a dash special to close distance when far.

Suggested first tries, in order:
1. Sparkle `speed` 1.25.
2. Retreat only when `d < pref - 2.5`.
3. Pancake `speed` 1.0 and `preferredRange` 2.5.

Stop when every rate is between 30% and 70%. Do not edit the balance test.

- [ ] **Step 6: Update tests that encode changed numbers**

If a character's `speed` or `damage` changed, update `tests/fighter.test.js` → "starts with full energy and level-scaled stats": set the expected `damageMult` to `<damage> * 1.495` and `speedMult` to `<speed> * 1.099`, using the new numbers. If a basic `range` changed, update `tests/ai.test.js` → "estimates reach" to the new `range + 0.6`. Do not change any other test.

- [ ] **Step 7: Update the spec's Characters table**

In `docs/superpowers/specs/2026-10-11-chaos-brawl-design.md`, update the "Base stats" column if any character's stats changed in a way the text no longer describes.

- [ ] **Step 8: Run everything**

Run: `npm test`
Expected: all tests PASS, including `tests/balance.test.js` and `tests/headless.test.js`.

- [ ] **Step 9: Commit**

```bash
git add tools/balance.js tools/balance-report.mjs tests/balance.test.js src/data/characters.js src/data/weapons.js src/logic/ai.js tests/fighter.test.js tests/ai.test.js docs/superpowers/specs/2026-10-11-chaos-brawl-design.md
git commit -m "feat: tune character balance with an AI win-rate test"
```

---

### Task 14: Play-check and wrap-up

This task needs a human, the user, to play. The controller runs the server and asks the user to try the game.

**Files:**
- Modify: `docs/superpowers/plans/2026-10-11-chaos-brawl-roadmap.md`

- [ ] **Step 1: Final automated check**

Run: `npm test && npx vite build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 2: Start the dev server**

Run (background): `npm run dev -- --port 5173`
Expected: Vite prints `Local: http://localhost:5173/`.

- [ ] **Step 3: User play-check checklist**

Ask the user to open http://localhost:5173 and check:
1. The quick-start screen shows the bouncing logo, mode buttons, and character buttons.
2. **Vs Computer**: the fight starts with "ROUND 1", "GET READY...", then "FIGHT!". WASD moves, Space jumps, F attacks, and G uses the special. The CPU fights back.
3. Hits show pop-up words and sparkles. Energy bars go down. Cooldown rings fill back up.
4. A knockout makes the loser spin and poof into confetti. Rounds advance, and the winner gets a results box with Rematch and Back.
5. **2 Players**: arrows, Enter, K and L control Player 2. A mirror match has a different color for Player 2.
6. Try a few weapon tiers, including tier 11. Weapons look different, and the projectiles, freezes, shields and zones are visible.
7. Esc pauses and resumes. Switching browser tabs pauses the game.
8. Resizing the window keeps the game filling the screen.

Record any problems the user reports, then fix them with superpowers:systematic-debugging before continuing.

- [ ] **Step 4: Stop the dev server**

- [ ] **Step 5: Update the roadmap**

In `docs/superpowers/plans/2026-10-11-chaos-brawl-roadmap.md`:
- Set Plan 2's status to `Done`.
- Under "Carry-over notes", remove the balance item, and add the final balance numbers from `node tools/balance-report.mjs`.
- Add any play-check feedback that was deferred.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-10-11-chaos-brawl-roadmap.md
git commit -m "docs: mark Plan 2 done"
```

---

## Done criteria for Plan 2

- `npm test` passes. This covers the Plan 1 tests plus new tests for render math, loop, keyboard, visuals, models, arena, view, effects, HUD, renderer check, controller, quick start and balance.
- `npx vite build` succeeds.
- The user has played Vs Computer and 2 Players in the browser, and the checklist passes.
- `src/logic` and `src/data` still do not import Three.js or touch the DOM.
