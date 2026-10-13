import './ui/styles.css';
import { isWebGLAvailable } from './render/renderer.js';
import { showMessage } from './ui/messages.js';
import { renderQuickStart } from './ui/quickstart.js';
import { renderPetShop } from './ui/petShop.js';
import { mountBattle } from './game/battleScreen.js';
import { buildMatchConfig, rewardMatch } from './game/battleController.js';
import { getStorage, loadSave, writeSave } from './logic/save.js';
import { equipPet } from './logic/shop.js';

const root = document.getElementById('app');
const NO_3D_MESSAGE = "Your browser can't show 3D games. Try Chrome, Edge, Safari, or Firefox!";
const { storage } = getStorage();
let save = loadSave(storage);
let lastChoice;

function store(next) {
  save = next;
  writeSave(storage, save);
}

function showStart() {
  renderQuickStart(root, (choice) => {
    lastChoice = choice;
    store(equipPet(equipPet(save, 'p1', choice.p1.petId), 'p2', choice.mode === '2p' ? choice.p2.petId : save.lastPets.p2));
    try {
      mountBattle({
        root,
        config: buildMatchConfig(choice),
        onExit: showStart,
        onMatchOver: (match) => {
          const { save: next, coins } = rewardMatch(save, match);
          store(next);
          return `+${coins} coins! You have ${next.coins} coins.`;
        },
      });
    } catch {
      // The renderer can still fail to start even when the up-front check passed.
      showMessage(root, NO_3D_MESSAGE);
    }
  }, lastChoice, { wallet: save, onShop: showShop });
}

function showShop() {
  renderPetShop(root, save, { onChange: store, onBack: showStart });
}

if (isWebGLAvailable()) {
  showStart();
} else {
  showMessage(root, NO_3D_MESSAGE);
}
