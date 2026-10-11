// Models are built facing +z. Logic facing θ points along (cos θ, sin θ) in x/z.
export function facingToRotationY(facing) {
  return Math.PI / 2 - facing;
}

export const CAMERA = {
  minDistance: 11,
  maxDistance: 24,
  baseDistance: 8,
  spreadFactor: 0.9,
  height: 0.55,
  lookHeight: 1.2,
  smoothing: 3,
};

// Frame both fighters from the front (+z side). Returns plain objects.
export function computeCamera(a, b) {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const spread = Math.hypot(a.x - b.x, a.z - b.z);
  const distance = Math.min(
    CAMERA.maxDistance,
    Math.max(CAMERA.minDistance, CAMERA.baseDistance + spread * CAMERA.spreadFactor),
  );
  return {
    position: { x: mid.x, y: distance * CAMERA.height, z: mid.z + distance },
    target: { x: mid.x, y: CAMERA.lookHeight, z: mid.z },
  };
}

export function smoothToward(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}
