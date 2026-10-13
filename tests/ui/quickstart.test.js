// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderQuickStart } from '../../src/ui/quickstart.js';

function setup(initial) {
  const root = document.createElement('div');
  const picks = [];
  renderQuickStart(root, (choice) => picks.push(choice), initial);
  return { root, picks };
}
const click = (root, selector) => root.querySelector(selector).click();

describe('quick start', () => {
  it('starts Vs Computer with defaults', () => {
    const { root, picks } = setup();
    click(root, '.start-button');
    expect(picks).toEqual([{ mode: 'cpu', difficulty: 'medium', p1: { characterId: 'sparkle', tier: 1, petId: null }, p2: { characterId: 'rex', tier: 1, petId: null } }]);
  });

  it('hides player 2 in Vs Computer and shows it in 2 Players', () => {
    const { root } = setup();
    expect(root.querySelector('[data-panel="p2"]').hidden).toBe(true);
    click(root, '[data-mode="2p"]');
    expect(root.querySelector('[data-panel="p2"]').hidden).toBe(false);
    expect(root.querySelector('.difficulty-row').hidden).toBe(true);
  });

  it('picks characters, weapon tiers, and difficulty', () => {
    const { root, picks } = setup();
    click(root, '[data-difficulty="hard"]');
    click(root, '[data-panel="p1"] [data-character="bubbles"]');
    const select = root.querySelector('[data-panel="p1"] select');
    expect(select.options).toHaveLength(11);
    expect(select.options[4].textContent).toBe('Tier 5 · Thunder Rod');
    select.value = '5';
    select.dispatchEvent(new Event('change'));
    click(root, '[data-mode="2p"]');
    click(root, '[data-panel="p2"] [data-character="pancake"]');
    click(root, '.start-button');
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'hard', p1: { characterId: 'bubbles', tier: 5, petId: null }, p2: { characterId: 'pancake', tier: 1, petId: null } });
  });

  it('marks the selected buttons', () => {
    const { root } = setup();
    click(root, '[data-panel="p1"] [data-character="rex"]');
    expect(root.querySelector('[data-panel="p1"] [data-character="rex"]').classList.contains('selected')).toBe(true);
    expect(root.querySelector('[data-panel="p1"] [data-character="sparkle"]').classList.contains('selected')).toBe(false);
  });

  it('remembers the last choice', () => {
    const { root, picks } = setup({ mode: '2p', difficulty: 'easy', p1: { characterId: 'rex', tier: 2 }, p2: { characterId: 'bubbles', tier: 3 } });
    click(root, '.start-button');
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'easy', p1: { characterId: 'rex', tier: 2, petId: null }, p2: { characterId: 'bubbles', tier: 3, petId: null } });
  });
});

describe('quick start wallet and pets', () => {
  const wallet = { coins: 120, ownedPets: ['biscuit', 'hops'], lastPets: { p1: 'hops', p2: null } };

  function setupWallet(initial, w = wallet) {
    const root = document.createElement('div');
    const picks = [];
    const onShop = vi.fn();
    renderQuickStart(root, (choice) => picks.push(choice), initial, { wallet: w, onShop });
    return { root, picks, onShop };
  }

  it('shows coins and opens the Pet Shop', () => {
    const { root, onShop } = setupWallet();
    expect(root.querySelector('.coin-count').textContent).toBe('120 coins');
    root.querySelector('.shop-button').click();
    expect(onShop).toHaveBeenCalledOnce();
  });

  it('offers only owned pets and starts with the last one picked', () => {
    const { root, picks } = setupWallet();
    const select = root.querySelector('[data-panel="p1"] .pet-select');
    expect([...select.options].map((o) => o.value)).toEqual(['', 'biscuit', 'hops']);
    expect(select.value).toBe('hops');
    select.value = 'biscuit';
    select.dispatchEvent(new Event('change'));
    root.querySelector('.start-button').click();
    expect(picks[0].p1.petId).toBe('biscuit');
    expect(picks[0].p2.petId).toBeNull();
  });

  it('drops a remembered pet that is not owned, and points to the shop when you have none', () => {
    const { root, picks } = setupWallet({ p1: { characterId: 'rex', tier: 1, petId: 'ember' } }, { coins: 0, ownedPets: [], lastPets: { p1: null, p2: null } });
    expect(root.textContent).toContain('Buy one in the Pet Shop');
    root.querySelector('.start-button').click();
    expect(picks[0].p1.petId).toBeNull();
  });
});
