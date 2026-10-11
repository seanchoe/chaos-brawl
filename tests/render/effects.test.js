// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { toScreen, createParticles, createPopups, createEffects, POPUP_LIFE } from '../../src/render/effects.js';

function camera() {
  const cam = new THREE.PerspectiveCamera(45, 2, 0.1, 100);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}
const world = { fighters: [{ id: 'p1', pos: { x: 0, y: 0, z: 0 } }, { id: 'p2', pos: { x: 3, y: 0, z: 0 } }] };

describe('toScreen', () => {
  it('maps the point the camera looks at to the screen center', () => {
    const s = toScreen({ x: 0, y: 0, z: 0 }, camera(), 200, 100);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(50);
    expect(s.visible).toBe(true);
  });
});

describe('particles', () => {
  it('bursts and fades away', () => {
    const scene = new THREE.Scene();
    const p = createParticles(scene);
    p.burst({ x: 0, y: 1, z: 0 }, { count: 10, colors: [0xffffff], life: 0.5 });
    expect(p.count).toBe(10);
    expect(scene.children).toHaveLength(10);
    p.update(0.6);
    expect(p.count).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});

describe('particles dispose', () => {
  it('clears particles and disposes the shared geometry', () => {
    const scene = new THREE.Scene();
    const p = createParticles(scene);
    p.burst({ x: 0, y: 1, z: 0 }, { count: 3, colors: [0xffffff] });
    const spy = vi.spyOn(THREE.BoxGeometry.prototype, 'dispose');
    p.clear();
    expect(spy).not.toHaveBeenCalled();
    p.dispose();
    expect(p.count).toBe(0);
    expect(scene.children).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('createEffects.dispose disposes the particle geometry', () => {
    const scene = new THREE.Scene();
    const effects = createEffects({ scene, container: document.createElement('div') });
    const spy = vi.spyOn(THREE.BoxGeometry.prototype, 'dispose');
    effects.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('popups', () => {
  it('shows floating text that disappears', () => {
    const container = document.createElement('div');
    const popups = createPopups(container);
    popups.show('BONK!', { x: 0, y: 2, z: 0 });
    expect(container.querySelectorAll('.popup')).toHaveLength(1);
    expect(container.querySelector('.popup').textContent).toBe('BONK!');
    popups.update(0.1, camera(), 200, 100);
    expect(popups.count).toBe(1);
    popups.update(POPUP_LIFE, camera(), 200, 100);
    expect(popups.count).toBe(0);
    expect(container.querySelectorAll('.popup')).toHaveLength(0);
  });
});

describe('createEffects', () => {
  function setup() {
    const scene = new THREE.Scene();
    const container = document.createElement('div');
    return { container, effects: createEffects({ scene, container }) };
  }

  it('hits make a pop-up and sparkles', () => {
    const { container, effects } = setup();
    effects.handleEvents([{ type: 'hit', targetId: 'p2', damage: 5, popup: 'ZAP!', pos: { x: 3, y: 0, z: 0 } }], world);
    expect(container.querySelector('.popup').textContent).toBe('ZAP!');
    expect(effects.particles.count).toBeGreaterThan(0);
  });

  it('knockouts make a confetti burst', () => {
    const { effects } = setup();
    effects.handleEvents([{ type: 'ko', targetId: 'p2' }], world);
    expect(effects.particles.count).toBeGreaterThanOrEqual(40);
  });

  it('shows status words and skips empty heals', () => {
    const { container, effects } = setup();
    effects.handleEvents([
      { type: 'status', targetId: 'p1', status: 'freeze' },
      { type: 'heal', targetId: 'p1', amount: 0, pos: { x: 0, y: 0, z: 0 } },
    ], world);
    const texts = [...container.querySelectorAll('.popup')].map((e) => e.textContent);
    expect(texts).toEqual(['FROZEN!']);
  });
});
