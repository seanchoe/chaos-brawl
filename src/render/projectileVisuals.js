export const PROJECTILE_SHAPES = ['sphere', 'disc', 'ring', 'cone', 'funnel', 'rod', 'box'];

// opacity < 1 makes it see-through; glow adds emissive; spin spins it; rainbow cycles hue.
const PROJECTILES = {
  ball: { shape: 'sphere', color: 0xffffff },
  bubble: { shape: 'sphere', color: 0x8ce9ff, opacity: 0.6 },
  bigBubble: { shape: 'sphere', color: 0x74c0fc, opacity: 0.55 },
  galaxy: { shape: 'sphere', color: 0x5f3dc4, glow: true, opacity: 0.8 },
  wave: { shape: 'ring', color: 0xffc9f5, glow: true },
  frost: { shape: 'ring', color: 0xa5d8ff, glow: true },
  moon: { shape: 'ring', color: 0xfff3bf, glow: true },
  rainbow: { shape: 'ring', color: 0xff6bd6, glow: true, rainbow: true },
  snowball: { shape: 'sphere', color: 0xffffff },
  lightning: { shape: 'rod', color: 0xffe066, glow: true },
  laser: { shape: 'rod', color: 0xff4d6d, glow: true },
  freezeRay: { shape: 'rod', color: 0x99e9f2, glow: true },
  dart: { shape: 'rod', color: 0xff922b },
  rocket: { shape: 'cone', color: 0xff6b6b },
  tornado: { shape: 'funnel', color: 0xced4da, opacity: 0.8, spin: true },
  firebird: { shape: 'cone', color: 0xff7f11, glow: true },
  nova: { shape: 'sphere', color: 0xfff3bf, glow: true },
  pancake: { shape: 'disc', color: 0xf4c27a, spin: true },
  pie: { shape: 'disc', color: 0xfff0f6 },
  pizza: { shape: 'disc', color: 0xffd43b, spin: true },
  iceCream: { shape: 'sphere', color: 0xffc9de },
  cupcake: { shape: 'cone', color: 0xf783ac },
  sprinkle: { shape: 'box', color: 0xff6bd6, rainbow: true },
  feather: { shape: 'cone', color: 0xd9c2a7 },
  puffball: { shape: 'sphere', color: 0xff8787, glow: true },
};

export const PROJECTILE_STYLES = Object.keys(PROJECTILES);

export function projectileVisual(style) {
  return PROJECTILES[style] ?? PROJECTILES.ball;
}

const ZONES = {
  zone: { color: 0xffffff },
  jelly: { color: 0xff8cc6 },
  goo: { color: 0x69db7c },
};

export function zoneVisual(style) {
  return ZONES[style] ?? ZONES.zone;
}
