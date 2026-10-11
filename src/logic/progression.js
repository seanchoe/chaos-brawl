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
