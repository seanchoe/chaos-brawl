// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
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
    expect(picks).toEqual([{ mode: 'cpu', difficulty: 'medium', p1: { characterId: 'sparkle', tier: 1 }, p2: { characterId: 'rex', tier: 1 } }]);
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
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'hard', p1: { characterId: 'bubbles', tier: 5 }, p2: { characterId: 'pancake', tier: 1 } });
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
    expect(picks[0]).toEqual({ mode: '2p', difficulty: 'easy', p1: { characterId: 'rex', tier: 2 }, p2: { characterId: 'bubbles', tier: 3 } });
  });
});
