import * as THREE from 'three';
import { weaponVisual } from './weaponVisuals.js';
import { projectileVisual, zoneVisual } from './projectileVisuals.js';

const BLACK = 0x2b2d42;
const HANDLE = 0x8d6e63;
const METAL = 0x495057;
const SKIN = { sparkle: 0xffe0bd, bubbles: 0xffe0bd, pancake: 0xffd8a8 };

export function toonMaterial(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, ...extra });
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------- Fighters ----------

export function buildFighterModel(character, weapon, { tint = false } = {}) {
  const colors = character.colors;
  const bodyMat = toonMaterial(tint ? colors.alt : colors.main);
  const accentMat = toonMaterial(colors.accent);
  const skinMat = SKIN[character.id] ? toonMaterial(SKIN[character.id]) : bodyMat;
  const eyeMat = toonMaterial(BLACK);

  const root = new THREE.Group();
  root.name = `fighter-${character.id}`;

  const body = mesh(new THREE.CapsuleGeometry(0.45, 0.5, 6, 12), bodyMat, 0, 0.75, 0);
  const head = mesh(new THREE.SphereGeometry(0.4, 16, 12), skinMat, 0, 1.55, 0);
  const eyeL = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, -0.14, 1.6, 0.35);
  const eyeR = mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat, 0.14, 1.6, 0.35);
  const footL = mesh(new THREE.SphereGeometry(0.16, 10, 8), accentMat, -0.2, 0.1, 0.08);
  const footR = mesh(new THREE.SphereGeometry(0.16, 10, 8), accentMat, 0.2, 0.1, 0.08);
  root.add(body, head, eyeL, eyeR, footL, footR);

  addAccessory(root, character.id, { bodyMat, accentMat });

  const flashMaterials = [];
  root.traverse((o) => {
    if (o.material && !flashMaterials.includes(o.material)) flashMaterials.push(o.material);
  });

  const weaponMount = new THREE.Group();
  weaponMount.name = 'weaponMount';
  weaponMount.position.set(0.55, 0.9, 0.15);
  if (weapon) weaponMount.add(buildWeaponModel(weapon.characterId, weapon.tier));
  root.add(weaponMount);

  const effects = new THREE.Group();
  effects.name = 'effects';
  root.add(effects);

  root.userData.parts = { body, head, weaponMount, effects, flashMaterials };
  return root;
}

function addAccessory(root, id, { bodyMat, accentMat }) {
  switch (id) {
    case 'sparkle': {
      const helmet = mesh(new THREE.SphereGeometry(0.43, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat, 0, 1.6, 0);
      const plume = mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat, 0, 2.08, -0.05);
      root.add(helmet, plume);
      break;
    }
    case 'bubbles': {
      const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20), bodyMat, 0, 1.82, 0);
      const hat = mesh(new THREE.ConeGeometry(0.45, 1.0, 16), bodyMat, 0, 2.35, 0);
      const star = mesh(new THREE.SphereGeometry(0.1, 8, 6), accentMat, 0, 2.2, 0.3);
      root.add(brim, hat, star);
      break;
    }
    case 'pancake': {
      const white = toonMaterial(0xffffff);
      const band = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 16), white, 0, 2.05, 0);
      const puff = mesh(new THREE.SphereGeometry(0.38, 14, 10), white, 0, 2.4, 0);
      const apron = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.05), accentMat, 0, 0.7, 0.44);
      root.add(band, puff, apron);
      break;
    }
    case 'rex': {
      const snout = mesh(new THREE.BoxGeometry(0.45, 0.25, 0.35), bodyMat, 0, 1.45, 0.4);
      root.add(snout);
      [1.95, 1.45, 1.0].forEach((y) => {
        const spike = mesh(new THREE.ConeGeometry(0.1, 0.25, 8), accentMat, 0, y, -0.42);
        spike.rotation.x = -0.6;
        root.add(spike);
      });
      const tail = mesh(new THREE.ConeGeometry(0.25, 0.8, 10), bodyMat, 0, 0.5, -0.65);
      tail.rotation.x = -Math.PI / 2;
      root.add(tail);
      break;
    }
    default:
      break;
  }
}

// ---------- Weapons ----------

const HEADS = {
  blade(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), handle, 0, 0.15, 0));
    g.add(mesh(new THREE.BoxGeometry(0.35, 0.06, 0.08), handle, 0, 0.32, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.04), color, 0, 0.8, 0));
  },
  orb(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), handle, 0, 0.5, 0));
    g.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), color, 0, 1.08, 0));
  },
  spatula(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), handle, 0, 0.3, 0));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.35, 0.03), color, 0, 0.75, 0));
  },
  pan(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), handle, 0, 0.22, 0));
    const pan = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20), color, 0, 0.62, 0);
    pan.rotation.x = Math.PI / 2;
    g.add(pan);
  },
  pin(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), handle, 0, 0.1, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), color, 0, 0.6, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), handle, 0, 1.1, 0));
  },
  tube(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const tube = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12), color, 0, 0.3, 0.25);
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
  },
  scoop(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), handle, 0, 0.3, 0));
    g.add(mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, 0.62, 0));
  },
  disc(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), handle, 0, 0.25, 0));
    const disc = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), color, 0, 0.7, 0);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
  },
  whisk(g, color, handle) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), handle, 0, 0.25, 0));
    for (let i = 0; i < 4; i++) {
      const loop = mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16), color, 0, 0.72, 0);
      loop.rotation.y = (i * Math.PI) / 4;
      g.add(loop);
    }
  },
  blaster(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), color, 0, 0.3, 0.15));
    const barrel = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), toonMaterial(METAL), 0, 0.32, 0.5);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
  },
  tank(g, color, handle) {
    HEADS.blaster(g, color, handle);
    g.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), color, 0, 0.5, 0));
  },
  magnet(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const magnet = mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 16, Math.PI), color, 0, 0.35, 0.25);
    magnet.rotation.x = Math.PI / 2;
    g.add(magnet);
  },
  shield(g, color, handle) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), handle, 0, 0.12, 0));
    const shield = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 20), color, 0, 0.4, 0.1);
    shield.rotation.x = Math.PI / 2;
    g.add(shield);
  },
};

export function buildWeaponModel(characterId, tier) {
  const v = weaponVisual(characterId, tier);
  const g = new THREE.Group();
  g.name = 'weapon';
  g.userData = { characterId, tier };
  const color = toonMaterial(v.color, v.glow ? { emissive: v.color, emissiveIntensity: 0.35 } : {});
  HEADS[v.head](g, color, toonMaterial(HANDLE));
  if (v.sparkle) {
    const twinkle = toonMaterial(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
    [[0.2, 0.9, 0], [-0.2, 0.6, 0.1], [0.1, 1.2, -0.1]].forEach(([x, y, z]) => g.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), twinkle, x, y, z)));
  }
  g.scale.setScalar(v.scale);
  return g;
}

// ---------- Status effects (shown on top of a fighter) ----------

export function buildStatusEffects() {
  const group = new THREE.Group();
  group.name = 'status';
  const see = (color, opacity) => toonMaterial(color, { transparent: true, opacity, depthWrite: false });

  const shield = mesh(new THREE.SphereGeometry(1.1, 20, 14), see(0x74c0fc, 0.3), 0, 0.95, 0);
  const ice = mesh(new THREE.BoxGeometry(1.2, 2.1, 1.2), see(0xa5d8ff, 0.45), 0, 1.0, 0);
  const stars = new THREE.Group();
  stars.position.y = 2.15;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    stars.add(mesh(new THREE.OctahedronGeometry(0.1), toonMaterial(0xffe066, { emissive: 0xffe066, emissiveIntensity: 0.5 }), Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45));
  }
  const slow = mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), toonMaterial(0xb197fc), 0, 0.05, 0);
  slow.rotation.x = Math.PI / 2;
  const guard = mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial(0x69db7c), 0, 1.0, -0.45);
  guard.rotation.x = -Math.PI / 2;

  for (const piece of [shield, ice, stars, slow, guard]) {
    if (piece !== guard) piece.traverse((o) => { o.castShadow = false; });
    piece.visible = false;
    group.add(piece);
  }
  return { group, shield, ice, stars, slow, guard };
}

// ---------- Projectiles, zones, warnings ----------

function projectileGeometry(shape, s) {
  switch (shape) {
    case 'disc': return new THREE.CylinderGeometry(s, s, s * 0.3, 16);
    case 'ring': return new THREE.TorusGeometry(s, s * 0.25, 8, 16, Math.PI);
    case 'cone': return new THREE.ConeGeometry(s * 0.6, s * 2, 10).rotateX(Math.PI / 2);
    case 'funnel': return new THREE.ConeGeometry(s, s * 2.2, 12).rotateX(Math.PI);
    case 'rod': return new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 4, 8).rotateX(Math.PI / 2);
    case 'box': return new THREE.BoxGeometry(s, s, s * 2);
    default: return new THREE.SphereGeometry(s, 12, 10);
  }
}

export function buildProjectileMesh(style, size) {
  const v = projectileVisual(style);
  const material = toonMaterial(v.color, {
    transparent: v.opacity !== undefined,
    opacity: v.opacity ?? 1,
    emissive: v.glow ? v.color : 0x000000,
    emissiveIntensity: v.glow ? 0.6 : 0,
  });
  const m = new THREE.Mesh(projectileGeometry(v.shape, size), material);
  m.userData.visual = v;
  return m;
}

export function buildZoneMesh(style, radius) {
  const v = zoneVisual(style);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.08, 32),
    toonMaterial(v.color, { transparent: true, opacity: 0.55, depthWrite: false }),
  );
  m.position.y = 0.05;
  return m;
}

export function buildWarningMesh(radius) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.8, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return m;
}

// ---------- Cleanup ----------

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of materials) m.dispose();
    }
  });
}
