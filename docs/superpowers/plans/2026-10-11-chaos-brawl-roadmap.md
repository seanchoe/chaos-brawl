# Chaos Brawl — Build Roadmap

Spec: `docs/superpowers/specs/2026-10-11-chaos-brawl-design.md`

The game is built in 5 plans. Each plan ends with working, tested software. Each later plan is written in full detail once the previous plan is done, so it can reference real code.

| # | Plan | Delivers | Status |
|---|------|----------|--------|
| 1 | **Core game engine** (`2026-10-11-plan-1-core-engine.md`) | Project scaffold; all data (4 characters, 44 weapons, 8 pets); headless game logic: progression/XP, save, shop, fighters, combat, all 12 ability primitives, movement, projectiles, zones, pets, match rounds, rewards, AI, Training Ground session. Fully unit-tested, including AI-vs-AI headless matches. | Written |
| 2 | **Playable battle** | Three.js scene + arena, character/weapon/pet models built from primitives, projectile/zone visuals, pop-up text and particles, keyboard input for P1/P2, battle HUD (energy bars, timer, round dots, cooldown rings), fixed-timestep game loop with tab-hidden pause and resize handling, WebGL-unavailable message. Quick-start: Vs Computer and 2 Players with default loadouts. | To write |
| 3 | **Menus, progression & audio** | Title, mode, difficulty, character select (levels/XP bars), weapon select (locked tiers), pet picker, results screen (XP, coins, level-ups, "NEW WEAPON UNLOCKED!"), pause menu, settings (mute, reset progress), How to Play, save integration and storage-unavailable notice, synthesized sound effects. | To write |
| 4 | **Training Ground** | Practice yard scene, Training Bot model and behaviors, Tab options panel (weapon switcher, toggles, bot behavior), Show Hit Areas rendering, live stats panel, options remembered in save. | To write |
| 5 | **Pet Shop** | Shop screen with rotating 3D pet previews, buy/owned/not-enough-coins states, coin display on title, pet models + follow/strike animations in battle, final full play-through check. | To write |
