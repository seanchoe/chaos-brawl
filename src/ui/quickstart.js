import { CHARACTERS } from '../data/characters.js';
import { getWeaponLine } from '../data/weapons.js';
import { getPet } from '../data/pets.js';
import { isTouchDevice } from '../input/touch.js';

const DEFAULT_CHOICE = {
  mode: 'cpu',
  difficulty: 'medium',
  p1: { characterId: 'sparkle', tier: 1, petId: null },
  p2: { characterId: 'rex', tier: 1, petId: null },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function buttonRow(parent, className, items, dataKey) {
  const row = el('div', `button-row ${className}`, parent);
  for (const [value, label] of items) {
    const b = el('button', 'choice', row, label);
    b.type = 'button';
    b.dataset[dataKey] = value;
  }
  return row;
}

// wallet: { coins, ownedPets, lastPets } from the save. onShop opens the Pet Shop.
export function coinBadge(parent, coins) {
  const badge = el('div', 'coin-badge', parent);
  el('span', 'coin-icon', badge);
  el('span', 'coin-count', badge, `${coins} coins`);
  return badge;
}

export function renderQuickStart(root, onStart, initial = DEFAULT_CHOICE, { wallet = null, onShop = null } = {}) {
  const touch = isTouchDevice();
  const ownedPets = wallet?.ownedPets ?? [];
  const state = clone({ ...DEFAULT_CHOICE, ...initial });
  for (const id of ['p1', 'p2']) {
    const petId = state[id].petId ?? wallet?.lastPets?.[id] ?? null;
    state[id].petId = ownedPets.includes(petId) ? petId : null;
  }
  root.innerHTML = '';
  const screen = el('div', 'screen quickstart', root);
  if (wallet) {
    const bar = el('div', 'wallet-bar', screen);
    coinBadge(bar, wallet.coins);
    if (onShop) {
      const shop = el('button', 'choice shop-button', bar, 'Pet Shop');
      shop.type = 'button';
      shop.addEventListener('click', onShop);
    }
  }
  el('h1', 'logo', screen, 'CHAOS BRAWL');
  el('p', 'subtitle', screen, 'Quick Battle');

  buttonRow(screen, 'mode-row', [['cpu', 'Vs Computer'], ['2p', '2 Players']], 'mode');
  const difficultyRow = buttonRow(screen, 'difficulty-row', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], 'difficulty');

  const panels = el('div', 'player-panels', screen);
  const panelUi = {};
  for (const [id, title, keys] of [['p1', 'Player 1', 'WASD move · Space jump · F attack · G special'], ['p2', 'Player 2', 'Arrows move · Enter jump · K attack · L special']]) {
    const panel = el('div', 'player-panel', panels);
    panel.dataset.panel = id;
    el('h2', null, panel, title);
    const chars = el('div', 'character-grid', panel);
    for (const c of CHARACTERS) {
      const b = el('button', 'character-button', chars, c.name);
      b.type = 'button';
      b.dataset.character = c.id;
      b.style.setProperty('--char-color', `#${c.colors.main.toString(16).padStart(6, '0')}`);
    }
    const label = el('label', 'weapon-label', panel, 'Weapon (test any tier) ');
    const select = el('select', 'weapon-select', label);
    const petLabel = el('label', 'weapon-label', panel, 'Pet ');
    const petSelect = el('select', 'pet-select', petLabel);
    el('option', null, petSelect, 'No pet').value = '';
    for (const petId of ownedPets) {
      const pet = getPet(petId);
      el('option', null, petSelect, `${pet.name} the ${pet.species}`).value = petId;
    }
    petSelect.value = state[id].petId ?? '';
    if (ownedPets.length === 0) el('p', 'keys-help', panel, 'No pets yet. Buy one in the Pet Shop!');
    el('p', 'keys-help', panel, touch ? 'Use the stick and buttons on your side of the screen.' : keys);
    panelUi[id] = { panel, select, petSelect };
  }

  const start = el('button', 'start-button', screen, 'FIGHT!');
  start.type = 'button';
  el('p', 'keys-help', screen, touch ? 'Tap II to pause the game.' : 'Esc pauses the game.');

  function fillWeapons(id) {
    const { select } = panelUi[id];
    select.innerHTML = '';
    getWeaponLine(state[id].characterId).forEach((w) => {
      const option = el('option', null, select, `Tier ${w.tier} · ${w.name}`);
      option.value = String(w.tier);
    });
    select.value = String(state[id].tier);
  }

  function refresh() {
    screen.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('selected', b.dataset.mode === state.mode));
    screen.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.toggle('selected', b.dataset.difficulty === state.difficulty));
    difficultyRow.hidden = state.mode !== 'cpu';
    panelUi.p2.panel.hidden = state.mode !== '2p';
    for (const id of ['p1', 'p2']) {
      panelUi[id].panel.querySelectorAll('[data-character]').forEach((b) => b.classList.toggle('selected', b.dataset.character === state[id].characterId));
      fillWeapons(id);
    }
  }

  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) state.mode = b.dataset.mode;
    if (b.dataset.difficulty) state.difficulty = b.dataset.difficulty;
    if (b.dataset.character) {
      const id = b.closest('[data-panel]').dataset.panel;
      state[id].characterId = b.dataset.character;
      state[id].tier = 1;
    }
    if (b === start) {
      onStart(clone(state));
      return;
    }
    refresh();
  });

  for (const id of ['p1', 'p2']) {
    panelUi[id].select.addEventListener('change', () => {
      state[id].tier = Number(panelUi[id].select.value);
    });
    panelUi[id].petSelect.addEventListener('change', () => {
      state[id].petId = panelUi[id].petSelect.value || null;
    });
  }

  refresh();
}
