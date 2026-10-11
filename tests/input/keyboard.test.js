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

describe('keyLabel', () => {
  it('gives short friendly labels', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Enter')).toBe('Enter');
  });
});
