const loadingScreen = document.getElementById('loading-screen');
const gameRoot = document.getElementById('game-root');

async function loadInterface() {
  const files = [
    './ui/game-menu.html',
    './ui/game-hud.html',
    './ui/game-panels.html',
    './ui/game-overlays.html',
  ];
  const responses = await Promise.all(files.map((file) => fetch(file)));
  const failed = responses.find((response) => !response.ok);
  if (failed) throw new Error(`Не удалось загрузить интерфейс: ${failed.status}`);
  gameRoot.innerHTML = (await Promise.all(responses.map((response) => response.text()))).join('\n');
}

try {
  await loadInterface();
  await import('./main.js');
  await import('./campaign.js');
} catch (error) {
  console.error('Arbuz Souls failed to boot:', error);
  if (loadingScreen) {
    loadingScreen.innerHTML = `
      <div style="max-width:620px;padding:28px;text-align:center">
        <div style="font-size:64px">🥀</div>
        <h1 style="margin:12px 0 8px">Мир не пророс</h1>
        <p style="color:#aab6ad;line-height:1.6">Не удалось загрузить игру. Запускайте проект через <code>npm start</code>, а не открывайте HTML-файл напрямую.</p>
        <pre style="white-space:pre-wrap;color:#ff9da5;font-size:12px">${String(error?.message ?? error)}</pre>
      </div>`;
  }
  throw error;
}

requestAnimationFrame(() => {
  loadingScreen?.classList.add('ready');
  setTimeout(() => loadingScreen?.remove(), 700);
});
