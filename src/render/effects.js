import * as THREE from 'three';

export const POPUP_LIFE = 0.9;
const POPUP_RISE = 1.2;

const COLORS = {
  hit: [0xffe066, 0xffffff, 0xffa94d],
  block: [0x74c0fc, 0xffffff],
  heal: [0x8ce99a, 0xffffff],
  confetti: [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xffa94d],
  blink: [0xb197fc, 0xffffff],
};

const STATUS_WORDS = {
  freeze: ['FROZEN!', '#a5d8ff'],
  stun: ['DIZZY!', '#ffe066'],
  slow: ['SLOW!', '#d0bfff'],
};

export function toScreen(pos, camera, width, height) {
  const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera);
  return {
    x: ((v.x + 1) / 2) * width,
    y: ((1 - v.y) / 2) * height,
    visible: v.z < 1,
  };
}

export function createParticles(scene) {
  const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.04);
  let list = [];
  return {
    burst(pos, { count, colors, speed = 4, life = 0.8, gravity = 9, up = 3 }) {
      for (let i = 0; i < count; i++) {
        const material = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true });
        const m = new THREE.Mesh(geometry, material);
        m.position.set(pos.x, pos.y, pos.z);
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        list.push({ mesh: m, vel: { x: Math.cos(a) * s, y: up + Math.random() * up, z: Math.sin(a) * s }, life, max: life, gravity });
        scene.add(m);
      }
    },
    update(dt) {
      for (const p of list) {
        p.life -= dt;
        p.vel.y -= p.gravity * dt;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.y += dt * 6;
        p.mesh.material.opacity = Math.max(0, p.life / p.max);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
        }
      }
      list = list.filter((p) => p.life > 0);
    },
    get count() { return list.length; },
    clear() {
      for (const p of list) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
      }
      list = [];
    },
  };
}

export function createPopups(container) {
  const layer = document.createElement('div');
  layer.className = 'popup-layer';
  container.appendChild(layer);
  let list = [];
  return {
    show(text, pos, color = '#ffd43b') {
      const el = document.createElement('div');
      el.className = 'popup';
      el.textContent = text;
      el.style.color = color;
      layer.appendChild(el);
      list.push({ el, pos: { ...pos }, age: 0 });
    },
    update(dt, camera, width, height) {
      for (const p of list) {
        p.age += dt;
        if (p.age >= POPUP_LIFE) {
          p.el.remove();
          continue;
        }
        const s = toScreen({ x: p.pos.x, y: p.pos.y + p.age * POPUP_RISE, z: p.pos.z }, camera, width, height);
        const grow = 1 + Math.min(p.age * 4, 0.3);
        p.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${grow})`;
        p.el.style.opacity = String(Math.max(0, 1 - p.age / POPUP_LIFE));
        p.el.style.display = s.visible ? '' : 'none';
      }
      list = list.filter((p) => p.age < POPUP_LIFE);
    },
    get count() { return list.length; },
    dispose() {
      layer.remove();
      list = [];
    },
  };
}

const above = (pos, dy) => ({ x: pos.x, y: pos.y + dy, z: pos.z });

export function createEffects({ scene, container }) {
  const particles = createParticles(scene);
  const popups = createPopups(container);
  const fighterPos = (world, id) => world.fighters.find((f) => f.id === id)?.pos ?? { x: 0, y: 0, z: 0 };

  return {
    particles,
    popups,
    handleEvents(events, world) {
      for (const e of events) {
        switch (e.type) {
          case 'hit':
            popups.show(e.popup ?? 'POW!', above(e.pos, 2.3), '#ffd43b');
            particles.burst(above(e.pos, 1.1), { count: 8, colors: COLORS.hit, life: 0.5 });
            break;
          case 'blocked':
            popups.show(e.popup ?? 'BOING!', above(e.pos, 2.3), '#74c0fc');
            particles.burst(above(e.pos, 1.1), { count: 6, colors: COLORS.block, life: 0.4 });
            break;
          case 'heal':
            if (e.amount > 0) {
              popups.show(`+${Math.round(e.amount)}`, above(e.pos, 2.3), '#8ce99a');
              particles.burst(above(e.pos, 1), { count: 8, colors: COLORS.heal, life: 0.7, gravity: -2, up: 1 });
            }
            break;
          case 'ko': {
            const pos = fighterPos(world, e.targetId);
            popups.show('POOF!', above(pos, 2.5), '#ff8cc6');
            particles.burst(above(pos, 1), { count: 40, colors: COLORS.confetti, speed: 6, life: 1.4, up: 5 });
            break;
          }
          case 'status': {
            const word = STATUS_WORDS[e.status];
            if (word) popups.show(word[0], above(fighterPos(world, e.targetId), 2.8), word[1]);
            break;
          }
          case 'blink':
            particles.burst(above(fighterPos(world, e.fighterId), 1), { count: 12, colors: COLORS.blink, life: 0.5 });
            break;
          default:
            break;
        }
      }
    },
    update(dt, camera, width, height) {
      particles.update(dt);
      popups.update(dt, camera, width, height);
    },
    dispose() {
      particles.clear();
      popups.dispose();
    },
  };
}
