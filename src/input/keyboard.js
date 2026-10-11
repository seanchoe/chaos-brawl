export const BINDINGS = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', attack: 'KeyF', special: 'KeyG' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'Enter', attack: 'KeyK', special: 'KeyL' },
};

const GAME_KEYS = new Set(Object.values(BINDINGS).flatMap((b) => Object.values(b)));

const LABELS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', Escape: 'Esc' };

export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  return LABELS[code] ?? code;
}

export function readInput(down, b) {
  return {
    moveX: (down.has(b.right) ? 1 : 0) - (down.has(b.left) ? 1 : 0),
    moveZ: (down.has(b.down) ? 1 : 0) - (down.has(b.up) ? 1 : 0),
    jump: down.has(b.jump),
    attack: down.has(b.attack),
    special: down.has(b.special),
  };
}

export function createKeyboard(target = globalThis.window) {
  const down = new Set();
  const pressed = new Set();

  const onDown = (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  };
  const onUp = (e) => { down.delete(e.code); };
  const onBlur = () => { down.clear(); };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  return {
    input(player) {
      return readInput(down, BINDINGS[player]);
    },
    consumePress(code) {
      const had = pressed.has(code);
      pressed.delete(code);
      return had;
    },
    clearPresses() {
      pressed.clear();
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
      pressed.clear();
    },
  };
}
