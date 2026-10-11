# Chaos Brawl — Build Roadmap

Spec: `docs/superpowers/specs/2026-10-11-chaos-brawl-design.md`

The game is built in 5 plans. Each plan ends with working, tested software. Each later plan is written in full detail once the previous plan is done, so it can reference real code.

| # | Plan | Delivers | Status |
|---|------|----------|--------|
| 1 | **Core game engine** (`2026-10-11-plan-1-core-engine.md`) | Project scaffold; all data (4 characters, 44 weapons, 8 pets); headless game logic: progression/XP, save, shop, fighters, combat, all 12 ability primitives, movement, projectiles, zones, pets, match rounds, rewards, AI, Training Ground session. Fully unit-tested, including AI-vs-AI headless matches. | Done |
| 2 | **Playable battle** | Three.js scene + arena, character/weapon/pet models built from primitives, projectile/zone visuals, pop-up text and particles, keyboard input for P1/P2, battle HUD (energy bars, timer, round dots, cooldown rings), fixed-timestep game loop with tab-hidden pause and resize handling, WebGL-unavailable message. Quick-start: Vs Computer and 2 Players with default loadouts. | To write |
| 3 | **Menus, progression & audio** | Title, mode, difficulty, character select (levels/XP bars), weapon select (locked tiers), pet picker, results screen (XP, coins, level-ups, "NEW WEAPON UNLOCKED!"), pause menu, settings (mute, reset progress), How to Play, save integration and storage-unavailable notice, synthesized sound effects. | To write |
| 4 | **Training Ground** | Practice yard scene, Training Bot model and behaviors, Tab options panel (weapon switcher, toggles, bot behavior), Show Hit Areas rendering, live stats panel, options remembered in save. | To write |
| 5 | **Pet Shop** | Shop screen with rotating 3D pet previews, buy/owned/not-enough-coins states, coin display on title, pet models + follow/strike animations in battle, final full play-through check. | To write |

## Carry-over notes from the Plan 1 final review

For Plan 2 (rendering / play-check):
- **Balance (important):** in AI-vs-AI, Sir Sparkle (melee) almost never beats the ranged characters — kiters retreat at equal speed. Tune during the play-check: melee speed boost or gap-closer, less AI kiting, or AI uses Dash Strike/Zap Dash to close. Rounds are also short (5–11 s); consider more energy or less damage.
- The world doesn't step during `intro`/`roundOver`: mid-jump winners hang in the air, projectiles freeze. Either keep stepping physics with zero input during `roundOver` or handle it in the renderer.
- Renderer reads: match `state/stateTime/timeLeft/round/wins/roundWinner/winner`; fighter `pos/facing/energy/ko/shield/guardHits/dash/leap/status/character.colors` (`alt` tints P2 in mirrors); `cooldownFraction()` for HUD rings; projectiles `id/style/size/pos/vel`; zones `id/style/radius/until`; pets keyed by `ownerId` with `def.id/pos/facing/strikeAnim`.
- Events are drained once per rendered frame with `drainEvents`. Melee/most bursts have no `style` — map visuals from the `ability` event name or hit `popup`. Weapons have no visual data; `render/models.js` needs its own per-weapon visual table.
- Inputs must be set (keyboard or `updateAI`) before each `stepMatch`/`stepTraining`. `shape` events are always emitted; filter by `showHitAreas`.

Small optional fixes:
- `separateFighters` runs after the arena clamp, causing a little jitter at the wall — clamp after separating.
- Hard AI shields only by distance; could react to `findIncomingProjectile`.
- Pull ignores shields (decide if intended).
- `createMatch` doesn't check tier unlocks — Plan 3 weapon select must enforce it.
