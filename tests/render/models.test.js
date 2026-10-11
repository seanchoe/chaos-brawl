import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CHARACTER_IDS, getCharacter } from '../../src/data/characters.js';
import { getWeapon } from '../../src/data/weapons.js';
import { BOT_CHARACTER } from '../../src/logic/training.js';
import { PROJECTILE_STYLES } from '../../src/render/projectileVisuals.js';
import {
  buildFighterModel, buildWeaponModel, buildStatusEffects, buildProjectileMesh, buildZoneMesh, buildWarningMesh, disposeObject,
} from '../../src/render/models.js';

describe('fighter models', () => {
  it('builds every character with every weapon', () => {
    for (const id of CHARACTER_IDS) {
      for (let tier = 1; tier <= 11; tier++) {
        const model = buildFighterModel(getCharacter(id), getWeapon(id, tier));
        expect(model).toBeInstanceOf(THREE.Group);
        const { body, head, weaponMount, effects } = model.userData.parts;
        expect(body).toBeInstanceOf(THREE.Mesh);
        expect(head).toBeInstanceOf(THREE.Mesh);
        expect(effects).toBeInstanceOf(THREE.Group);
        expect(weaponMount.children).toHaveLength(1);
        expect(weaponMount.children[0].userData).toEqual({ characterId: id, tier });
      }
    }
  });

  it('tints player 2 with the alternate color', () => {
    const c = getCharacter('sparkle');
    expect(buildFighterModel(c, null).userData.parts.body.material.color.getHex()).toBe(c.colors.main);
    expect(buildFighterModel(c, null, { tint: true }).userData.parts.body.material.color.getHex()).toBe(c.colors.alt);
  });

  it('builds a weaponless model (training bot)', () => {
    const model = buildFighterModel(BOT_CHARACTER, null);
    expect(model.userData.parts.weaponMount.children).toHaveLength(0);
  });

  it('weapon models get bigger at higher tiers', () => {
    expect(buildWeaponModel('pancake', 11).scale.x).toBeGreaterThan(buildWeaponModel('pancake', 1).scale.x);
  });
});

describe('status effects', () => {
  it('builds hidden status pieces', () => {
    const s = buildStatusEffects();
    expect(s.group).toBeInstanceOf(THREE.Group);
    for (const key of ['shield', 'ice', 'stars', 'slow', 'guard']) expect(s[key].visible).toBe(false);
  });
});

describe('projectile, zone, and warning meshes', () => {
  it('builds a mesh for every projectile style', () => {
    for (const style of PROJECTILE_STYLES) {
      const m = buildProjectileMesh(style, 0.4);
      expect(m).toBeInstanceOf(THREE.Mesh);
      expect(m.userData.visual).toBeDefined();
    }
  });

  it('builds zone and warning meshes at the given radius', () => {
    const zone = buildZoneMesh('goo', 2.5);
    expect(zone.geometry.parameters.radiusTop).toBe(2.5);
    const warning = buildWarningMesh(2);
    expect(warning.geometry.parameters.outerRadius).toBe(2);
  });
});

describe('disposeObject', () => {
  it('disposes geometries and materials in a tree', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    group.add(mesh);
    const g = vi.spyOn(mesh.geometry, 'dispose');
    const m = vi.spyOn(mesh.material, 'dispose');
    disposeObject(group);
    expect(g).toHaveBeenCalled();
    expect(m).toHaveBeenCalled();
  });
});

describe('status shadows', () => {
  it('see-through status pieces do not cast shadows', () => {
    const s = buildStatusEffects();
    for (const piece of [s.shield, s.ice, s.slow, s.stars]) {
      piece.traverse((o) => expect(o.castShadow).toBe(false));
    }
  });
});
