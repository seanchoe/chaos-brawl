// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createTouchControls, isTouchDevice, mergeInput, stickInput } from '../../src/input/touch.js';
import { IDLE_INPUT } from '../../src/game/battleController.js';

// jsdom has no PointerEvent, so send plain events carrying the fields the controls read.
function pointer(node, type, { id = 1, x = 0, y = 0 } = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerId: id, clientX: x, clientY: y });
  node.dispatchEvent(e);
  return e;
}

function setup(players = ['p1']) {
  const container = document.createElement('div');
  const onPause = vi.fn();
  const touch = createTouchControls(container, { players, onPause });
  // Each stick is a 100px circle centred on (50, 50).
  container.querySelectorAll('.touch-stick').forEach((s) => {
    s.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  });
  return { container, touch, onPause, q: (sel) => container.querySelector(sel) };
}

describe('isTouchDevice', () => {
  it('detects touch screens (including iPads that report as a Mac)', () => {
    expect(isTouchDevice({ navigator: { maxTouchPoints: 5 } })).toBe(true);
    expect(isTouchDevice({ navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isTouchDevice({ navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isTouchDevice(undefined)).toBe(false);
  });
});

describe('stickInput', () => {
  it('points where the finger is, with up on screen meaning away from the camera', () => {
    expect(stickInput(0, -40, 50)).toEqual({ moveX: 0, moveZ: -1 });
    expect(stickInput(30, 0, 50)).toEqual({ moveX: 1, moveZ: 0 });
  });

  it('ignores tiny wobbles near the centre', () => {
    expect(stickInput(5, 5, 50)).toEqual({ moveX: 0, moveZ: 0 });
  });
});

describe('mergeInput', () => {
  it('combines keyboard and touch without going past full speed', () => {
    const keys = { ...IDLE_INPUT, moveX: 1, attack: true };
    const touch = { ...IDLE_INPUT, moveX: 1, moveZ: -1, jump: true };
    expect(mergeInput(keys, touch)).toEqual({ moveX: 1, moveZ: -1, jump: true, attack: true, special: false });
  });
});

describe('createTouchControls', () => {
  it('moves with the stick and lets go when the finger lifts', () => {
    const { touch, q } = setup();
    const stick = q('.touch-stick.p1');
    const down = pointer(stick, 'pointerdown', { x: 50, y: 10 });
    expect(down.defaultPrevented).toBe(true);
    expect(touch.input('p1')).toMatchObject({ moveX: 0, moveZ: -1 });
    pointer(stick, 'pointermove', { x: 95, y: 50 });
    expect(touch.input('p1')).toMatchObject({ moveX: 1, moveZ: 0 });
    pointer(stick, 'pointerup');
    expect(touch.input('p1')).toMatchObject({ moveX: 0, moveZ: 0 });
  });

  it('holds buttons while pressed, and handles several fingers at once', () => {
    const { touch, q } = setup();
    pointer(q('.touch-stick.p1'), 'pointerdown', { id: 1, x: 90, y: 50 });
    pointer(q('.touch-button.attack'), 'pointerdown', { id: 2 });
    pointer(q('.touch-button.jump'), 'pointerdown', { id: 3 });
    expect(touch.input('p1')).toEqual({ moveX: 1, moveZ: 0, jump: true, attack: true, special: false });
    expect(q('.touch-button.attack').classList.contains('held')).toBe(true);
    pointer(q('.touch-button.attack'), 'pointercancel', { id: 2 });
    expect(touch.input('p1')).toEqual({ moveX: 1, moveZ: 0, jump: true, attack: false, special: false });
    expect(q('.touch-button.attack').classList.contains('held')).toBe(false);
  });

  it('gives each player their own controls in 2 Players', () => {
    const { touch, q } = setup(['p1', 'p2']);
    expect(q('.touch').classList.contains('duo')).toBe(true);
    pointer(q('.touch-buttons.p2 .special'), 'pointerdown');
    expect(touch.input('p2').special).toBe(true);
    expect(touch.input('p1').special).toBe(false);
  });

  it('gives no input for a player without controls', () => {
    const { touch } = setup(['p1']);
    expect(touch.input('p2')).toEqual(IDLE_INPUT);
  });

  it('shows ability names and cooldowns on the buttons', () => {
    const { touch, q } = setup();
    touch.update([
      { id: 'p1', basicName: 'Bonk', specialName: 'Star Blast', basicCooldown: 0, specialCooldown: 0.5 },
      { id: 'p2', basicName: 'Chomp', specialName: 'Roar', basicCooldown: 0, specialCooldown: 0 },
    ]);
    expect(q('.touch-button.attack').textContent).toBe('Bonk');
    expect(q('.touch-button.attack').classList.contains('ready')).toBe(true);
    expect(q('.touch-button.special').style.getPropertyValue('--cd')).toBe('0.5');
    expect(q('.touch-button.special').classList.contains('ready')).toBe(false);
  });

  it('pauses from the pause button', () => {
    const { q, onPause } = setup();
    q('.touch-pause').click();
    expect(onPause).toHaveBeenCalledOnce();
  });

  it('lets go of everything on reset, and removes itself on dispose', () => {
    const { container, touch, q } = setup();
    pointer(q('.touch-stick.p1'), 'pointerdown', { x: 90, y: 50 });
    pointer(q('.touch-button.attack'), 'pointerdown', { id: 2 });
    touch.reset();
    expect(touch.input('p1')).toEqual(IDLE_INPUT);
    touch.dispose();
    expect(container.querySelector('.touch')).toBeNull();
  });
});
