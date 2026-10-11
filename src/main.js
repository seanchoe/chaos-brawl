import './ui/styles.css';
import { isWebGLAvailable } from './render/renderer.js';
import { showMessage } from './ui/messages.js';
import { renderQuickStart } from './ui/quickstart.js';
import { mountBattle } from './game/battleScreen.js';
import { buildMatchConfig } from './game/battleController.js';

const root = document.getElementById('app');
const NO_3D_MESSAGE = "Your browser can't show 3D games. Try Chrome, Edge, Safari, or Firefox!";
let lastChoice;

function showStart() {
  renderQuickStart(root, (choice) => {
    lastChoice = choice;
    try {
      mountBattle({ root, config: buildMatchConfig(choice), onExit: showStart });
    } catch {
      // The renderer can still fail to start even when the up-front check passed.
      showMessage(root, NO_3D_MESSAGE);
    }
  }, lastChoice);
}

if (isWebGLAvailable()) {
  showStart();
} else {
  showMessage(root, NO_3D_MESSAGE);
}
