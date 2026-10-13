// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BINDINGS, readInput, createKeyboard, keyLabel } from '../../src/input/keyboard.js';

const press = (target, code, type = 'keydown', extra = {}) => {
  const e = new KeyboardEvent(type, { code, cancelable: true, ...extra });
  target.dispatchEvent(e);
  return e;
};

describe('readInput', () => {
  it('maps P1 keys to engine input (W is away from the camera = -z)', () => {
    const down = new Set(['KeyW', 'KeyD', 'KeyF']);
    expect(readInput(down, BINDINGS.p1)).toEqual({ moveX: 1, moveZ: -1, jump: false, attack: true, special: false });
  });

  it('opposite keys cancel out', () => {
    expect(readInput(new Set(['ArrowLeft', 'ArrowRight', 'Enter', 'KeyL']), BINDINGS.p2))
      .toEqual({ moveX: 0, moveZ: 0, jump: true, attack: false, special: true });
  });
});

describe('createKeyboard', () => {
  it('tracks key presses and stops game keys from scrolling the page', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    const e = press(target, 'ArrowUp');
    expect(e.defaultPrevented).toBe(true);
    expect(kb.input('p2').moveZ).toBe(-1);
    press(target, 'ArrowUp', 'keyup');
    expect(kb.input('p2').moveZ).toBe(0);
  });

  it('does not block non-game keys', () => {
    const target = new EventTarget();
    createKeyboard(target);
    expect(press(target, 'KeyQ').defaultPrevented).toBe(false);
  });

  it('reports a key press only once', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    press(target, 'Escape');
    press(target, 'Escape', 'keydown', { repeat: true });
    expect(kb.consumePress('Escape')).toBe(true);
    expect(kb.consumePress('Escape')).toBe(false);
  });

  it('forgets held keys when the window loses focus', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    press(target, 'KeyA');
    target.dispatchEvent(new Event('blur'));
    expect(kb.input('p1').moveX).toBe(0);
  });

  it('stops listening after dispose', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    kb.dispose();
    press(target, 'KeyD');
    expect(kb.input('p1').moveX).toBe(0);
  });
});

describe('createKeyboard with form controls', () => {
  const fire = (el, code, type = 'keydown', extra = {}) => {
    const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...extra });
    el.dispatchEvent(e);
    return e;
  };

  it('leaves keys alone when a button, select, input or textarea is focused', () => {
    for (const tag of ['button', 'select', 'input', 'textarea']) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      const kb = createKeyboard(window);
      const e = fire(el, 'Enter');
      expect(e.defaultPrevented).toBe(false);
      expect(kb.input('p2').jump).toBe(false);
      expect(kb.consumePress('Enter')).toBe(false);
      const a = fire(el, 'ArrowUp');
      expect(a.defaultPrevented).toBe(false);
      expect(kb.input('p2').moveZ).toBe(0);
      kb.dispose();
      el.remove();
    }
  });

  it('still records Escape from a focused control', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const kb = createKeyboard(window);
    fire(el, 'Escape');
    expect(kb.consumePress('Escape')).toBe(true);
    kb.dispose();
    el.remove();
  });

  it('still handles game keys on non-form elements', () => {
    const kb = createKeyboard(window);
    const e = fire(document.body, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(kb.input('p2').jump).toBe(true);
    kb.dispose();
  });
});

describe('createKeyboard modifiers', () => {
  it('ignores keydown with meta, ctrl or alt held', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    for (const mod of ['metaKey', 'ctrlKey', 'altKey']) {
      const e = press(target, 'KeyA', 'keydown', { [mod]: true });
      expect(e.defaultPrevented).toBe(false);
      expect(kb.input('p1').moveX).toBe(0);
    }
  });

  it('clears held keys when Meta is released', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target);
    press(target, 'KeyD');
    expect(kb.input('p1').moveX).toBe(1);
    press(target, 'MetaLeft', 'keyup');
    expect(kb.input('p1').moveX).toBe(0);
    press(target, 'KeyD');
    press(target, 'MetaRight', 'keyup');
    expect(kb.input('p1').moveX).toBe(0);
  });
});

describe('createKeyboard page visibility', () => {
  it('clears held keys when the document becomes hidden', () => {
    const target = new EventTarget();
    const doc = new EventTarget();
    doc.hidden = false;
    const kb = createKeyboard(target, doc);
    press(target, 'KeyD');
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(kb.input('p1').moveX).toBe(1);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(kb.input('p1').moveX).toBe(0);
  });

  it('clears held keys on pagehide', () => {
    const target = new EventTarget();
    const kb = createKeyboard(target, new EventTarget());
    press(target, 'KeyD');
    target.dispatchEvent(new Event('pagehide'));
    expect(kb.input('p1').moveX).toBe(0);
  });

  it('removes the visibility and pagehide listeners on dispose', () => {
    const target = new EventTarget();
    const doc = new EventTarget();
    doc.hidden = true;
    const kb = createKeyboard(target, doc);
    kb.dispose();
    press(target, 'KeyD'); // not recorded after dispose
    expect(kb.input('p1').moveX).toBe(0);
    const removed = [];
    const spyDoc = { addEventListener() {}, removeEventListener: (t) => removed.push(t) };
    const spyTarget = { addEventListener() {}, removeEventListener: (t) => removed.push(t) };
    createKeyboard(spyTarget, spyDoc).dispose();
    expect(removed).toContain('visibilitychange');
    expect(removed).toContain('pagehide');
  });
});

describe('keyLabel', () => {
  it('gives short friendly labels', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Enter')).toBe('Enter');
  });
});
