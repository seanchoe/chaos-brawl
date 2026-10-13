import * as THREE from 'three';
import { toonMaterial } from './models.js';

const BLACK = 0x2b2d42;
const PINK = 0xffa8c5;
const ORANGE = 0xffa94d;

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const sphere = (r) => new THREE.SphereGeometry(r, 12, 10);
const cone = (r, h) => new THREE.ConeGeometry(r, h, 10);

// Each pet faces +z. `body` is the round middle, `head` sits on the front.
const SPECIES = {
  Puppy(g, { main, accent }) {
    g.add(mesh(sphere(0.12), accent, 0, 0.5, 0.4));
    for (const x of [-0.2, 0.2]) {
      const ear = mesh(new THREE.BoxGeometry(0.1, 0.25, 0.06), main, x, 0.65, 0.2);
      ear.rotation.z = x > 0 ? -0.3 : 0.3;
      g.add(ear);
    }
    const tail = mesh(cone(0.06, 0.3), main, 0, 0.5, -0.4);
    tail.rotation.x = -0.8;
    g.add(tail);
  },
  Kitty(g, { main, accent }) {
    for (const x of [-0.13, 0.13]) g.add(mesh(cone(0.08, 0.18), main, x, 0.85, 0.2));
    g.add(mesh(sphere(0.06), accent, 0, 0.6, 0.45));
    const tail = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), main, 0, 0.55, -0.42);
    tail.rotation.x = -0.6;
    g.add(tail);
  },
  Bunny(g, { main, accent }) {
    for (const x of [-0.09, 0.09]) {
      g.add(mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), main, x, 1.0, 0.18));
      g.add(mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), accent, x, 1.0, 0.23));
    }
    g.add(mesh(sphere(0.1), main, 0, 0.35, -0.4));
  },
  Turtle(g, { main, accent }) {
    const shell = mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, 0.3, 0);
    g.add(shell);
    for (const [x, z] of [[-0.3, 0.25], [0.3, 0.25], [-0.3, -0.25], [0.3, -0.25]]) g.add(mesh(sphere(0.1), main, x, 0.15, z));
  },
  Owl(g, { main, accent }) {
    g.add(mesh(sphere(0.3), accent, 0, 0.45, 0.12));
    for (const x of [-0.12, 0.12]) g.add(mesh(cone(0.06, 0.18), main, x, 0.95, 0.15));
    for (const x of [-0.38, 0.38]) g.add(mesh(new THREE.SphereGeometry(0.18, 10, 8), main, x, 0.5, 0));
    g.add(mesh(cone(0.05, 0.12).rotateX(Math.PI / 2), toonMaterial(ORANGE), 0, 0.68, 0.45));
  },
  Penguin(g, { accent }) {
    g.add(mesh(sphere(0.3), accent, 0, 0.42, 0.14));
    g.add(mesh(cone(0.06, 0.14).rotateX(Math.PI / 2), toonMaterial(ORANGE), 0, 0.72, 0.42));
    for (const x of [-0.12, 0.12]) g.add(mesh(sphere(0.08), toonMaterial(ORANGE), x, 0.05, 0.15));
  },
  'Baby Dragon'(g, { main, accent }) {
    for (const x of [-0.12, 0.12]) g.add(mesh(cone(0.05, 0.18), accent, x, 0.92, 0.18));
    for (const x of [-0.42, 0.42]) {
      const wing = mesh(new THREE.ConeGeometry(0.2, 0.35, 3), accent, x, 0.6, -0.05);
      wing.rotation.z = x > 0 ? -1.2 : 1.2;
      g.add(wing);
    }
    const tail = mesh(cone(0.1, 0.45).rotateX(-Math.PI / 2), main, 0, 0.3, -0.45);
    g.add(tail);
  },
  Unicorn(g, { main, accent }) {
    g.add(mesh(cone(0.05, 0.3), toonMaterial(0xffd43b), 0, 1.0, 0.32));
    for (let i = 0; i < 3; i++) g.add(mesh(sphere(0.09), accent, 0, 0.85 - i * 0.14, -0.05 - i * 0.06));
    g.add(mesh(sphere(0.12), accent, 0, 0.4, -0.42));
  },
};

export const PET_SPECIES = Object.keys(SPECIES);

export function buildPetModel(def) {
  const main = toonMaterial(def.colors.main);
  const accent = toonMaterial(def.colors.accent);
  const eye = toonMaterial(BLACK);

  const root = new THREE.Group();
  root.name = `pet-${def.id}`;
  const body = new THREE.Group();
  body.name = 'petBody';
  root.add(body);

  body.add(mesh(sphere(0.38), main, 0, 0.4, 0));
  body.add(mesh(sphere(0.28), main, 0, 0.7, 0.2));
  for (const x of [-0.1, 0.1]) body.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), eye, x, 0.76, 0.45));
  if (def.species === 'Bunny' || def.species === 'Kitty') body.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), toonMaterial(PINK), 0, 0.68, 0.48));
  (SPECIES[def.species] ?? (() => {}))(body, { main, accent });

  root.userData.parts = { body };
  return root;
}
