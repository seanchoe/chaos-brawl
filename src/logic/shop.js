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
