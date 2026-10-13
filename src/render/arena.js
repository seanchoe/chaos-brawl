import * as THREE from 'three';
import { ARENA_RADIUS } from '../logic/constants.js';
import { toonMaterial } from './models.js';

const WALL_RADIUS = ARENA_RADIUS + 0.6;
const ISLAND_RADIUS = ARENA_RADIUS + 2;
// Wide enough that its edge is hidden in the fog, so the meadow reaches the horizon.
const GROUND_RADIUS = 150;

export function buildArena() {
  const arena = new THREE.Group();
  arena.name = 'arena';
  arena.userData.wallRadius = WALL_RADIUS;

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 1, 48), toonMaterial(0x8ce99a));
  grass.position.y = -0.5;
  grass.receiveShadow = true;
  arena.add(grass);

  const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS - 0.3, ARENA_RADIUS, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  arena.add(ring);

  // The meadow sits just below the arena's grass so the arena still stands out.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_RADIUS, 64), toonMaterial(0x69db7c));
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  arena.add(ground);

  const wall = new THREE.Mesh(new THREE.TorusGeometry(WALL_RADIUS, 0.35, 10, 64), toonMaterial(0xffd6e7));
  wall.rotation.x = Math.PI / 2;
  wall.position.y = 0.35;
  wall.castShadow = true;
  arena.add(wall);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    arena.add(buildTree(Math.cos(a) * (ISLAND_RADIUS - 0.8), Math.sin(a) * (ISLAND_RADIUS - 0.8)));
  }

  // A looser ring of trees out in the meadow.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.1;
    const r = 22 + (i % 3) * 6;
    arena.add(buildTree(Math.cos(a) * r, Math.sin(a) * r));
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    arena.add(buildCloud(Math.cos(a) * 30, 6 + (i % 3) * 3, Math.sin(a) * 30 - 10));
  }

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8ce99a, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.02;
  const s = ISLAND_RADIUS;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 });
  sun.shadow.camera.updateProjectionMatrix();
  arena.add(hemi, sun);

  return arena;
}

function buildTree(x, z) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 8), toonMaterial(0x8d6e63));
  trunk.position.y = 0.6;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), toonMaterial(0x51cf66));
  top.position.y = 1.7;
  trunk.castShadow = true;
  top.castShadow = true;
  tree.add(trunk, top);
  tree.position.set(x, 0, z);
  return tree;
}

function buildCloud(x, y, z) {
  const cloud = new THREE.Group();
  const white = toonMaterial(0xffffff);
  [[0, 0, 0, 1.6], [1.5, -0.2, 0, 1.2], [-1.5, -0.3, 0, 1.1], [0.5, 0.6, 0.3, 1.0]].forEach(([cx, cy, cz, r]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), white);
    puff.position.set(cx, cy, cz);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  return cloud;
}
