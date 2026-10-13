// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isWebGLAvailable } from '../../src/render/renderer.js';
import { showMessage } from '../../src/ui/messages.js';

const fakeDoc = (getContext) => ({ createElement: () => ({ getContext }) });

describe('isWebGLAvailable', () => {
  it('is true when a WebGL2 context can be made', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: { WebGL2RenderingContext: function W() {} } })).toBe(true);
  });

  it('is false when only WebGL1 is available', () => {
    const getContext = (type) => (type === 'webgl' ? {} : null);
    expect(isWebGLAvailable({ doc: fakeDoc(getContext), win: { WebGLRenderingContext: function W() {} } })).toBe(false);
    expect(isWebGLAvailable({ doc: fakeDoc(getContext), win: { WebGL2RenderingContext: function W() {}, WebGLRenderingContext: function W() {} } })).toBe(false);
  });

  it('is false without a context, without WebGL, or on errors', () => {
    expect(isWebGLAvailable({ doc: fakeDoc(() => null), win: { WebGL2RenderingContext: function W() {} } })).toBe(false);
    expect(isWebGLAvailable({ doc: fakeDoc(() => ({})), win: {} })).toBe(false);
    expect(isWebGLAvailable({ doc: { createElement: () => { throw new Error('no'); } }, win: { WebGL2RenderingContext: function W() {} } })).toBe(false);
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
