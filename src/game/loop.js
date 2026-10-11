export const MAX_FRAME = 0.25;

export function advanceClock(accumulator, frameSeconds, dt) {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
  let steps = 0;
  while (acc >= dt) {
    acc -= dt;
    steps += 1;
  }
  return { steps, accumulator: acc };
}

// step(dt) runs at a fixed rate; render(frameSeconds, paused) runs once per animation frame.
export function createLoop({
  step,
  render,
  dt,
  onPauseChange = () => {},
  raf = (cb) => globalThis.requestAnimationFrame(cb),
  cancel = (id) => globalThis.cancelAnimationFrame?.(id),
  now = () => globalThis.performance.now(),
  doc = globalThis.document,
}) {
  let running = false;
  let paused = false;
  let accumulator = 0;
  let last = 0;
  let generation = 0;
  let frameId = null;

  function makeFrame(gen) {
    return (t) => frame(t, gen);
  }

  function frame(t, gen) {
    if (!running || gen !== generation) return;
    const seconds = Math.min(Math.max((t - last) / 1000, 0), MAX_FRAME);
    last = t;
    if (!paused) {
      const r = advanceClock(accumulator, seconds, dt);
      accumulator = r.accumulator;
      for (let i = 0; i < r.steps; i++) step(dt);
    }
    render(seconds, paused);
    frameId = raf(makeFrame(generation));
  }

  function onVisibility() {
    if (doc.hidden && !paused) loop.pause();
  }

  const loop = {
    start() {
      if (running) return;
      running = true;
      accumulator = 0;
      last = now();
      doc?.addEventListener('visibilitychange', onVisibility);
      generation += 1;
      frameId = raf(makeFrame(generation));
    },
    stop() {
      running = false;
      generation += 1;
      if (frameId !== null) cancel(frameId);
      frameId = null;
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
    pause() {
      if (paused) return;
      paused = true;
      onPauseChange(true);
    },
    resume() {
      if (!paused) return;
      paused = false;
      accumulator = 0;
      onPauseChange(false);
    },
    get paused() { return paused; },
    get running() { return running; },
  };
  return loop;
}
