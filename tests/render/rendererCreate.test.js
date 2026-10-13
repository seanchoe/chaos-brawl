// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  class FakeRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.shadowMap = {};
    }
    setPixelRatio(r) { calls.push(['pixelRatio', r]); }
    setSize() {}
    forceContextLoss() { calls.push(['forceContextLoss']); }
    dispose() { calls.push(['dispose']); }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

const { createRenderer } = await import('../../src/render/renderer.js');

describe('createRenderer', () => {
  beforeEach(() => { calls.length = 0; });

  it('updates the pixel ratio on resize', () => {
    const gfx = createRenderer(document.createElement('div'));
    calls.length = 0;
    window.devicePixelRatio = 3;
    window.dispatchEvent(new Event('resize'));
    expect(calls).toContainEqual(['pixelRatio', 2]);
    window.devicePixelRatio = 1;
    window.dispatchEvent(new Event('resize'));
    expect(calls).toContainEqual(['pixelRatio', 1]);
    gfx.dispose();
  });

  it('releases the GL context before disposing', () => {
    const gfx = createRenderer(document.createElement('div'));
    calls.length = 0;
    gfx.dispose();
    expect(calls.map((c) => c[0])).toEqual(['forceContextLoss', 'dispose']);
  });
});
