import { describe, it, expect } from 'vitest';
import { CHARACTER_IDS } from '../../src/data/characters.js';
import { getWeaponLine } from '../../src/data/weapons.js';
import { PETS } from '../../src/data/pets.js';
import { weaponVisual, WEAPON_HEADS } from '../../src/render/weaponVisuals.js';
import { projectileVisual, zoneVisual, PROJECTILE_SHAPES, PROJECTILE_STYLES } from '../../src/render/projectileVisuals.js';

function allSteps() {
  const steps = [];
  const add = (list) => {
    for (const s of list) {
      steps.push(s);
      if (s.onEnd) add(s.onEnd);
    }
  };
  for (const id of CHARACTER_IDS) {
    for (const w of getWeaponLine(id)) {
      add(w.basic.steps);
      add(w.special.steps);
    }
  }
  for (const p of PETS) add(p.move.steps);
  return steps;
}

describe('weapon visuals', () => {
  it('gives every weapon a known head and a unique color within its line', () => {
    for (const id of CHARACTER_IDS) {
      const colors = new Set();
      for (let tier = 1; tier <= 11; tier++) {
        const v = weaponVisual(id, tier);
        expect(WEAPON_HEADS).toContain(v.head);
        expect(typeof v.color).toBe('number');
        colors.add(v.color);
      }
      expect(colors.size).toBe(11);
    }
  });

  it('grows and glows at higher tiers', () => {
    expect(weaponVisual('sparkle', 11).scale).toBeGreaterThan(weaponVisual('sparkle', 1).scale);
    expect(weaponVisual('sparkle', 5).glow).toBe(false);
    expect(weaponVisual('sparkle', 6).glow).toBe(true);
    expect(weaponVisual('rex', 11).sparkle).toBe(true);
  });

  it('throws for unknown weapons', () => {
    expect(() => weaponVisual('nobody', 1)).toThrow();
    expect(() => weaponVisual('sparkle', 12)).toThrow();
  });
});

describe('projectile and zone visuals', () => {
  it('has a visual for every projectile style used in the data', () => {
    const styles = new Set(allSteps().filter((s) => s.type === 'projectile').map((s) => s.style ?? 'ball'));
    for (const style of styles) {
      expect(PROJECTILE_STYLES, style).toContain(style);
      expect(PROJECTILE_SHAPES).toContain(projectileVisual(style).shape);
    }
  });

  it('falls back to a plain ball', () => {
    expect(projectileVisual('mystery')).toEqual(projectileVisual('ball'));
  });

  it('has a visual for every zone style used in the data', () => {
    const styles = new Set(allSteps().filter((s) => s.type === 'zone').map((s) => s.style ?? 'zone'));
    for (const style of styles) expect(typeof zoneVisual(style).color).toBe('number');
    expect(zoneVisual('mystery')).toEqual(zoneVisual('zone'));
  });
});
