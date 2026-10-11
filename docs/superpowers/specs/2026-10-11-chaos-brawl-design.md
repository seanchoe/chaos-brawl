# Chaos Brawl — Design Spec

A kid-friendly, browser-based 3D battle game. Two characters fight in a small arena using weapons and special abilities. Each character's weapon evolves through 11 forms as the character levels from 1 to 100, with progress saved between matches.

## Goals

- Fun, readable, cartoony 3D fighting that a young kid can pick up in a minute.
- Two modes: **Vs Computer** and **2 Players** (shared keyboard).
- Long-term progression: levels 1–100 per character, weapon evolves every 10 levels.
- No art/audio asset files required: all models built from Three.js primitives, sounds via Web Audio synthesis.

## Non-goals (YAGNI)

- Online multiplayer, accounts, servers.
- Gamepad / touch controls (keyboard only for v1).
- Physics engine — simple custom movement and collision is enough.

## Kid-friendly rules

- No blood, gore, or violent words. Hits show comic pop-ups: "BONK!", "SPLAT!", "ZAP!", "BOING!", "POW!".
- Health is shown as "energy". When it hits zero, the character spins, gets dizzy, and poofs into stars/confetti, then reappears for the results screen waving.
- Bright, saturated low-poly colors; friendly round character shapes; cheerful synthesized sounds.
- Arenas are walled floating islands — no falling off.
- Losing always grants XP, so nobody gets stuck.

## Tech stack

- **Three.js** for rendering, **Vite** for dev server/build, plain JavaScript ES modules.
- **Vitest** for unit tests of game logic.
- Save data in `localStorage`.

## Architecture

Game logic is separated from rendering so it can be tested headlessly.

```
src/
  main.js                 bootstraps app, screen router
  data/
    characters.js         4 characters: name, colors, base stats, weapon line
    weapons.js            44 weapon definitions (data only)
  logic/
    progression.js        XP curve, level-ups, tier unlocks (pure)
    save.js               localStorage load/save with versioning + fallback
    fighter.js            fighter state: position, velocity, energy, cooldowns, status effects
    combat.js             attack resolution, damage, knockback, status effects
    abilities.js          effect primitives (see below) — create hitboxes/projectiles/zones
    match.js              rounds, timer, win detection, XP award
    ai.js                 computer opponent (easy/medium/hard)
  render/
    scene.js              renderer, camera, lights, arena
    models.js             build character + weapon meshes from primitives
    effects.js            particles, pop-up text, projectile visuals
  input/
    keyboard.js           key state for P1/P2 bindings
  ui/
    screens.js            title, mode select, character select, weapon select, results
    hud.js                energy bars, round/timer, cooldown icons
  audio/
    sfx.js                Web Audio synthesized sound effects
tests/                    Vitest tests for logic/
```

The simulation runs at a fixed timestep (60 Hz) in `logic/`. Rendering reads fighter/projectile state each frame and draws it. `logic/` never imports Three.js.

## Gameplay

- **Arena:** circular island (radius ~12 units) with a low wall; camera is a side-angled 3D view that tracks both fighters, zooming to keep them in frame.
- **Movement:** move in 2D on the ground plane (x/z), jump, always face the opponent.
- **Energy:** 100 per round.
- **Match:** best of 3 rounds, 60 s each. On timeout the fighter with more energy wins the round (tie → both get a point; if still tied after 3 rounds, sudden-death round 4).
- **Each weapon** has a **basic attack** (short cooldown) and a **special ability** (longer cooldown, shown on HUD).

### Controls

| Action  | Player 1 | Player 2 |
|---------|----------|----------|
| Move    | W A S D  | Arrow keys |
| Jump    | Space    | Enter    |
| Attack  | F        | K        |
| Special | G        | L        |
| Pause   | Esc      | Esc      |

In Vs Computer mode, Player 1 uses the P1 keys.

### Ability effect primitives

Every attack/special is composed from these reusable primitives with parameters:

| Primitive | Parameters |
|-----------|-----------|
| `melee` | damage, range, arc angle, knockback |
| `projectile` | damage, speed, size, count, spread angle, pierce, homing, onHit effects |
| `dash` | distance, duration, damage on contact |
| `burst` | radius around self (or target point), damage, knockback |
| `shield` | duration, damage reduction (1.0 = full block) |
| `heal` | amount |
| `slow` | duration, speed multiplier (on hit) |
| `freeze` | duration (on hit; target can't move or act) |
| `stun` | duration (dizzy stars; can't act) |
| `pull` | strength (pulls target toward a point) |
| `zone` | placed area: radius, duration, applies slow/damage per second |
| `leap` | jump to target area then `burst` on landing |

A special may chain several primitives (e.g. `shield` then `burst` when it ends).

### Status effect caps (fairness)

- Freeze/stun max 1.2 s; after one ends, the target is immune to freeze/stun for 2 s.
- Slow max 50%.

## Characters

| Character | Style | Base stats |
|-----------|-------|-----------|
| **Sir Sparkle** — little knight in pink/silver armor | Close-range melee | Speed medium, damage high |
| **Bubbles** — tiny wizard with a big starry hat | Long-range magic | Speed medium, damage low, range long |
| **Chef Pancake** — round chef with tall hat | Mid-range throwing | Speed slow, energy-tough (takes 10% less damage) |
| **Robo Rex** — friendly robot dinosaur | Blasters | Speed fast, damage medium |

Same-character mirror matches are allowed; Player 2 gets an alternate color tint.

## Weapons (11 forms per character)

Tier *n* unlocks at level `1` (tier 1) and `10 × (n − 1)` for tiers 2–11 (10, 20, … 100). Basic attacks get slightly stronger by tier; the special ability is unique per tier. Damage figures are base values before level scaling.

### Sir Sparkle — basic attack: sword swing (`melee`)

| Tier | Lvl | Weapon | Special |
|------|-----|--------|---------|
| 1 | 1 | Foam Sword | **Dash Strike** — dash forward, bonk on contact (10) |
| 2 | 10 | Wooden Sword | **Spin Swing** — `burst` around self (12) |
| 3 | 20 | Shiny Sword | **Shield Block** — full block for 1.5 s |
| 4 | 30 | Sparkle Saber | **Sparkle Wave** — sword-wave `projectile` (14) |
| 5 | 40 | Thunder Blade | **Zap Dash** — dash (12) + `stun` 0.6 s |
| 6 | 50 | Frost Edge | **Frost Wave** — wave `projectile` (12) + `freeze` 1 s |
| 7 | 60 | Dragon Fang | **Fire Spin** — `burst` (16) with big knockback |
| 8 | 70 | Crystal Claymore | **Crystal Guard** — block 1.5 s then crystal `burst` (14) |
| 9 | 80 | Comet Sword | **Comet Slam** — `leap` at opponent, landing `burst` (18) |
| 10 | 90 | Royal Moonblade | **Triple Moon** — 3 spread wave `projectile`s (10 each) |
| 11 | 100 | Rainbow Starblade | **Rainbow Storm** — `burst` (15) + 5 rainbow waves (8 each) |

### Bubbles — basic attack: bubble shot (`projectile`)

| Tier | Lvl | Weapon | Special |
|------|-----|--------|---------|
| 1 | 1 | Bubble Wand | **Big Bubble** — slow big bubble (10) + `slow` 2 s |
| 2 | 10 | Soapy Staff | **Bubble Trio** — 3 spread bubbles (7 each) |
| 3 | 20 | Sparkle Wand | **Blink** — instant short teleport `dash` |
| 4 | 30 | Frosty Wand | **Snowball** — `projectile` (10) + `freeze` 1 s |
| 5 | 40 | Thunder Rod | **Lightning Zap** — very fast piercing `projectile` (15) |
| 6 | 50 | Flower Staff | **Healing Petals** — `heal` 20 |
| 7 | 60 | Moon Wand | **Bubble Shield** — 70% damage reduction for 3 s |
| 8 | 70 | Storm Scepter | **Mini Tornado** — slow `projectile` that `pull`s (10) |
| 9 | 80 | Phoenix Staff | **Fire Bird** — large homing `projectile` (18) + knockback |
| 10 | 90 | Starlight Scepter | **Star Rain** — `burst` at opponent's position after 0.5 s (20) |
| 11 | 100 | Galaxy Bubble Staff | **Galaxy Bubble** — giant bubble (12) + `freeze` 1.2 s + star rain (12) |

### Chef Pancake — basic attack: utensil smack (`melee`, medium range)

| Tier | Lvl | Weapon | Special |
|------|-----|--------|---------|
| 1 | 1 | Spatula | **Pancake Toss** — `projectile` (10) |
| 2 | 10 | Frying Pan | **Pan Block** — full block for 1.5 s, "BOING!" |
| 3 | 20 | Rolling Pin | **Rolling Charge** — long `dash` (12) + knockback |
| 4 | 30 | Pie Launcher | **Cream Pie** — `projectile` (12) + `slow` 2 s, "SPLAT!" |
| 5 | 40 | Ice Cream Scoop | **Brain Freeze** — `projectile` (10) + `freeze` 1 s |
| 6 | 50 | Pizza Cutter | **Pizza Frisbee** — piercing, returning `projectile` (14) |
| 7 | 60 | Jelly Blaster | **Jelly Puddle** — `zone` slow 50% for 4 s |
| 8 | 70 | Cupcake Cannon | **Cupcake Trio** — 3 spread `projectile`s (8 each) |
| 9 | 80 | Hot Sauce Sprayer | **Spicy Spin** — `burst` (16) + big knockback |
| 10 | 90 | Grand Wok | **Snack Time** — `heal` 15 + 50% shield 2 s |
| 11 | 100 | Golden Mega-Whisk | **Sprinkle Tornado** — `burst` (14) + `pull` + 6 sprinkle shots (5 each) |

### Robo Rex — basic attack: foam dart (`projectile`, fast)

| Tier | Lvl | Weapon | Special |
|------|-----|--------|---------|
| 1 | 1 | Toy Blaster | **Rocket Hop** — `dash` with jets (8) |
| 2 | 10 | Water Squirter | **Splash Wave** — `burst` (10) + knockback |
| 3 | 20 | Dart Launcher | **Triple Dart** — 3 spread darts (7 each) |
| 4 | 30 | Magnet Gun | **Magnet Pull** — `pull` opponent close + bonk (10) |
| 5 | 40 | Laser Tag Zapper | **Laser Beam** — very fast piercing `projectile` (15) |
| 6 | 50 | Goo Cannon | **Goo Trap** — `zone` slow 50% + 3 dmg/s for 4 s |
| 7 | 60 | Freeze Ray | **Freeze Beam** — `projectile` (10) + `freeze` 1.2 s |
| 8 | 70 | Dino Roar Cannon | **Mega Roar** — `burst` (14) + `stun` 0.8 s |
| 9 | 80 | Robo Shield Arm | **Force Field** — full block 2 s |
| 10 | 90 | Thunder Lizard Launcher | **Missile Swarm** — 5 homing mini-rockets (5 each) |
| 11 | 100 | Super Nova Cannon | **Nova Blast** — huge piercing `projectile` (25) + knockback |

## Progression

- Each character has its own level (1–100) and XP, saved in `localStorage`. Progress is per device, shared by whoever plays.
- XP to go from level L to L+1: `40 + 2 × L`. About 3 wins reach level 10; about 90 wins reach level 100.
- XP per match: win **150**, loss **75**, plus **+5 per round won**. In 2-player mode both characters earn XP. In Vs Computer, only Player 1's character earns XP.
- **Level scaling:** damage multiplier `1 + 0.005 × (level − 1)` (up to +49.5% at level 100); move speed `+0.1% per level`. Cooldowns do not change with level, so higher levels feel stronger without letting anyone spam specials.
- **Weapon select:** before a match, each player picks any unlocked weapon tier for their character (defaults to the highest unlocked).
- **Results screen:** shows XP gained, level-up animations, and a big "NEW WEAPON UNLOCKED!" celebration showing the new weapon and its special.
- **Save robustness:** save data has a `version` field. Corrupt or missing data falls back to a fresh save without crashing. The settings menu has a "Reset progress" option with a confirm step.

## Computer opponent (AI)

- Difficulty: **Easy** (slow reactions 0.8 s, rarely uses special, never blocks), **Medium** (0.45 s, uses special when in range), **Hard** (0.25 s, spaces at preferred range, dodges projectiles sometimes, uses shields when attacked).
- The AI's character and weapon tier: random character, level ≈ player's level (Easy −10, Medium ±0, Hard +5; clamped 1–100), weapon = highest tier unlocked at that level.
- Behavior: a small state machine (approach / keep distance / attack / special / retreat) driven by distance and the character's preferred range.

## Screens / flow

Title ("CHAOS BRAWL" bouncing logo) → Mode (Vs Computer / 2 Players; Vs Computer then asks difficulty) → Character select (shows level + XP bar per character) → Weapon select (unlocked tiers selectable, locked ones show "Unlocks at Lvl N") → Battle (HUD: energy bars, names, levels, round dots, timer, special cooldown rings, "ROUND 1… FIGHT!") → Results (winner dance, XP, level-ups, unlock celebration) → Rematch / Change characters / Title.

Pause (Esc): Resume / Quit to title. A "How to play" panel on the title screen shows controls.

## Audio

Synthesized Web Audio effects: swing whoosh, bonk, splat, zap, bubble pop, level-up jingle, victory fanfare. Mute toggle saved in settings. Audio starts after the first user interaction (browser autoplay rules).

## Error handling

- WebGL unavailable → friendly message screen ("Your browser can't show 3D games — try Chrome, Edge, Safari or Firefox").
- `localStorage` unavailable/blocked → game works with in-memory progress; a small notice says progress won't be saved.
- Window resize → renderer and camera update.
- Tab hidden → game auto-pauses; fixed-timestep loop clamps large frame gaps so nothing teleports.

## Testing

- **Vitest unit tests** for `logic/`: XP curve and level-ups (including multi-level-ups and the cap at 100), tier unlock levels, save load/fallback/versioning, damage + level scaling, shields, status effect caps and immunity, round/match win logic including timeouts and ties, and validation that all 44 weapon definitions are well-formed (valid primitives, required fields, 11 per character, unlock levels).
- **AI smoke test:** headless simulation of AI vs AI matches that must finish without errors and produce a winner.
- **Manual play-check** in the browser for feel, visuals, and both modes.
