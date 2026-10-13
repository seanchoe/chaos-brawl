// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderPetShop } from '../../src/ui/petShop.js';
import { createSave } from '../../src/logic/save.js';
import { PETS } from '../../src/data/pets.js';

function setup(save = createSave()) {
  const root = document.createElement('div');
  const previews = { add: vi.fn(), start: vi.fn(), dispose: vi.fn() };
  const onChange = vi.fn();
  const onBack = vi.fn();
  renderPetShop(root, save, { onChange, onBack, createPreviews: () => previews });
  const card = (id) => root.querySelector(`[data-pet="${id}"]`);
  const buy = (id) => card(id).querySelector('.pet-buy');
  return { root, previews, onChange, onBack, card, buy };
}

describe('pet shop', () => {
  it('shows a card with a spinning preview for every pet', () => {
    const { root, previews } = setup();
    expect(root.querySelectorAll('.pet-card')).toHaveLength(PETS.length);
    expect(previews.add).toHaveBeenCalledTimes(PETS.length);
    expect(previews.start).toHaveBeenCalled();
    expect(root.querySelector('[data-pet="hoot"]').textContent).toContain('Feather Shot');
  });

  it('lets you buy what you can afford and says how many more coins the rest need', () => {
    const { buy } = setup();
    expect(buy('biscuit').disabled).toBe(false);
    expect(buy('biscuit').textContent).toBe('Buy for 50 coins');
    expect(buy('whiskers').disabled).toBe(true);
    expect(buy('whiskers').textContent).toBe('Need 50 more coins');
  });

  it('buys a pet, spends the coins, and keeps it forever', () => {
    const { root, buy, card, onChange } = setup();
    buy('biscuit').click();
    const saved = onChange.mock.calls[0][0];
    expect(saved.coins).toBe(0);
    expect(saved.ownedPets).toEqual(['biscuit']);
    expect(buy('biscuit').textContent).toBe('Owned ✓');
    expect(buy('biscuit').disabled).toBe(true);
    expect(card('biscuit').classList.contains('owned')).toBe(true);
    expect(root.querySelector('.coin-count').textContent).toBe('0 coins');
    expect(root.querySelector('.shop-notice').textContent).toContain('You got Biscuit');
    buy('biscuit').click();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('goes back with the latest save and stops the previews', () => {
    const { root, buy, previews, onBack } = setup({ ...createSave(), coins: 500 });
    buy('ember').click();
    root.querySelector('.back-button').click();
    expect(previews.dispose).toHaveBeenCalled();
    expect(onBack.mock.calls[0][0].ownedPets).toEqual(['ember']);
  });

  it('still works without 3D previews', () => {
    const root = document.createElement('div');
    renderPetShop(root, createSave(), { createPreviews: () => null });
    expect(root.querySelectorAll('.pet-swatch')).toHaveLength(PETS.length);
  });
});
