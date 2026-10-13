import * as THREE from 'three';
import { buildPetModel } from './petModels.js';
import { disposeObject } from './models.js';

const SIZE = 160;
const SPIN_SPEED = 1.2;

// One small WebGL renderer draws every pet in turn and copies each frame onto that pet's card canvas,
// since iPad Safari only allows a few WebGL contexts at once.
export function createPetPreviews({ raf = (cb) => requestAnimationFrame(cb), cancel = (id) => cancelAnimationFrame(id) } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 1.1, 3.2);
  camera.lookAt(0, 0.5, 0);

  const entries = [];
  let frameId = null;
  let last = 0;

  function frame(t) {
    frameId = raf(frame);
    const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
    last = t;
    for (const e of entries) {
      e.model.rotation.y += SPIN_SPEED * dt;
      renderer.render(e.scene, camera);
      e.ctx.clearRect(0, 0, SIZE, SIZE);
      e.ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
    }
  }

  return {
    size: SIZE,
    add(canvas, def) {
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8ce99a, 2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.8);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const model = buildPetModel(def);
      model.rotation.y = entries.length * 0.7;
      scene.add(model);
      entries.push({ scene, model, ctx });
    },
    start() {
      if (frameId === null) frameId = raf(frame);
    },
    dispose() {
      if (frameId !== null) cancel(frameId);
      frameId = null;
      for (const e of entries) disposeObject(e.scene);
      entries.length = 0;
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}
