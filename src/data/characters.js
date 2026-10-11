export const CHARACTERS = [
  {
    id: 'sparkle',
    name: 'Sir Sparkle',
    description: 'A brave little knight who loves close-up sword bonks.',
    style: 'melee',
    colors: { main: 0xff8fc7, accent: 0xdfe6ee, alt: 0xffd166 },
    speed: 1.0,
    damage: 1.4,
    defense: 1.0,
    preferredRange: 1.2,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    description: 'A tiny wizard who zaps from far away.',
    style: 'magic',
    colors: { main: 0x7b6cff, accent: 0xffe066, alt: 0x4cd4b0 },
    speed: 1.0,
    damage: 0.7,
    defense: 1.0,
    preferredRange: 6,
  },
  {
    id: 'pancake',
    name: 'Chef Pancake',
    description: 'A tough chef who throws tasty treats.',
    style: 'throw',
    colors: { main: 0xffffff, accent: 0xf4a259, alt: 0xff6b6b },
    speed: 0.9,
    damage: 1.15,
    defense: 0.9,
    preferredRange: 1.5,
  },
  {
    id: 'rex',
    name: 'Robo Rex',
    description: 'A speedy robot dino with foam blasters.',
    style: 'blaster',
    colors: { main: 0x5ad16a, accent: 0x9aa5b1, alt: 0xff9f1c },
    speed: 1.15,
    damage: 1.0,
    defense: 1.0,
    preferredRange: 5,
  },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export function getCharacter(id) {
  const character = CHARACTERS.find((c) => c.id === id);
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}
