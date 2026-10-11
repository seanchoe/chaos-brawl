export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function dirTo(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len === 0) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

export function forward(angle) {
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

export function angleTo(a, b) {
  return Math.atan2(b.z - a.z, b.x - a.x);
}

export function angleDiff(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

export function clampToArena(pos, radius) {
  const r = Math.hypot(pos.x, pos.z);
  if (r > radius) {
    pos.x *= radius / r;
    pos.z *= radius / r;
  }
  return pos;
}
