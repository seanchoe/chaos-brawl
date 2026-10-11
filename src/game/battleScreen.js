import { createRenderer } from '../render/renderer.js';
import { buildArena } from '../render/arena.js';
import { createBattleView } from '../render/view.js';
import { createEffects } from '../render/effects.js';
import { computeCamera, smoothToward, CAMERA } from '../render/math.js';
import { createHud, hudState, bannerFor } from '../ui/hud.js';
import { createKeyboard } from '../input/keyboard.js';
import { createLoop } from './loop.js';
import { createBattleController } from './battleController.js';
import { drainEvents } from '../logic/world.js';
import { DT } from '../logic/constants.js';

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function mountBattle({ root, config, onExit }) {
  root.innerHTML = '';
  const stage = el('div', 'stage', root);
  const gfx = createRenderer(stage);
  gfx.scene.add(buildArena());

  const tintP2 = config.p1.characterId === config.p2.characterId;
  let controller = createBattleController(config);
  let view = createBattleView(gfx.scene, { tintP2 });
  const effects = createEffects({ scene: gfx.scene, container: stage });
  const hud = createHud(stage);
  const keyboard = createKeyboard(window);
  const overlay = el('div', 'overlay', stage);
  overlay.hidden = true;

  const start = computeCamera(controller.match.world.fighters[0].pos, controller.match.world.fighters[1].pos);
  const cam = { pos: { ...start.position }, target: { ...start.target } };
  let resultShown = false;

  // Drop stale key presses and focus (e.g. from the menu) so they can't pause or click buttons.
  function resetInputFocus() {
    keyboard.clearPresses();
    document.activeElement?.blur?.();
  }

  function showOverlay(title, buttons) {
    overlay.innerHTML = '';
    const box = el('div', 'overlay-box', overlay);
    el('h2', 'overlay-title', box, title);
    const row = el('div', 'button-row', box);
    for (const { label, onClick } of buttons) {
      const b = el('button', 'choice big', row, label);
      b.type = 'button';
      b.addEventListener('click', () => {
        onClick();
        b.blur();
      });
    }
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  function showPause() {
    showOverlay('Paused', [
      { label: 'Resume', onClick: () => loop.resume() },
      { label: 'Quit', onClick: exit },
    ]);
  }

  function showResults() {
    resultShown = true;
    showOverlay(bannerFor(controller.match), [
      { label: 'Rematch', onClick: rematch },
      { label: 'Back', onClick: exit },
    ]);
  }

  function rematch() {
    view.clear();
    effects.clear();
    controller = createBattleController(config);
    view = createBattleView(gfx.scene, { tintP2 });
    resultShown = false;
    loop.resume();
    hideOverlay();
    resetInputFocus();
  }

  function step(dt) {
    controller.step(dt, { p1: keyboard.input('p1'), p2: keyboard.input('p2') });
  }

  function render(frameSeconds, paused) {
    if (keyboard.consumePress('Escape') && !resultShown) {
      if (loop.paused) loop.resume();
      else loop.pause();
    }
    keyboard.clearPresses();

    const { world } = controller.match;
    const events = drainEvents(world);
    view.handleEvents(events);
    effects.handleEvents(events, world);

    const dt = paused ? 0 : frameSeconds;
    view.sync(world, dt);

    const [a, b] = world.fighters;
    const goal = computeCamera(a.pos, b.pos);
    for (const k of ['x', 'y', 'z']) {
      cam.pos[k] = smoothToward(cam.pos[k], goal.position[k], CAMERA.smoothing, frameSeconds);
      cam.target[k] = smoothToward(cam.target[k], goal.target[k], CAMERA.smoothing, frameSeconds);
    }
    gfx.camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
    gfx.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
    gfx.camera.updateMatrixWorld();

    const { width, height } = gfx.size();
    effects.update(dt, gfx.camera, width, height);
    hud.update(hudState(controller.match));
    gfx.render();

    if (controller.isOver && !resultShown) showResults();
  }

  const loop = createLoop({
    step,
    render,
    dt: DT,
    onPauseChange: (paused) => {
      if (resultShown) return;
      if (paused) showPause();
      else hideOverlay();
    },
  });

  function exit() {
    loop.stop();
    keyboard.dispose();
    effects.dispose();
    view.clear();
    hud.dispose();
    gfx.dispose();
    root.innerHTML = '';
    onExit();
  }

  resetInputFocus();
  loop.start();
  return { exit };
}
