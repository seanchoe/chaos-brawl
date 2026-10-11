import { cooldownFraction } from '../logic/fighter.js';
import { INTRO_TIME, WINS_NEEDED } from '../logic/match.js';
import { ROUND_TIME, MAX_ENERGY } from '../logic/constants.js';
import { BINDINGS, keyLabel } from '../input/keyboard.js';

export const FIGHT_BANNER_TIME = 0.8;
const LOW_ENERGY = 30;

export function playerLabel(match, id) {
  if (id === 'p1') return 'P1';
  return match.mode === 'cpu' ? 'CPU' : 'P2';
}

function displayName(match, id) {
  const [a, b] = match.world.fighters;
  const f = id === 'p1' ? a : b;
  const mirror = a.character.name === b.character.name;
  return mirror ? `${f.character.name} (${playerLabel(match, id)})` : f.character.name;
}

export function bannerFor(match) {
  switch (match.state) {
    case 'intro':
      if (match.stateTime > INTRO_TIME / 2) return match.round > 3 ? 'BONUS ROUND!' : `ROUND ${match.round}`;
      return 'GET READY...';
    case 'fighting':
      return ROUND_TIME - match.timeLeft < FIGHT_BANNER_TIME ? 'FIGHT!' : '';
    case 'roundOver':
      return match.roundWinner === 'tie' ? 'TIE ROUND!' : `${displayName(match, match.roundWinner)} wins the round!`;
    case 'matchOver':
      return match.winner === 'draw' ? "IT'S A DRAW!" : `${displayName(match, match.winner)} WINS!`;
    default:
      return '';
  }
}

export function hudState(match) {
  const now = match.world.time;
  return {
    timer: String(Math.ceil(match.timeLeft)),
    banner: bannerFor(match),
    players: match.world.fighters.map((f) => {
      const label = playerLabel(match, f.id);
      return {
        id: f.id,
        label,
        name: f.character.name,
        level: f.level,
        energyPct: Math.max(0, Math.min(100, (f.energy / MAX_ENERGY) * 100)),
        wins: match.wins[f.id],
        weaponName: f.weapon.name,
        basicName: f.weapon.basic.name,
        specialName: f.weapon.special.name,
        basicCooldown: cooldownFraction(f, 'basic', now),
        specialCooldown: cooldownFraction(f, 'special', now),
        keys: label === 'CPU' ? null : { attack: keyLabel(BINDINGS[f.id].attack), special: keyLabel(BINDINGS[f.id].special) },
      };
    }),
  };
}

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

function buildPlayer(parent, id, side) {
  const root = el('div', `hud-player ${side}`, parent);
  root.dataset.id = id;
  const name = el('div', 'hud-name', root);
  const bar = el('div', 'hud-bar', root);
  const fill = el('div', 'hud-bar-fill', bar);
  const wins = el('div', 'hud-wins', root);
  return { name, fill, wins };
}

function buildAbilities(parent, id, side) {
  const root = el('div', `hud-abilities ${side}`, parent);
  root.dataset.id = id;
  const make = () => {
    const box = el('div', 'hud-ability', root);
    const ring = el('div', 'hud-ring', box);
    const key = el('div', 'hud-key', ring);
    const label = el('div', 'hud-ability-name', box);
    return { box, ring, key, label };
  };
  return { basic: make(), special: make() };
}

export function createHud(container) {
  const root = el('div', 'hud', container);
  const top = el('div', 'hud-top', root);
  const players = { p1: buildPlayer(top, 'p1', 'left') };
  const timer = el('div', 'hud-timer', top);
  players.p2 = buildPlayer(top, 'p2', 'right');
  const banner = el('div', 'hud-banner', root);
  const bottom = el('div', 'hud-bottom', root);
  const abilities = { p1: buildAbilities(bottom, 'p1', 'left'), p2: buildAbilities(bottom, 'p2', 'right') };

  function setAbility(slot, name, cooldown, key) {
    slot.label.textContent = name;
    slot.key.textContent = key ?? '';
    slot.ring.style.setProperty('--cd', String(cooldown));
    slot.box.classList.toggle('ready', cooldown === 0);
  }

  return {
    update(state) {
      timer.textContent = state.timer;
      banner.textContent = state.banner;
      banner.classList.toggle('show', state.banner !== '');
      for (const p of state.players) {
        const ui = players[p.id];
        ui.name.textContent = `${p.label} · ${p.name} · Lv ${p.level}`;
        ui.fill.style.width = `${p.energyPct}%`;
        ui.fill.classList.toggle('low', p.energyPct <= LOW_ENERGY);
        const dots = Math.max(WINS_NEEDED, p.wins);
        ui.wins.textContent = '★'.repeat(p.wins) + '☆'.repeat(dots - p.wins);
        const ab = abilities[p.id];
        setAbility(ab.basic, p.basicName, p.basicCooldown, p.keys?.attack);
        setAbility(ab.special, p.specialName, p.specialCooldown, p.keys?.special);
      }
    },
    dispose() {
      root.remove();
    },
  };
}
