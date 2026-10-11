// trigger: when the helper move may fire once its timer is ready.
//   inRange — opponent within `range` of the pet
//   hurt    — owner has less than full energy
//   noGuard — owner has no guard charge
//   always  — whenever ready
export const PET_TRIGGERS = ['inRange', 'hurt', 'noGuard', 'always'];

export const PETS = [
  {
    id: 'biscuit', name: 'Biscuit', species: 'Puppy', price: 50, interval: 4, trigger: 'inRange', range: 6,
    colors: { main: 0xc68b59, accent: 0xffffff },
    move: {
      name: 'Bonk Bark',
      description: 'Runs up and bonks a nearby opponent.',
      steps: [{ type: 'strike', damage: 4, range: 6, knockback: 2, popup: 'WOOF!' }],
    },
  },
  {
    id: 'whiskers', name: 'Whiskers', species: 'Kitty', price: 100, interval: 6, trigger: 'inRange', range: 8,
    colors: { main: 0xffa94d, accent: 0xffffff },
    move: {
      name: 'Pounce',
      description: 'Pounces on the opponent.',
      steps: [{ type: 'strike', damage: 6, range: 8, knockback: 3, popup: 'MEOW!' }],
    },
  },
  {
    id: 'hops', name: 'Hops', species: 'Bunny', price: 150, interval: 10, trigger: 'hurt',
    colors: { main: 0xf8f9fa, accent: 0xffa8c5 },
    move: {
      name: 'Carrot Snack',
      description: 'Drops a carrot that gives you energy.',
      steps: [{ type: 'heal', amount: 8 }],
    },
  },
  {
    id: 'shelly', name: 'Shelly', species: 'Turtle', price: 200, interval: 12, trigger: 'noGuard',
    colors: { main: 0x69db7c, accent: 0x8d6e63 },
    move: {
      name: 'Shell Guard',
      description: 'Blocks the next hit on you.',
      steps: [{ type: 'guard', hits: 1 }],
    },
  },
  {
    id: 'hoot', name: 'Hoot', species: 'Owl', price: 250, interval: 5, trigger: 'inRange', range: 14,
    colors: { main: 0xa07855, accent: 0xfff3bf },
    move: {
      name: 'Feather Shot',
      description: 'Shoots a feather at the opponent.',
      steps: [{ type: 'projectile', damage: 5, speed: 15, size: 0.3, life: 1.2, style: 'feather', popup: 'HOOT!' }],
    },
  },
  {
    id: 'pebble', name: 'Pebble', species: 'Penguin', price: 350, interval: 12, trigger: 'inRange', range: 8,
    colors: { main: 0x343a40, accent: 0xffffff },
    move: {
      name: 'Ice Slide',
      description: 'Slides into the opponent and freezes them.',
      steps: [{ type: 'strike', damage: 4, range: 8, effects: [{ type: 'freeze', duration: 0.8 }], popup: 'BRRR!' }],
    },
  },
  {
    id: 'ember', name: 'Ember', species: 'Baby Dragon', price: 450, interval: 6, trigger: 'inRange', range: 14,
    colors: { main: 0xff6b6b, accent: 0xffd43b },
    move: {
      name: 'Puff Ball',
      description: 'Puffs a little fireball.',
      steps: [{ type: 'projectile', damage: 8, speed: 13, size: 0.45, life: 1.3, style: 'puffball', popup: 'PUFF!' }],
    },
  },
  {
    id: 'twinkle', name: 'Twinkle', species: 'Unicorn', price: 600, interval: 12, trigger: 'always',
    colors: { main: 0xffffff, accent: 0xcc5de8 },
    move: {
      name: 'Rainbow Sparkle',
      description: 'Gives you energy and sparkles nearby opponents.',
      steps: [
        { type: 'heal', amount: 10 },
        { type: 'burst', at: 'self', radius: 3, damage: 8, knockback: 3, popup: 'SPARKLE!' },
      ],
    },
  },
];

export const PET_IDS = PETS.map((p) => p.id);

export function getPet(id) {
  const pet = PETS.find((p) => p.id === id);
  if (!pet) throw new Error(`Unknown pet: ${id}`);
  return pet;
}
