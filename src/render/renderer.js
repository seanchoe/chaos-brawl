import * as THREE from 'three';

const SKY = 0x9bdcff;

export function isWebGLAvailable({ doc = globalThis.document, win = globalThis } = {}) {
  try {
    if (!win.WebGL2RenderingContext) return false;
    const canvas = doc.createElement('canvas');
    return !!(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 45, 95);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  const size = () => ({ width: container.clientWidth || window.innerWidth, height: container.clientHeight || window.innerHeight });
  const resize = () => {
    const { width, height } = size();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    scene,
    camera,
    size,
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
