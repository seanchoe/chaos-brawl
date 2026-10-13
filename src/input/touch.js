import { IDLE_INPUT } from '../game/battleController.js';

const STICK_DEAD_ZONE = 0.25;
const BUTTONS = [['jump', 'Jump'], ['attack', 'Attack'], ['special', 'Special']];

// iPadOS Safari reports itself as a Mac, so check for touch support instead of the user agent.
export function isTouchDevice(win = globalThis.window) {
  if ((win?.navigator?.maxTouchPoints ?? 0) > 0) return true;
  return win?.matchMedia?.('(any-pointer: coarse)')?.matches === true;
}

// Screen up is away from the camera (-z), the same as W / ArrowUp.
export function stickInput(dx, dy, radius) {
  const len = Math.hypot(dx, dy);
  if (len < radius * STICK_DEAD_ZONE) return { moveX: 0, moveZ: 0 };
  return { moveX: dx / len, moveZ: dy / len };
}

const clampAxis = (v) => Math.max(-1, Math.min(1, v));

export function mergeInput(a, b) {
  return {
    moveX: clampAxis(a.moveX + b.moveX),
    moveZ: clampAxis(a.moveZ + b.moveZ),
    jump: a.jump || b.jump,
    attack: a.attack || b.attack,
    special: a.special || b.special,
  };
}

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

// Tracks which fingers are on an element; pointer capture keeps a finger counted when it slides off.
function trackPointers(node, { onDown, onMove, onUp }) {
  const ids = new Set();
  const down = (e) => {
    e.preventDefault();
    ids.add(e.pointerId);
    node.setPointerCapture?.(e.pointerId);
    onDown?.(e);
  };
  const move = (e) => { if (ids.has(e.pointerId)) onMove?.(e); };
  const up = (e) => {
    if (!ids.delete(e.pointerId)) return;
    onUp?.(e, ids.size);
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('lostpointercapture', up);
  return { held: () => ids.size > 0, reset: () => ids.clear() };
}

function buildStick(parent, id) {
  const zone = el('div', `touch-stick ${id}`, parent);
  const knob = el('div', 'touch-knob', zone);
  let finger = null;
  let move = { moveX: 0, moveZ: 0 };

  const aim = (e) => {
    const r = zone.getBoundingClientRect();
    const radius = r.width / 2 || 1;
    let dx = e.clientX - (r.left + radius);
    let dy = e.clientY - (r.top + r.height / 2);
    move = stickInput(dx, dy, radius);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx *= radius / len; dy *= radius / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const release = () => {
    finger = null;
    move = { moveX: 0, moveZ: 0 };
    knob.style.transform = '';
  };
  const pointers = trackPointers(zone, {
    onDown: (e) => { if (finger === null) { finger = e.pointerId; aim(e); } },
    onMove: (e) => { if (e.pointerId === finger) aim(e); },
    onUp: (e) => { if (e.pointerId === finger) release(); },
  });

  return {
    get move() { return move; },
    reset() { pointers.reset(); release(); },
  };
}

function buildButtons(parent, id) {
  const pad = el('div', `touch-buttons ${id}`, parent);
  const buttons = {};
  for (const [action, label] of BUTTONS) {
    const node = el('div', `touch-button ${action}`, pad);
    const name = el('span', 'touch-button-name', node, label);
    const pointers = trackPointers(node, {
      onDown: () => node.classList.add('held'),
      onUp: (e, left) => { if (left === 0) node.classList.remove('held'); },
    });
    buttons[action] = { node, name, pointers };
  }
  return buttons;
}

// players: ids that get controls ('p1', or 'p1' and 'p2' for a shared screen).
export function createTouchControls(container, { players, onPause }) {
  const root = el('div', `touch ${players.length > 1 ? 'duo' : 'solo'}`, container);
  const pause = el('button', 'touch-pause', root, 'II');
  pause.type = 'button';
  pause.setAttribute('aria-label', 'Pause');
  pause.addEventListener('click', () => {
    onPause();
    pause.blur();
  });

  const controls = {};
  for (const id of players) {
    controls[id] = { stick: buildStick(root, id), buttons: buildButtons(root, id) };
  }

  return {
    input(player) {
      const c = controls[player];
      if (!c) return IDLE_INPUT;
      return {
        ...c.stick.move,
        jump: c.buttons.jump.pointers.held(),
        attack: c.buttons.attack.pointers.held(),
        special: c.buttons.special.pointers.held(),
      };
    },
    // hudPlayers: hudState(match).players, for ability names and cooldowns.
    update(hudPlayers) {
      for (const p of hudPlayers) {
        const c = controls[p.id];
        if (!c) continue;
        for (const [action, name, cooldown] of [['attack', p.basicName, p.basicCooldown], ['special', p.specialName, p.specialCooldown]]) {
          const b = c.buttons[action];
          if (b.name.textContent !== name) b.name.textContent = name;
          b.node.style.setProperty('--cd', String(cooldown));
          b.node.classList.toggle('ready', cooldown === 0);
        }
      }
    },
    // Lets go of every control, e.g. when the game pauses or restarts.
    reset() {
      for (const c of Object.values(controls)) {
        c.stick.reset();
        for (const b of Object.values(c.buttons)) {
          b.pointers.reset();
          b.node.classList.remove('held');
        }
      }
    },
    dispose() {
      root.remove();
    },
  };
}
