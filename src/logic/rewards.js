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
