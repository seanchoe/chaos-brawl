import './ui/styles.css';
import { isWebGLAvailable } from './render/renderer.js';
import { showMessage } from './ui/messages.js';
import { renderQuickStart } from './ui/quickstart.js';
import { mountBattle } from './game/battleScreen.js';
import { buildMatchConfig } from './game/battleController.js';

const root = document.getElementById('app');
let lastChoice;

function showStart() {
  renderQuickStart(root, (choice) => {
    lastChoice = choice;
    mountBattle({ root, config: buildMatchConfig(choice), onExit: showStart });
  }, lastChoice);
}

if (isWebGLAvailable()) {
  showStart();
} else {
  showMessage(root, "Your browser can't show 3D games. Try Chrome, Edge, Safari, or Firefox!");
}
