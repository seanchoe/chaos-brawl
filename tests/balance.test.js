import { describe, it, expect } from 'vitest';
import { winRates } from '../tools/balance.js';

describe('character balance (hard AI vs hard AI)', () => {
  it('every character wins 30%–70% of non-mirror matches', () => {
    const { rates } = winRates();
    for (const [id, rate] of Object.entries(rates)) {
      expect(rate, `${id} win rate ${(rate * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.3);
      expect(rate, `${id} win rate ${(rate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.7);
    }
  });
});
