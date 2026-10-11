import { expect } from 'vitest';
import { STEP_TYPES, STEP_REQUIRED, EFFECT_TYPES } from '../src/logic/stepTypes.js';

export function checkSteps(steps, where) {
  expect(Array.isArray(steps), `${where} steps`).toBe(true);
  expect(steps.length, `${where} has steps`).toBeGreaterThan(0);
  for (const step of steps) {
    expect(STEP_TYPES, `${where} step type ${step.type}`).toContain(step.type);
    for (const key of STEP_REQUIRED[step.type]) {
      expect(typeof step[key], `${where} ${step.type}.${key}`).toBe('number');
    }
    if (step.damage !== undefined) expect(step.damage).toBeGreaterThanOrEqual(0);
    for (const e of step.effects ?? []) expect(EFFECT_TYPES).toContain(e.type);
    if (step.onEnd) checkSteps(step.onEnd, `${where} onEnd`);
  }
}
