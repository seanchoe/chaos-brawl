import { PETS } from '../data/pets.js';
import { buyPet, ownsPet, coinsNeeded } from '../logic/shop.js';
import { createPetPreviews } from '../render/petPreview.js';
import { coinBadge } from './quickstart.js';

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function defaultPreviews() {
  try {
    return createPetPreviews();
  } catch {
    return null; // The cards still work without the spinning 3D pets.
  }
}

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

// onChange(save) runs after each purchase so the caller can store it. Returns { dispose }.
export function renderPetShop(root, save, { onChange = () => {}, onBack = () => {}, createPreviews = defaultPreviews } = {}) {
  let current = save;
  root.innerHTML = '';
  const screen = el('div', 'screen pet-shop', root);

  const bar = el('div', 'wallet-bar', screen);
  const back = el('button', 'choice back-button', bar, '← Back');
  back.type = 'button';
  let badge = coinBadge(bar, current.coins);

  el('h1', 'logo', screen, 'PET SHOP');
  el('p', 'subtitle', screen, 'Pets follow you into battle and help you fight!');
  const notice = el('p', 'shop-notice', screen);
  notice.hidden = true;

  const previews = createPreviews();
  const grid = el('div', 'pet-grid', screen);
  const cards = PETS.map((pet) => {
    const card = el('div', 'pet-card', grid);
    card.dataset.pet = pet.id;
    card.style.setProperty('--pet-color', hex(pet.colors.main));
    if (previews) previews.add(el('canvas', 'pet-preview', card), pet);
    else el('div', 'pet-preview pet-swatch', card);
    el('h2', 'pet-name', card, pet.name);
    el('p', 'pet-species', card, pet.species);
    el('p', 'pet-move', card, pet.move.name);
    el('p', 'pet-description', card, pet.move.description);
    const buy = el('button', 'pet-buy', card);
    buy.type = 'button';
    buy.dataset.buy = pet.id;
    return { pet, card, buy };
  });
  previews?.start();

  function refresh() {
    badge.remove();
    badge = coinBadge(bar, current.coins);
    for (const { pet, card, buy } of cards) {
      const owned = ownsPet(current, pet.id);
      const short = coinsNeeded(current, pet.id);
      card.classList.toggle('owned', owned);
      buy.disabled = owned || short > 0;
      if (owned) buy.textContent = 'Owned ✓';
      else if (short > 0) buy.textContent = `Need ${short} more coins`;
      else buy.textContent = `Buy for ${pet.price} coins`;
    }
  }

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b || b.disabled) return;
    const result = buyPet(current, b.dataset.buy);
    if (!result.ok) return;
    current = result.save;
    const pet = PETS.find((p) => p.id === b.dataset.buy);
    notice.textContent = `You got ${pet.name} the ${pet.species}! Pick ${pet.name} before your next fight.`;
    notice.hidden = false;
    refresh();
    onChange(current);
  });

  function dispose() {
    previews?.dispose();
  }
  back.addEventListener('click', () => {
    dispose();
    onBack(current);
  });

  refresh();
  return { dispose };
}
