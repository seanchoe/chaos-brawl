import { describe, it, expect } from 'vitest';
import { advanceClock, createLoop, MAX_FRAME } from '../../src/game/loop.js';

const DT = 1 / 60;

describe('advanceClock', () => {
  it('turns frame time into whole steps', () => {
    expect(advanceClock(0, 1 / 30, DT).steps).toBe(2);
    const r = advanceClock(0.01, 0.01, DT);
    expect(r.steps).toBe(1);
    expect(r.accumulator).toBeCloseTo(0.02 - DT);
  });

  it('clamps long frames so nothing teleports', () => {
    const { steps } = advanceClock(0, 5, DT);
    expect(steps).toBeGreaterThanOrEqual(Math.floor(MAX_FRAME / DT) - 1);
    expect(steps).toBeLessThanOrEqual(Math.floor(MAX_FRAME / DT));
  });

  it('ignores negative time', () => {
    expect(advanceClock(0, -1, DT)).toEqual({ steps: 0, accumulator: 0 });
  });
});

function fakeEnv() {
  const callbacks = [];
  const doc = new EventTarget();
  doc.hidden = false;
  return { callbacks, doc, raf: (cb) => { callbacks.push(cb); return callbacks.length; } };
}

describe('createLoop', () => {
  it('runs fixed steps and renders every frame', () => {
    const env = fakeEnv();
    let steps = 0;
    const renders = [];
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: (s, paused) => renders.push([s, paused]), raf: env.raf, now: () => 0, doc: env.doc });
    loop.start();
    env.callbacks.shift()(1000 / 30);
    expect(steps).toBe(2);
    expect(renders).toHaveLength(1);
    expect(renders[0][0]).toBeCloseTo(1 / 30);
    expect(renders[0][1]).toBe(false);
    expect(env.callbacks).toHaveLength(1);
  });

  it('does not step while paused but still renders', () => {
    const env = fakeEnv();
    let steps = 0;
    const changes = [];
    let lastPaused = null;
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: (s, p) => { lastPaused = p; }, raf: env.raf, now: () => 0, doc: env.doc, onPauseChange: (p) => changes.push(p) });
    loop.start();
    loop.pause();
    env.callbacks.shift()(100);
    expect(steps).toBe(0);
    expect(lastPaused).toBe(true);
    loop.resume();
    expect(changes).toEqual([true, false]);
    env.callbacks.shift()(100 + 1000 / 30);
    expect(steps).toBe(2);
  });

  it('auto-pauses when the tab is hidden', () => {
    const env = fakeEnv();
    const changes = [];
    const loop = createLoop({ dt: DT, step: () => {}, render: () => {}, raf: env.raf, now: () => 0, doc: env.doc, onPauseChange: (p) => changes.push(p) });
    loop.start();
    env.doc.hidden = true;
    env.doc.dispatchEvent(new Event('visibilitychange'));
    expect(loop.paused).toBe(true);
    expect(changes).toEqual([true]);
  });

  it('stops scheduling frames after stop', () => {
    const env = fakeEnv();
    let steps = 0;
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: () => {}, raf: env.raf, now: () => 0, doc: env.doc });
    loop.start();
    loop.stop();
    env.callbacks.shift()(1000);
    expect(steps).toBe(0);
    expect(env.callbacks).toHaveLength(0);
    expect(loop.running).toBe(false);
  });

  it('cancels the pending frame on stop', () => {
    const env = fakeEnv();
    const cancelled = [];
    const loop = createLoop({ dt: DT, step: () => {}, render: () => {}, raf: env.raf, cancel: (id) => cancelled.push(id), now: () => 0, doc: env.doc });
    loop.start();
    loop.stop();
    expect(cancelled).toEqual([1]);
  });

  it('ignores a stale frame from before a restart and keeps a single chain', () => {
    const env = fakeEnv();
    let steps = 0;
    const loop = createLoop({ dt: DT, step: () => { steps += 1; }, render: () => {}, raf: env.raf, cancel: () => {}, now: () => 0, doc: env.doc });
    loop.start();
    const stale = env.callbacks.shift();
    loop.stop();
    loop.start();
    stale(1000);
    expect(steps).toBe(0);
    expect(env.callbacks).toHaveLength(1);
    env.callbacks.shift()(1000 / 30);
    expect(steps).toBe(2);
    expect(env.callbacks).toHaveLength(1);
  });
});
