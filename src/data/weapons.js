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
      { type: 'pull', range: 8, strength: 28 },
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
