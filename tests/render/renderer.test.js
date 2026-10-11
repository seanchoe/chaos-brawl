// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isWebGLAvailable } from '../../src/render/renderer.js';
import { showMessage } from '../../src/ui/messages.js';

const fakeDoc = (getContext) => ({ createElement: () => ({ getContext }) });

describe('isWebGLAvailable', () => {
  it('is true when a WebGL context can be made', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: { WebGLRenderingContext: function W() {} } })).toBe(true);
  });

  it('is false without a context, without WebGL, or on errors', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => null), win: { WebGLRenderingContext: function W() {} } })).toBe(false);
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: {} })).toBe(false);
    expect(isWebGLAvailable({ doc: { createElement: () => { throw new Error('no'); } }, win: { WebGLRenderingContext: function W() {} } })).toBe(false);
  });
});

describe('showMessage', () => {
  it('replaces the page with a friendly message', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>old</p>';
    showMessage(root, 'Oops! Try another browser.');
    expect(root.querySelector('.message-text').textContent).toBe('Oops! Try another browser.');
    expect(root.textContent).not.toContain('old');
  });
});
