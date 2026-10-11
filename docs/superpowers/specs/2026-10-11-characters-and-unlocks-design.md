# Chaos Brawl — More Characters & Weapon Unlocks (Design Addendum)

This adds to `2026-10-11-chaos-brawl-design.md`. Where the two disagree, this document wins.

## Summary

- **4 new characters**, each with 11 weapons. That makes 8 characters and 88 weapons.
- **Unlocking costs coins.** Reaching a weapon's level makes it *available*. You then spend coins to unlock it. New characters are also unlocked with coins.
- The 4 original characters and every tier 1 weapon are free.
- **Balance** must hold on Easy, Medium and Hard, not just Hard.

## Unlock rules

### Weapons
- A weapon tier is **available** when the character's level is at least `unlockLevel(tier)` (1, 10, 20 … 100, unchanged).
- A weapon is **owned** when it has been bought. Tier 1 is always owned.
- **Price:** `20 × (tier − 1)` coins. That is 20 for tier 2, 40 for tier 3, up to 200 for tier 11, or 1,100 coins for a whole line.
- A weapon can be bought only if it is available, not yet owned, and the player has enough coins. Tiers can be bought in any order once they are available.
- Players can only fight with **owned** weapons: in battle, in 2 Players, and in the Training Ground. Owned weapons stay owned forever.

### Characters
- The 4 original characters (Sir Sparkle, Bubbles, Chef Pancake, Robo Rex) are owned from the start.
- New characters cost coins:

| Character | Price |
|-----------|-------|
| Ninja Mittens | 150 |
| Princess Frost | 250 |
| Captain Splash | 350 |
| DJ Boombot | 450 |

- A newly bought character starts at level 1 with its tier 1 weapon.
- In 2 Players, both players choose from the same owned characters and weapons, since they share one save on the device.

### Computer opponent
- The computer may use **any** character, including locked ones, as a sneak peek of what you can unlock.
- Its weapon is the highest tier for its level, whether or not you own it, as before.

### Where you buy (UI, built in Plan 3b)
- **Character select:** each locked character shows a lock and an "Unlock for N 🪙" button.
- **Weapon select:** each tier shows one of these states:
  - **Owned:** selectable.
  - **Available:** "Unlock for N 🪙", or "Need N more 🪙" (disabled) if you can't afford it.
  - **Not reached:** "Reach Lv N" (disabled).
- Buying plays a big "UNLOCKED!" celebration and deducts the coins.
- The quick-start "pick any tier" test dropdown is removed when Plan 3b's menus replace the quick-start screen.

## Save format (version 2)

- `characters[id]` is now `{ level, xp, owned, ownedTiers }`.
  - `owned` is a boolean.
  - `ownedTiers` is a sorted array of tier numbers and always includes 1.
- Every character id (all 8) is always present.
- **Migration from version 1:**
  - The 4 original characters become `owned: true`, with `ownedTiers` set to every tier already available at their saved level. Earned weapons stay unlocked.
  - The 4 new characters are added at `{ level: 1, xp: 0, owned: false, ownedTiers: [1] }`.
  - Coins, pets and settings carry over.
- **Normalization:**
  - Unknown tiers are dropped and duplicates removed; tier 1 is always present.
  - Original characters are always `owned: true`.
  - A saved `owned` value for a new character must be a boolean, otherwise it becomes `false`.
- Corrupt or unknown-version data still falls back to a fresh save.

## New characters

Their stats sit next to the originals in `src/data/characters.js`.

| Character | Look | Style | Speed | Damage | Defense (damage taken ×) | Preferred range |
|-----------|------|-------|-------|--------|-------------------------|-----------------|
| **Ninja Mittens** | A small cat in a ninja mask and scarf | Very fast and close up, but fragile | 1.3 | 1.0 | 1.15 | 1.2 |
| **Princess Frost** | An ice princess with a crown and cape | Slows and freezes from mid range | 1.0 | 0.85 | 1.0 | 5.5 |
| **Captain Splash** | A round pirate with a hat and eye patch | Heavy hitter with big pushes, a bit slow | 0.85 | 1.25 | 0.95 | 1.6 |
| **DJ Boombot** | A boxy robot with headphones and a speaker chest | Sound blasts all around itself | 1.0 | 0.9 | 1.0 | 2.0 |

The starting values above are tuned by the balance test. Each character's identity must hold:
- Mittens is the fastest character.
- Frost is the best at freezing and slowing.
- Splash has the biggest knockback.
- Boombot's attacks mostly hit all around it.

The original identity rule "Rex is the fastest" becomes "Rex is the fastest blaster".

### Basic attacks (they get a little stronger each tier)

| Character | Basic attack | Definition |
|-----------|--------------|------------|
| Mittens | **Paw Swipe** | `melee` damage `4.5 + 0.35(t−1)`, range 1.7, arc 120°, knockback 2, cooldown 0.3, "SWISH!" |
| Frost | **Ice Shard** | `projectile` damage `5 + 0.3(t−1)`, speed 15, size 0.3, life 1.0, cooldown 0.5, "TINK!" |
| Splash | **Hook Swing** | `melee` damage `7.5 + 0.45(t−1)`, range 2.3, arc 100°, knockback 5, cooldown 0.65, "CLONK!" |
| Boombot | **Bass Thump** | `burst` at self, radius 2.4, damage `4.5 + 0.3(t−1)`, knockback 3, cooldown 0.6, "THUMP!" |

### Ninja Mittens

| Tier | Lvl | Weapon | Special (cooldown) | Steps |
|------|-----|--------|--------------------|-------|
| 1 | 1 | Paper Fan | **Fan Gust** (4) | projectile 8 dmg, speed 14, size 0.6, life 0.8, knockback 8, "WHOOSH!" |
| 2 | 10 | Bamboo Stick | **Quick Dash** (4) | dash forward 6 over 0.2 s, 9 dmg, knockback 3, "DASH!" |
| 3 | 20 | Toy Shuriken | **Star Toss** (4) | 3 projectiles, spread 30°, 6 dmg each, speed 20, size 0.25, life 0.8, "TING!" |
| 4 | 30 | Yarn Whip | **Yarn Snag** (7) | pull range 7, strength 24; then melee after 0.3 s, 10 dmg, range 2, arc 140°, "SNAG!" |
| 5 | 40 | Smoke Bombs | **Smoke Puff** (6) | smoke zone where Mittens stands (radius 2.2, 3 s, slow 50%), then blink away 5 |
| 6 | 50 | Moon Claws | **Claw Flurry** (6) | burst at self, radius 2.4, 13 dmg, knockback 3, stun 0.5 s, "SCRITCH!" |
| 7 | 60 | Thunder Kunai | **Zap Kunai** (5) | piercing projectile 14 dmg, speed 30, size 0.25, life 0.6, "ZAP!" |
| 8 | 70 | Cherry Blossom Blade | **Petal Storm** (6) | 5 projectiles, spread 50°, 6 dmg each, speed 14, size 0.3, life 1.0, "FLUTTER!" |
| 9 | 80 | Shadow Katana | **Shadow Strike** (7) | dash forward 8 over 0.25 s, 18 dmg, knockback 6, "SHING!" |
| 10 | 90 | Dragon Scroll | **Dragon Pounce** (7) | leap 0.5 s, landing burst radius 2.6, 19 dmg, knockback 6, "POUNCE!" |
| 11 | 100 | Golden Cat Saber | **Nine Lives** (12) | heal 25; full shield 1.5 s |

### Princess Frost

| Tier | Lvl | Weapon | Special (cooldown) | Steps |
|------|-----|--------|--------------------|-------|
| 1 | 1 | Snowflake Wand | **Frosty Breath** (4) | projectile 8 dmg, speed 10, size 0.6, life 1.2, slow 40% for 2 s, "BRRR!" |
| 2 | 10 | Icicle Scepter | **Icicle Trio** (4) | 3 projectiles, spread 30°, 7 dmg each, speed 16, size 0.3, life 1.0, "TINK!" |
| 3 | 20 | Snow Globe | **Snow Globe Shield** (9) | shield 70% for 2.5 s |
| 4 | 30 | Frost Mirror | **Mirror Blink** (5) | blink away 5 |
| 5 | 40 | Ice Skates | **Skate Dash** (5) | dash forward 7 over 0.35 s, 10 dmg, knockback 3, slow 40% for 1.5 s, "SWOOSH!" |
| 6 | 50 | Blizzard Fan | **Blizzard** (8) | snow zone at target, radius 2.8, 4 s, slow 50%, 3 dmg/s |
| 7 | 60 | Crystal Crown | **Crown Freeze** (8) | burst at self, radius 3, 10 dmg, freeze 1 s, "BRRR!" |
| 8 | 70 | Glacier Staff | **Glacier Spike** (8) | burst at target after 0.5 s, radius 2, 18 dmg, freeze 0.8 s, "CRACK!" |
| 9 | 80 | Aurora Ribbon | **Aurora Glow** (10) | heal 20 |
| 10 | 90 | Snow Queen Scepter | **Avalanche** (8) | 5 homing projectiles (turn 2.5), spread 70°, 5 dmg each, speed 11, size 0.35, life 1.8, "POOF!" |
| 11 | 100 | Diamond Ice Staff | **Eternal Winter** (11) | snow zone at self, radius 3.5, 4 s, slow 50%, 3 dmg/s; projectile 14 dmg, speed 12, size 0.7, life 1.2, freeze 1.2 s, "SPARKLE!" |

### Captain Splash

| Tier | Lvl | Weapon | Special (cooldown) | Steps |
|------|-----|--------|--------------------|-------|
| 1 | 1 | Toy Hook | **Hook Grab** (6) | pull range 7, strength 24; then melee after 0.3 s, 10 dmg, range 2.3, arc 140°, knockback 3, "YOINK!" |
| 2 | 10 | Bubble Pistol | **Splash Shot** (4) | projectile 10 dmg, speed 14, size 0.45, life 1.0, knockback 7, "SPLASH!" |
| 3 | 20 | Treasure Map | **X Marks the Spot** (8) | burst at target after 0.8 s, radius 2.4, 20 dmg, knockback 4, "KA-CHING!" |
| 4 | 30 | Anchor | **Anchor Slam** (7) | leap 0.6 s, landing burst radius 2.8, 18 dmg, knockback 8, "CLANG!" |
| 5 | 40 | Squid Ink Cannon | **Ink Splat** (5) | projectile 11 dmg, speed 12, size 0.5, life 1.1, slow 40% for 2 s, "SPLAT!" |
| 6 | 50 | Parrot Pal Blaster | **Parrot Peck** (6) | 2 homing projectiles (turn 3), spread 30°, 8 dmg each, speed 12, size 0.35, life 1.6, "SQUAWK!" |
| 7 | 60 | Barrel Launcher | **Rolling Barrel** (6) | piercing projectile 14 dmg, speed 9, size 0.8, life 1.6, knockback 8, "BONK!" |
| 8 | 70 | Wave Trident | **Tidal Wave** (7) | piercing projectile 14 dmg, speed 11, size 1.1, life 1.1, knockback 10, "SPLOOSH!" |
| 9 | 80 | Kraken Gauntlet | **Kraken Grab** (8) | pull range 9, strength 30; then burst at self after 0.35 s, radius 2.6, 12 dmg, stun 0.7 s, "SQUISH!" |
| 10 | 90 | Ship's Cannon | **Cannon Volley** (8) | 3 projectiles, spread 24°, 10 dmg each, speed 16, size 0.45, life 1.0, knockback 5, "BOOM!" |
| 11 | 100 | Golden Galleon Cannon | **Mega Broadside** (11) | burst at self, radius 3, 14 dmg, knockback 8, "KA-BOOM!"; 5 projectiles, spread 60°, 8 dmg each, speed 16, size 0.45, life 1.0, "BOOM!" |

### DJ Boombot

| Tier | Lvl | Weapon | Special (cooldown) | Steps |
|------|-----|--------|--------------------|-------|
| 1 | 1 | Toy Microphone | **Sing-Along** (4) | projectile 8 dmg, speed 14, size 0.5, life 1.0, stun 0.4 s, "LA-LA!" |
| 2 | 10 | Tambourine | **Jingle Spin** (5) | burst at self, radius 2.8, 11 dmg, knockback 7, "JINGLE!" |
| 3 | 20 | Boombox | **Bass Drop** (7) | burst at target after 0.6 s, radius 2.4, 17 dmg, knockback 4, "BWOMP!" |
| 4 | 30 | Disco Ball | **Disco Shield** (9) | shield 60% for 3 s |
| 5 | 40 | Electric Guitar | **Power Chord** (5) | piercing projectile 15 dmg, speed 26, size 0.4, life 0.7, "RIFF!" |
| 6 | 50 | Drum Sticks | **Drum Roll** (6) | dash forward 6 over 0.3 s, 12 dmg, knockback 4, stun 0.5 s, "BA-DUM!" |
| 7 | 60 | Keytar | **Echo Notes** (7) | 4 homing projectiles (turn 2.5), spread 60°, 5 dmg each, speed 12, size 0.3, life 1.6, "DOO-WOP!" |
| 8 | 70 | Speaker Tower | **Sound Wall** (8) | sound zone at target, radius 2.6, 4 s, slow 40%, 3 dmg/s |
| 9 | 80 | Turntables | **Scratch Pull** (8) | pull range 8, strength 26; then burst at self after 0.35 s, radius 2.6, 13 dmg, knockback 5, "WIKKA!" |
| 10 | 90 | Laser Light Show | **Laser Show** (7) | 5 piercing projectiles, spread 60°, 6 dmg each, speed 24, size 0.25, life 0.8, "ZAP!" |
| 11 | 100 | Golden Mega Speaker | **Encore!** (11) | burst at self, radius 3.4, 16 dmg, knockback 6, stun 0.8 s, "ENCORE!"; heal 15 |

### New visual styles

Each style needs an entry in the render tables.
- **Projectile styles:** `gust`, `shuriken`, `kunai`, `petal`, `snowflake`, `icicle`, `iceShard`, `diamond`, `water`, `ink`, `parrot`, `barrel`, `tidal`, `cannonball`, `note`, `chord`.
- **Zone styles:** `smoke`, `snow`, `sound`.
- **Weapon visuals:** each of the 44 new weapons gets a head shape and a color that's unique within its line. New head shapes may be added, such as a fan, a hook, a microphone or a guitar.

## Balance

- The balance test covers all 8 characters on **Hard, Medium and Easy** AI (both sides at the same difficulty).
- On each difficulty, every character must win between 30% and 70% of non-mirror matches at levels 1, 50 and 100.
- Tuning may change character stats, basic attacks, AI movement and decision logic, and the **numbers** of the new characters' specials (not their effects). The original 44 specials stay as they are in the main spec.

## Testing

- **Data validation:** 8 characters, 88 weapons, unique names, valid steps, and every style has a visual.
- **Unlock logic:**
  - Price formula.
  - A purchase fails if the tier isn't reached, is already owned, or there aren't enough coins.
  - Buying deducts coins.
  - Tier 1 is always owned.
  - Character prices are charged, and original characters can't be bought.
  - Owned checks are applied when building match and training loadouts.
- **Save v2:** fresh save shape, migration from v1 (earned tiers kept, new characters added), and normalization of bad data.
- **Models:** every new character builds with every weapon.
- **Balance:** the test for the 3 difficulties and the headless AI-vs-AI test across all 8 characters.
