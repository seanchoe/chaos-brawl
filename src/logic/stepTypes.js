export const STEP_REQUIRED = {
  melee: ['damage', 'range', 'arc'],
  projectile: ['damage', 'speed', 'size', 'life'],
  dash: ['distance'],
  burst: ['radius', 'damage'],
  shield: ['duration', 'reduction'],
  heal: ['amount'],
  pull: ['range', 'strength'],
  zone: ['radius', 'duration'],
  leap: ['duration', 'radius', 'damage'],
  guard: ['hits'],
  strike: ['damage', 'range'],
};

export const STEP_TYPES = Object.keys(STEP_REQUIRED);

export const EFFECT_TYPES = ['slow', 'freeze', 'stun', 'pull'];
