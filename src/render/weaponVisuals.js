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
