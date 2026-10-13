export function showMessage(root, text) {
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'screen message';
  const title = document.createElement('h1');
  title.className = 'logo';
  title.textContent = 'CHAOS BRAWL';
  const p = document.createElement('p');
  p.className = 'message-text';
  p.textContent = text;
  box.append(title, p);
  root.appendChild(box);
}
