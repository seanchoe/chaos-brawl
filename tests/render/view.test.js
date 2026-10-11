import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBattleView, KO_SHRINK_TIME } from '../../src/render/view.js';
import { createMatch } from '../../src/logic/match.js';
import { runStep } from '../../src/logic/abilities.js';
import { setLoadout, resetFighter } from '../../src/logic/fighter.js';
import { getCharacter } from '../../src/data/characters.js';
import { getWeapon } from '../../src/data/weapons.js';
import { facingToRotationY } from '../../src/render/math.js';

const loadout = (characterId) => ({ characterId, level: 1, tier: 1, petId: null });
function setup(tintP2 = false) {
  const match = createMatch({ mode: '2p', p1: loadout('sparkle'), p2: loadout('sparkle') });
  const scene = new THREE.Scene();
  const view = createBattleView(scene, { tintP2 });
  view.sync(match.world, 0.016);
  return { match, world: match.world, scene, view };
}

describe('battle view', () => {
  it('adds and places a model for each fighter', () => {
    const { world, view } = setup(true);
    const m1 = view.fighterModel('p1');
    expect(m1.position.x).toBe(-5);
    expect(m1.rotation.y).toBeCloseTo(facingToRotationY(world.fighters[0].facing));
    const alt = getCharacter('sparkle').colors.alt;
    expect(view.fighterModel('p2').userData.parts.body.material.color.getHex()).toBe(alt);
  });

  it('adds and removes projectile meshes', () => {
    const { world, view, scene } = setup();
    const before = scene.children.length;
    runStep(world, world.fighters[0], { type: 'projectile', damage: 1, speed: 10, size: 0.3, life: 1, style: 'bubble' }, world.fighters[0], 1);
    view.sync(world, 0.016);
    expect(view.projectileCount).toBe(1);
    expect(scene.children.length).toBe(before + 1);
    world.projectiles = [];
    view.sync(world, 0.016);
    expect(view.projectileCount).toBe(0);
    expect(scene.children.length).toBe(before);
  });

  it('adds and removes zone meshes', () => {
    const { world, view } = setup();
    runStep(world, world.fighters[0], { type: 'zone', at: 'target', radius: 2, duration: 3, slow: 0.5, dps: 0, style: 'jelly' }, world.fighters[0], 1);
    view.sync(world, 0.016);
    expect(view.zoneCount).toBe(1);
    world.zones = [];
    view.sync(world, 0.016);
    expect(view.zoneCount).toBe(0);
  });

  it('spins and hides knocked-out fighters, and restores them', () => {
    const { world, view } = setup();
    const f = world.fighters[1];
    f.ko = true;
    for (let t = 0; t <= KO_SHRINK_TIME + 0.1; t += 0.1) view.sync(world, 0.1);
    expect(view.fighterModel('p2').visible).toBe(false);
    resetFighter(f, { x: 5, y: 0, z: 0 });
    view.sync(world, 0.016);
    expect(view.fighterModel('p2').visible).toBe(true);
    expect(view.fighterModel('p2').scale.x).toBe(1);
  });

  it('shows shield and ice status pieces', () => {
    const { world, view } = setup();
    const f = world.fighters[0];
    f.shield = { until: world.time + 1, reduction: 1, onEnd: null };
    f.status.freezeUntil = world.time + 1;
    view.sync(world, 0.016);
    const status = view.statusFor('p1');
    expect(status.shield.visible).toBe(true);
    expect(status.ice.visible).toBe(true);
    f.shield = null;
    f.status.freezeUntil = 0;
    view.sync(world, 0.016);
    expect(status.shield.visible).toBe(false);
    expect(status.ice.visible).toBe(false);
  });

  it('rebuilds the model when the weapon changes', () => {
    const { world, view } = setup();
    setLoadout(world.fighters[0], { character: getCharacter('sparkle'), level: 20, weapon: getWeapon('sparkle', 3) });
    view.sync(world, 0.016);
    expect(view.fighterModel('p1').userData.parts.weaponMount.children[0].userData.tier).toBe(3);
  });

  it('reacts to events: swing, hit flash, and warnings', () => {
    const { world, view } = setup();
    view.handleEvents([
      { type: 'ability', fighterId: 'p1', slot: 'basic', name: 'Sword Swing' },
      { type: 'hit', targetId: 'p2', attackerId: 'p1', damage: 5, popup: 'BONK!', pos: { x: 5, y: 0, z: 0 } },
      { type: 'shape', shape: 'warning', pos: { x: 0, y: 0, z: 0 }, radius: 2, duration: 0.5 },
    ]);
    view.sync(world, 0.05);
    expect(view.fighterModel('p1').userData.parts.weaponMount.rotation.x).not.toBe(0);
    expect(view.fighterModel('p2').userData.parts.body.material.emissive.getHex()).toBe(0xffffff);
    expect(view.warningCount).toBe(1);
    view.sync(world, 0.6);
    expect(view.warningCount).toBe(0);
  });

  it('clear removes everything it added', () => {
    const { world, view, scene } = setup();
    runStep(world, world.fighters[0], { type: 'projectile', damage: 1, speed: 10, size: 0.3, life: 1 }, world.fighters[0], 1);
    view.sync(world, 0.016);
    view.clear();
    expect(scene.children.length).toBe(0);
  });

  it('flashes every fighter material on hit and restores them', () => {
    const { world, view } = setup();
    const parts = view.fighterModel('p2').userData.parts;
    expect(parts.flashMaterials).toContain(parts.body.material);
    expect(parts.flashMaterials.length).toBeGreaterThan(1);
    view.handleEvents([{ type: 'hit', targetId: 'p2', attackerId: 'p1', damage: 5, popup: 'BONK!', pos: { x: 5, y: 0, z: 0 } }]);
    view.sync(world, 0.016);
    for (const m of parts.flashMaterials) {
      expect(m.emissive.getHex()).toBe(0xffffff);
      expect(m.emissiveIntensity).toBeCloseTo(0.6);
    }
    view.sync(world, 0.5);
    for (const m of parts.flashMaterials) {
      expect(m.emissive.getHex()).toBe(0x000000);
      expect(m.emissiveIntensity).toBe(0);
    }
  });
});
