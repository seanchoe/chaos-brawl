import {
  buildFighterModel, buildStatusEffects, buildProjectileMesh, buildZoneMesh, buildWarningMesh, disposeObject,
} from './models.js';
import { facingToRotationY } from './math.js';

export const KO_SHRINK_TIME = 0.6;
const KO_SPIN = 14;
const SWING_TIME = 0.22;
const BOUNCE_TIME = 0.35;
const FLASH_TIME = 0.12;

export function createBattleView(scene, { tintP2 = false } = {}) {
  const fighters = new Map();
  const projectiles = new Map();
  const zones = new Map();
  let warnings = [];
  let clock = 0;

  const keyOf = (f) => `${f.character.id}:${f.weapon ? f.weapon.tier : 0}`;

  function remove(object) {
    scene.remove(object);
    disposeObject(object);
  }

  function makeFighter(f) {
    const model = buildFighterModel(f.character, f.weapon, { tint: tintP2 && f.id === 'p2' });
    const status = buildStatusEffects();
    model.userData.parts.effects.add(status.group);
    scene.add(model);
    return { model, status, key: keyOf(f), koTime: 0, flash: 0, swing: 0, bounce: 0 };
  }

  function syncFighter(f, now, dt) {
    let e = fighters.get(f.id);
    if (e && e.key !== keyOf(f)) {
      remove(e.model);
      e = null;
    }
    if (!e) {
      e = makeFighter(f);
      fighters.set(f.id, e);
    }
    const { model, status } = e;
    const parts = model.userData.parts;
    model.position.set(f.pos.x, f.pos.y, f.pos.z);

    if (f.ko) {
      e.koTime += dt;
      const t = Math.min(1, e.koTime / KO_SHRINK_TIME);
      model.rotation.y += KO_SPIN * dt;
      model.scale.setScalar(1 - t);
      model.visible = t < 1;
    } else {
      e.koTime = 0;
      model.visible = true;
      model.rotation.y = facingToRotationY(f.facing);
      const bounce = e.bounce > 0 ? 1 + Math.sin((1 - e.bounce / BOUNCE_TIME) * Math.PI) * 0.15 : 1;
      model.scale.set(1, bounce, f.dash ? 1.3 : 1);
    }

    e.flash = Math.max(0, e.flash - dt);
    const flashing = e.flash > 0;
    for (const m of parts.flashMaterials) {
      m.emissive.setHex(flashing ? 0xffffff : 0x000000);
      m.emissiveIntensity = flashing ? 0.6 : 0;
    }

    e.swing = Math.max(0, e.swing - dt);
    parts.weaponMount.rotation.x = e.swing > 0 ? Math.sin((1 - e.swing / SWING_TIME) * Math.PI) * 1.6 : 0;

    e.bounce = Math.max(0, e.bounce - dt);
    updateStatus(status, f, now, dt);
  }

  function updateStatus(s, f, now, dt) {
    const shielded = !!f.shield && now < f.shield.until;
    s.shield.visible = shielded;
    if (shielded) s.shield.material.color.setHex(f.shield.reduction >= 1 ? 0xffd43b : 0x74c0fc);
    s.ice.visible = now < f.status.freezeUntil;
    s.stars.visible = now < f.status.stunUntil;
    if (s.stars.visible) s.stars.rotation.y += dt * 6;
    s.slow.visible = now < f.status.slowUntil;
    s.guard.visible = f.guardHits > 0;
  }

  function syncProjectiles(world, dt) {
    const seen = new Set();
    for (const p of world.projectiles) {
      seen.add(p.id);
      let m = projectiles.get(p.id);
      if (!m) {
        m = buildProjectileMesh(p.style, p.size);
        scene.add(m);
        projectiles.set(p.id, m);
      }
      m.position.set(p.pos.x, p.pos.y, p.pos.z);
      const v = m.userData.visual;
      if (v.spin) m.rotation.y += dt * 12;
      else m.rotation.y = facingToRotationY(Math.atan2(p.vel.z, p.vel.x));
      if (v.rainbow) m.material.color.setHSL((clock * 1.5) % 1, 0.8, 0.65);
    }
    for (const [id, m] of projectiles) {
      if (!seen.has(id)) {
        remove(m);
        projectiles.delete(id);
      }
    }
  }

  function syncZones(world) {
    const seen = new Set();
    for (const z of world.zones) {
      seen.add(z.id);
      let m = zones.get(z.id);
      if (!m) {
        m = buildZoneMesh(z.style, z.radius);
        m.position.x = z.pos.x;
        m.position.z = z.pos.z;
        scene.add(m);
        zones.set(z.id, m);
      }
      m.material.opacity = 0.45 + 0.15 * Math.sin(clock * 6);
    }
    for (const [id, m] of zones) {
      if (!seen.has(id)) {
        remove(m);
        zones.delete(id);
      }
    }
  }

  function syncWarnings(dt) {
    for (const w of warnings) {
      w.left -= dt;
      w.mesh.material.opacity = 0.4 + 0.4 * Math.abs(Math.sin(clock * 10));
      if (w.left <= 0) remove(w.mesh);
    }
    warnings = warnings.filter((w) => w.left > 0);
  }

  return {
    sync(world, dt) {
      clock += dt;
      for (const f of world.fighters) syncFighter(f, world.time, dt);
      syncProjectiles(world, dt);
      syncZones(world);
      syncWarnings(dt);
    },
    handleEvents(events) {
      for (const e of events) {
        if (e.type === 'ability') {
          const f = fighters.get(e.fighterId);
          if (f && e.slot === 'basic') f.swing = SWING_TIME;
          else if (f) f.bounce = BOUNCE_TIME;
        } else if (e.type === 'hit') {
          const f = fighters.get(e.targetId);
          if (f) f.flash = FLASH_TIME;
        } else if (e.type === 'shape' && e.shape === 'warning') {
          const mesh = buildWarningMesh(e.radius);
          mesh.position.x = e.pos.x;
          mesh.position.z = e.pos.z;
          scene.add(mesh);
          warnings.push({ mesh, left: e.duration });
        }
      }
    },
    fighterModel: (id) => fighters.get(id)?.model ?? null,
    statusFor: (id) => fighters.get(id)?.status ?? null,
    get projectileCount() { return projectiles.size; },
    get zoneCount() { return zones.size; },
    get warningCount() { return warnings.length; },
    clear() {
      for (const e of fighters.values()) remove(e.model);
      for (const m of projectiles.values()) remove(m);
      for (const m of zones.values()) remove(m);
      for (const w of warnings) remove(w.mesh);
      fighters.clear();
      projectiles.clear();
      zones.clear();
      warnings = [];
    },
  };
}
