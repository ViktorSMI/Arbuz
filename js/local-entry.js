import menuHtml from '../ui/game-menu.html';
import hudHtml from '../ui/game-hud.html';
import panelsHtml from '../ui/game-panels.html';
import overlaysHtml from '../ui/game-overlays.html';

const loadingScreen = document.getElementById('loading-screen');
const gameRoot = document.getElementById('game-root');

function showBootError(error) {
  console.error('Arbuz Souls failed to boot:', error);
  if (!loadingScreen) return;

  loadingScreen.classList.remove('ready');
  loadingScreen.innerHTML = `
    <div style="max-width:620px;padding:28px;text-align:center">
      <div style="font-size:64px">🥀</div>
      <h1 style="margin:12px 0 8px">Мир не пророс</h1>
      <p style="color:#aab6ad;line-height:1.6">Не удалось запустить игру. Проверьте, что папка игры распакована полностью и рядом с <code>index3d.html</code> находится папка <code>js</code>.</p>
      <pre style="white-space:pre-wrap;color:#ff9da5;font-size:12px">${String(error?.message ?? error)}</pre>
    </div>`;
}

async function boot() {
  if (!gameRoot) throw new Error('Не найден корневой элемент игры');

  // Интерфейс вшивается в game.bundle.js во время сборки. В рантайме нет fetch,
  // поэтому index3d.html можно открыть напрямую как обычный локальный файл.
  gameRoot.innerHTML = [menuHtml, hudHtml, panelsHtml, overlaysHtml].join('\n');

  // Основная игра загружается после появления всех UI-элементов в DOM.
  await import('./main.js');

  requestAnimationFrame(() => {
    loadingScreen?.classList.add('ready');
    setTimeout(() => loadingScreen?.remove(), 700);
  });
}

boot().catch(showBootError);
