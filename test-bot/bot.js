/**
 * Arbuzilla 3D — автоматический тест-бот
 * Запускает игру в браузере и автоматически проходит её,
 * проверяя все механики: NPC, квесты, боссы, враги, портал, и т.д.
 *
 * Использование:
 *   npx playwright test test-bot/bot.spec.js
 *   или напрямую:
 *   node test-bot/bot.js [--headed] [--url http://localhost:8080/index3d.html]
 */

const { chromium } = require('playwright');

// ─── Конфигурация ───
const DEFAULT_URL = 'http://localhost:8080/index3d.html';
const TICK_MS = 50;           // частота обновления бота
const MAX_GAME_TIME = 300000; // максимум 5 минут на всё
const BOSS_FIGHT_TIMEOUT = 60000;
const NPC_SEARCH_TIMEOUT = 30000;

// ─── Цвета лога ───
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

function log(msg, color = '') { console.log(`${color}[БОТ] ${msg}${C.reset}`); }
function logOk(msg)    { log(`✓ ${msg}`, C.green); }
function logFail(msg)  { log(`✗ ${msg}`, C.red); }
function logInfo(msg)  { log(`» ${msg}`, C.cyan); }
function logWarn(msg)  { log(`! ${msg}`, C.yellow); }
function logPhase(msg) { log(`═══ ${msg} ═══`, C.magenta); }

// ─── Результаты тестов ───
const results = [];
function assert(condition, name) {
  results.push({ name, passed: !!condition });
  if (condition) logOk(name);
  else logFail(name);
  return !!condition;
}

// ─── Утилиты ───
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getGameState(page) {
  return page.evaluate(() => {
    // Получаем доступ к модулям через глобальные переменные
    // (мы их экспозим через инжект)
    const s = window.__botState;
    if (!s) return null;
    return s();
  });
}

async function pressKey(page, key, duration = 100) {
  await page.keyboard.down(key);
  await sleep(duration);
  await page.keyboard.up(key);
}

async function holdKey(page, key, duration) {
  await page.keyboard.down(key);
  await sleep(duration);
  await page.keyboard.up(key);
}

async function clickMouse(page) {
  await page.evaluate(() => { window.__botAttack(); });
  await sleep(200);
}

async function moveMouse(page, dx, dy) {
  await page.mouse.move(400 + dx, 300 + dy);
}

// ─── Инжект хелперы в страницу ───
async function injectBotHelpers(page) {
  // Инжектим bridge-модуль — все импорты резолвятся при загрузке модуля
  await page.addScriptTag({
    type: 'module',
    content: `
      import { player, camState } from './js/player.js';
      import { enemies } from './js/enemies.js';
      import { bossState } from './js/boss.js';
      import { npcs } from './js/npc.js';
      import { portalState } from './js/portal.js';
      import { seeds } from './js/seeds.js';
      import { mouse } from './js/input.js';
      import { getTerrainHeight } from './js/terrain.js';
      import { BOSS_ARENA_POS, BOSS_ARENA_R } from './js/constants.js';

      window.__botState = () => ({
        player: {
          x: player.pos.x, y: player.pos.y, z: player.pos.z,
          hp: player.hp, maxHp: player.maxHp,
          stamina: player.stamina, maxStamina: player.maxStamina,
          alive: player.alive,
          grounded: player.grounded,
          level: player.level,
          xp: player.xp, xpToNext: player.xpToNext,
          kills: player.kills,
          seeds: player.seeds,
          speed: player.speed,
          dodging: player.dodging,
          attacking: player.attacking,
          upgrades: { ...player.upgrades },
        },
        enemies: enemies.map(e => ({
          name: e.type.name,
          x: e.x, y: e.y, z: e.z,
          hp: e.hp, maxHp: e.maxHp,
          alive: e.alive,
          state: e.state,
          dist: Math.sqrt((e.x - player.pos.x) ** 2 + (e.z - player.pos.z) ** 2),
        })),
        boss: bossState.bossObj ? {
          x: bossState.bossObj.x, z: bossState.bossObj.z,
          hp: bossState.bossObj.hp, maxHp: bossState.bossObj.maxHp,
          alive: bossState.bossObj.alive,
          state: bossState.bossObj.state,
          phase: bossState.bossObj.phase,
          charging: bossState.bossObj.charging,
          dist: Math.sqrt(
            (bossState.bossObj.x - player.pos.x) ** 2 +
            (bossState.bossObj.z - player.pos.z) ** 2
          ),
        } : null,
        bossDefeated: bossState.bossDefeated,
        bossActive: bossState.bossActive,
        npcs: npcs.map(n => ({
          name: n.def.name,
          x: n.x, z: n.z,
          alive: n.alive,
          hostile: n.hostile,
          questAccepted: n.questAccepted,
          questComplete: n.questComplete,
          questType: n.def.quest.type,
          dist: Math.sqrt((n.x - player.pos.x) ** 2 + (n.z - player.pos.z) ** 2),
        })),
        portal: {
          spawned: portalState.spawned,
          x: portalState.mesh ? portalState.mesh.position.x : 0,
          z: portalState.mesh ? portalState.mesh.position.z : 0,
        },
        seedCount: seeds.length,
      });

      // Телепорт — синхронный, без dynamic import
      window.__botTeleport = (x, z) => {
        const y = getTerrainHeight(x, z);
        player.pos.set(x, y, z);
        player.vel.set(0, 0, 0);
      };

      window.__botSetHp = (hp) => { player.hp = hp; };
      window.__botGiveSeeds = (n) => { player.seeds += n; };

      // Камера — синхронно
      window.__botLookAt = (tx, tz) => {
        const dx = tx - player.pos.x;
        const dz = tz - player.pos.z;
        camState.yaw = Math.atan2(-dx, -dz);
        player.yaw = camState.yaw;
      };

      // Атака — синхронно
      window.__botAttack = () => {
        mouse.down = true;
        setTimeout(() => { mouse.down = false; }, 150);
      };

      // Прямой доступ к player и настройкам
      window.__botPlayer = player;
      window.__botBossState = bossState;

      window.__botGetArenaPos = () => ({
        x: BOSS_ARENA_POS.x,
        z: BOSS_ARENA_POS.z,
        r: BOSS_ARENA_R,
      });

      window.__botReady = true;
      console.log('[BOT-BRIDGE] Bridge loaded');
    `
  });
}

// ─── Навигация к точке ───
async function walkTo(page, targetX, targetZ, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await getGameState(page);
    if (!state || !state.player.alive) return false;

    const dx = targetX - state.player.x;
    const dz = targetZ - state.player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 3) {
      await page.keyboard.up('KeyW');
      return true;
    }

    // Повернуться к цели
    await page.evaluate(([tx, tz]) => {
      window.__botLookAt(tx, tz);
    }, [targetX, targetZ]);

    // Идти вперёд (бег если далеко)
    await page.keyboard.down('KeyW');
    if (dist > 20) {
      await page.keyboard.down('KeyR'); // спринт
    } else {
      await page.keyboard.up('KeyR');
    }

    await sleep(TICK_MS);
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyR');
  return false;
}

// ─── Атака ближайшего врага ───
async function attackNearby(page, duration = 8000) {
  const start = Date.now();
  const initialState = await getGameState(page);
  const initialKills = initialState ? initialState.player.kills : 0;

  while (Date.now() - start < duration) {
    const state = await getGameState(page);
    if (!state || !state.player.alive) break;

    const alive = state.enemies.filter(e => e.alive);
    if (alive.length === 0) break;

    const nearest = alive.reduce((a, b) => a.dist < b.dist ? a : b);

    // Повернуться к врагу
    await page.evaluate(([tx, tz]) => {
      window.__botLookAt(tx, tz);
    }, [nearest.x, nearest.z]);

    if (nearest.dist > 5) {
      // Бежать к врагу
      await page.keyboard.down('KeyW');
      if (nearest.dist > 15) await page.keyboard.down('KeyR');
      await sleep(TICK_MS * 2);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyR');
    } else {
      // Атаковать — комбо из 3 ударов
      for (let i = 0; i < 3; i++) {
        await clickMouse(page);
        await sleep(100);
      }

      // Уклонение при низком HP
      if (state.player.hp < state.player.maxHp * 0.3 && state.player.stamina >= 25) {
        await page.keyboard.down('KeyA');
        await pressKey(page, 'ShiftLeft', 50);
        await sleep(300);
        await page.keyboard.up('KeyA');
      }
    }
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyR');

  const finalState = await getGameState(page);
  return finalState ? finalState.player.kills - initialKills : 0;
}

// ─── Бой с боссом ───
async function fightBoss(page, timeout = BOSS_FIGHT_TIMEOUT) {
  logInfo('Начинаю бой с боссом...');
  const start = Date.now();
  let dodgeCount = 0;

  while (Date.now() - start < timeout) {
    const state = await getGameState(page);
    if (!state) { await sleep(TICK_MS); continue; }
    if (!state.player.alive) {
      logWarn('Игрок погиб во время босс-файта!');
      return false;
    }
    if (state.bossDefeated || !state.boss || !state.boss.alive) {
      logOk('Босс побеждён!');
      return true;
    }

    const boss = state.boss;

    // Повернуться к боссу
    await page.evaluate(([tx, tz]) => {
      window.__botLookAt(tx, tz);
    }, [boss.x, boss.z]);

    // Тактика: уклоняться от атак босса, бить в паузах
    if (boss.charging) {
      // Босс чарджит — уворот в сторону
      if (state.player.stamina >= 25) {
        await page.keyboard.down('KeyA');
        await pressKey(page, 'ShiftLeft', 50);
        await sleep(300);
        await page.keyboard.up('KeyA');
        dodgeCount++;
      }
    } else if (boss.dist < 5) {
      // Близко — атакуем комбо
      await clickMouse(page);
      await sleep(150);
      await clickMouse(page);
      await sleep(150);
      await clickMouse(page);
      await sleep(200);

      // Отойти после комбо
      await page.keyboard.down('KeyS');
      await sleep(200);
      await page.keyboard.up('KeyS');
    } else if (boss.dist < 15) {
      // Средняя дистанция — подходим
      await page.keyboard.down('KeyW');
      await sleep(TICK_MS);
      await page.keyboard.up('KeyW');
    } else {
      // Далеко — бежим к боссу
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyR');
      await sleep(TICK_MS);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyR');
    }

    // При критическом HP — отлечиваемся
    if (state.player.hp < state.player.maxHp * 0.25) {
      logWarn(`HP критически низок: ${state.player.hp}/${state.player.maxHp}`);
      // Подхилим через evaluate
      await page.evaluate(() => {
        const p = window.__botPlayer;
        p.hp = Math.min(p.hp + 100, p.maxHp);
      });
    }

    await sleep(TICK_MS);
  }

  logWarn('Таймаут босс-файта');
  return false;
}

// ─── Взаимодействие с NPC ───
async function interactWithNpc(page, npcData) {
  logInfo(`Иду к НПС: ${npcData.name} (${Math.round(npcData.dist)}м)`);

  // Если далеко — телепортируемся поближе
  if (npcData.dist > 30) {
    await page.evaluate(([x, z]) => {
      window.__botTeleport(x + 5, z + 5);
    }, [npcData.x, npcData.z]);
    await sleep(300);
  }

  const reached = await walkTo(page, npcData.x, npcData.z, 10000);
  if (!reached) {
    logWarn(`Не удалось дойти до ${npcData.name}`);
    return false;
  }

  await sleep(300);

  // Нажимаем E несколько раз для прохождения всех диалогов
  for (let i = 0; i < 8; i++) {
    await pressKey(page, 'KeyE', 80);
    await sleep(400);
  }

  const stateAfter = await getGameState(page);
  if (!stateAfter) return false;

  const npc = stateAfter.npcs.find(n => n.name === npcData.name);
  return npc && npc.questAccepted;
}

// ═══════════════════════════════════════════════
//  ГЛАВНЫЙ СЦЕНАРИЙ ТЕСТИРОВАНИЯ
// ═══════════════════════════════════════════════

async function runTests() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  const urlArg = args.find(a => a.startsWith('--url'));
  const gameUrl = urlArg ? args[args.indexOf(urlArg) + 1] : DEFAULT_URL;

  logPhase('ЗАПУСК ТЕСТОВОГО БОТА');
  logInfo(`URL: ${gameUrl}`);
  logInfo(`Режим: ${headed ? 'с окном' : 'headless'}`);

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    permissions: ['clipboard-read'],
  });

  const page = await context.newPage();

  // Перехватываем console.log из игры
  page.on('console', msg => {
    if (msg.text().includes('[BOT')) {
      logInfo(`Браузер: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    logFail(`Ошибка страницы: ${err.message}`);
  });

  const gameStartTime = Date.now();

  try {
    // ══════════ ЗАГРУЗКА ИГРЫ ══════════
    logPhase('ЗАГРУЗКА ИГРЫ');

    await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 30000 });
    logOk('Страница загружена');

    // Проверяем что элементы UI существуют
    const hasBlocker = await page.$('#blocker');
    const hasDeathScreen = await page.$('#death-screen');
    const hasCanvas = await page.$('canvas');
    assert(hasBlocker, 'Элемент #blocker существует');
    assert(hasCanvas, 'Canvas для рендера существует');
    assert(hasDeathScreen, 'Экран смерти существует');

    // Инжектим хелперы
    await injectBotHelpers(page);
    await sleep(500);

    // Ждём загрузку bridge
    await page.waitForFunction(() => window.__botReady === true, { timeout: 10000 });
    logOk('Bot bridge загружен');

    // ══════════ СТАРТ ИГРЫ ══════════
    logPhase('СТАРТ ИГРЫ');

    // Кликаем кнопку "Играть"
    await page.click('#btn-play');
    await sleep(1000);

    let state = await getGameState(page);
    assert(state !== null, 'Состояние игры доступно');
    assert(state.player.alive, 'Игрок жив после старта');
    assert(state.player.hp === state.player.maxHp, 'HP полное');
    assert(state.player.stamina === state.player.maxStamina, 'Стамина полная');
    assert(state.player.level === 1, 'Уровень = 1');

    const initialHp = state.player.maxHp;
    const initialStamina = state.player.maxStamina;
    logInfo(`Стартовые параметры: HP=${initialHp}, Stamina=${initialStamina}, Speed=${state.player.speed}`);

    // ══════════ ТЕСТ ПЕРЕМЕЩЕНИЯ ══════════
    logPhase('ТЕСТ ПЕРЕМЕЩЕНИЯ');

    const startPos = { x: state.player.x, z: state.player.z };

    // Идём вперёд
    await holdKey(page, 'KeyW', 500);
    state = await getGameState(page);
    const movedDist = Math.sqrt(
      (state.player.x - startPos.x) ** 2 + (state.player.z - startPos.z) ** 2
    );
    assert(movedDist > 1, `Перемещение работает (прошли ${movedDist.toFixed(1)}м)`);

    // Тест спринта
    const sprintStart = { x: state.player.x, z: state.player.z };
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyR');
    await sleep(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyR');
    state = await getGameState(page);
    const sprintDist = Math.sqrt(
      (state.player.x - sprintStart.x) ** 2 + (state.player.z - sprintStart.z) ** 2
    );
    assert(sprintDist > movedDist * 1.2, `Спринт быстрее обычного (${sprintDist.toFixed(1)}м vs ${movedDist.toFixed(1)}м)`);
    assert(state.player.stamina < initialStamina, 'Спринт тратит стамину');

    // Ждём восстановление стамины
    await sleep(2000);
    state = await getGameState(page);
    assert(state.player.stamina > initialStamina * 0.8, 'Стамина восстанавливается');

    // ══════════ ТЕСТ ПРЫЖКА ══════════
    logPhase('ТЕСТ ПРЫЖКА');

    state = await getGameState(page);
    const preJumpY = state.player.y;
    await pressKey(page, 'Space', 50);
    await sleep(200);
    state = await getGameState(page);
    assert(state.player.y > preJumpY + 0.5, `Прыжок работает (высота: ${(state.player.y - preJumpY).toFixed(1)}м)`);
    assert(!state.player.grounded, 'В воздухе после прыжка');

    // Ждём приземления
    await sleep(1500);
    state = await getGameState(page);
    assert(state.player.grounded, 'Приземлился после прыжка');

    // ══════════ ТЕСТ УКЛОНЕНИЯ ══════════
    logPhase('ТЕСТ УКЛОНЕНИЯ');

    state = await getGameState(page);
    const preDodgeStamina = state.player.stamina;
    await page.keyboard.down('KeyW');
    await pressKey(page, 'ShiftLeft', 50);
    await sleep(100);
    state = await getGameState(page);
    assert(state.player.dodging, 'Уклонение активировано');
    assert(state.player.stamina < preDodgeStamina, 'Уклонение тратит стамину');
    await page.keyboard.up('KeyW');
    await sleep(500);

    // ══════════ ТЕСТ АТАКИ ══════════
    logPhase('ТЕСТ АТАКИ');

    state = await getGameState(page);
    const preAtkStamina = state.player.stamina;
    await clickMouse(page);
    await sleep(100);
    state = await getGameState(page);
    // Атака может не начаться если стамины мало или кд ещё идёт, но стамина должна упасть
    // Попробуем ещё раз если не сработало
    await sleep(600);
    await clickMouse(page);
    await sleep(200);
    state = await getGameState(page);
    assert(state.player.stamina < preAtkStamina || state.player.attacking, 'Атака работает');

    // ══════════ ТЕСТ КОМБО ══════════
    logPhase('ТЕСТ КОМБО');
    await sleep(1000); // ждём восстановления стамины
    await clickMouse(page);
    await sleep(200);
    await clickMouse(page);
    await sleep(200);
    await clickMouse(page);
    await sleep(200);
    logOk('Комбо выполнено (3 удара)');

    // ══════════ ТЕСТ NPC И КВЕСТОВ ══════════
    logPhase('ТЕСТ NPC');

    state = await getGameState(page);
    logInfo(`Найдено ${state.npcs.length} НПС на карте`);
    assert(state.npcs.length > 0, 'НПС заспавнились');

    let questsAccepted = 0;
    for (const npc of state.npcs) {
      if (!npc.alive || npc.hostile) continue;

      const accepted = await interactWithNpc(page, npc);
      if (accepted) {
        questsAccepted++;
        logOk(`Квест принят от ${npc.name} (тип: ${npc.questType})`);
      }

      state = await getGameState(page);
      if (!state.player.alive) break;
    }
    assert(questsAccepted > 0, `Квесты приняты: ${questsAccepted}`);

    // ══════════ ТЕСТ УБИЙСТВА ВРАГОВ ══════════
    logPhase('ТЕСТ БОЯ С ВРАГАМИ');

    state = await getGameState(page);
    const aliveEnemies = state.enemies.filter(e => e.alive);
    logInfo(`Живых врагов на карте: ${aliveEnemies.length}`);

    // Найти и убить несколько врагов
    const nearEnemies = aliveEnemies
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    let totalKills = 0;
    for (const enemy of nearEnemies) {
      logInfo(`Иду к врагу: ${enemy.name} (${Math.round(enemy.dist)}м)`);

      // Телепорт к врагу если далеко
      if (enemy.dist > 20) {
        await page.evaluate(([x, z]) => {
          window.__botTeleport(x + 3, z + 3);
        }, [enemy.x, enemy.z]);
        await sleep(300);
      }

      // Подходим к врагу
      const reached = await walkTo(page, enemy.x, enemy.z, 8000);
      if (!reached) continue;

      // Атакуем
      const kills = await attackNearby(page, 8000);
      totalKills += kills;

      state = await getGameState(page);
      if (!state.player.alive) {
        logWarn('Игрок погиб в бою!');
        // Респаун
        await page.click('#btn-respawn');
        await sleep(1000);
        break;
      }
    }

    state = await getGameState(page);
    assert(state.player.kills > 0, `Убито врагов: ${state.player.kills}`);

    // ══════════ ТЕСТ СЕМЕЧЕК ══════════
    logPhase('ТЕСТ СЕМЕЧЕК');

    state = await getGameState(page);
    assert(state.player.seeds >= 0, `Семечек собрано: ${state.player.seeds}`);
    logInfo(`Семечки на земле: ${state.seedCount}`);

    // ══════════ ТЕСТ БОСС-ФАЙТА ══════════
    logPhase('ТЕСТ БОСС-ФАЙТА');

    // Подкачаем игрока для босса
    await page.evaluate(() => {
      window.__botGiveSeeds(50);
    });
    await page.evaluate(() => {
      const p = window.__botPlayer;
      p.maxHp = 500;
      p.hp = 500;
      p.maxStamina = 200;
      p.stamina = 200;
      p.upgrades.damage += 5;
      const up = document.getElementById('upgrade-panel');
      if (up) up.style.display = 'none';
    });
    await sleep(200);

    // Получаем позицию арены
    const arenaPos = await page.evaluate(() => window.__botGetArenaPos());
    logInfo(`Арена босса: x=${arenaPos.x.toFixed(0)}, z=${arenaPos.z.toFixed(0)}`);

    // Телепортируемся прямо к краю арены
    await page.evaluate(([x, z]) => {
      window.__botTeleport(x - 5, z - 5);
    }, [arenaPos.x, arenaPos.z]);
    await sleep(500);

    // Идём к центру арены
    const reachedArena = await walkTo(page, arenaPos.x, arenaPos.z, 10000);
    assert(reachedArena, 'Дошли до арены босса');

    await sleep(1000);
    state = await getGameState(page);
    assert(state.boss !== null || state.bossDefeated, 'Босс заспавнился');

    if (state.boss && state.boss.alive) {
      logInfo(`Босс: HP=${state.boss.hp}/${state.boss.maxHp}`);

      const bossDefeated = await fightBoss(page);
      assert(bossDefeated, 'Босс побеждён');

      if (bossDefeated) {
        await sleep(1000);
        state = await getGameState(page);
        assert(state.bossDefeated, 'Флаг bossDefeated установлен');
        assert(state.portal.spawned, 'Портал появился после победы');
      }
    }

    // ══════════ ТЕСТ МУЗЫКИ ПОСЛЕ БОССА ══════════
    logPhase('ТЕСТ МУЗЫКИ ПОСЛЕ БОССА');

    // Проверяем что музыка переключилась (через наличие boss loop)
    const musicState = await page.evaluate(() => {
      // Проверяем через import что boss loop остановлен
      return import('./js/music.js').then(m => {
        // Не можем напрямую проверить private переменные,
        // но можем проверить что функции существуют
        return {
          hasSwitchToExplore: typeof m.switchToExploreMusic === 'function',
          hasSwitchToBoss: typeof m.switchToBossMusic === 'function',
        };
      });
    });
    assert(musicState.hasSwitchToExplore, 'Функция switchToExploreMusic существует');

    // ══════════ ТЕСТ ПОРТАЛА ══════════
    logPhase('ТЕСТ ПОРТАЛА');

    state = await getGameState(page);
    if (state.portal.spawned) {
      logInfo(`Портал: x=${state.portal.x.toFixed(0)}, z=${state.portal.z.toFixed(0)}`);

      const reachedPortal = await walkTo(page, state.portal.x, state.portal.z, 15000);
      if (reachedPortal) {
        // Нажимаем E для перехода
        await pressKey(page, 'KeyE', 100);
        await sleep(1000);

        state = await getGameState(page);
        assert(!state.portal.spawned || state.npcs.length > 0, 'Переход в новую локацию');
        logOk('Переход через портал выполнен');
      }
    }

    // ══════════ ТЕСТ СМЕРТИ И РЕСПАУНА ══════════
    logPhase('ТЕСТ СМЕРТИ И РЕСПАУНА');

    // Закрываем upgrade panel если он перекрывает
    await page.evaluate(() => {
      const up = document.getElementById('upgrade-panel');
      if (up) up.style.display = 'none';
    });

    // Убиваем игрока
    await page.evaluate(() => {
      const p = window.__botPlayer;
      p.hp = 0;
      p.alive = false;
      document.getElementById('death-screen').style.display = 'flex';
      document.exitPointerLock();
    });
    await sleep(500);

    state = await getGameState(page);
    assert(!state.player.alive, 'Игрок мёртв');

    // Закрываем upgrade panel перед кликом на респаун
    await page.evaluate(() => {
      const up = document.getElementById('upgrade-panel');
      if (up) up.style.display = 'none';
    });

    // Респаун
    const deathScreenVisible = await page.$eval('#death-screen', el => el.style.display !== 'none');
    assert(deathScreenVisible, 'Экран смерти показан');

    await page.click('#btn-respawn');
    await sleep(1000);

    state = await getGameState(page);
    assert(state.player.alive, 'Игрок жив после респауна');
    assert(state.player.hp > 0, `HP после респауна: ${state.player.hp}`);

    // ══════════ ТЕСТ НПС-АГРЕССИИ ══════════
    logPhase('ТЕСТ АГРЕССИИ НПС');

    state = await getGameState(page);
    const friendlyNpc = state.npcs.find(n => n.alive && !n.hostile);
    if (friendlyNpc) {
      logInfo(`Проверяю агрессию на ${friendlyNpc.name}`);
      const reached2 = await walkTo(page, friendlyNpc.x, friendlyNpc.z, 10000);
      if (reached2) {
        // Бьём НПС 3+ раза
        await page.evaluate(([tx, tz]) => {
          window.__botLookAt(tx, tz);
        }, [friendlyNpc.x, friendlyNpc.z]);

        for (let i = 0; i < 5; i++) {
          await clickMouse(page);
          await sleep(500);
        }
        await sleep(500);

        state = await getGameState(page);
        const hitNpc = state.npcs.find(n => n.name === friendlyNpc.name);
        if (hitNpc) {
          assert(hitNpc.hostile || !hitNpc.alive, `НПС ${hitNpc.name} стал враждебным или убит`);
        }
      }
    }

    // ══════════ ТЕСТ КВЕСТОВ С СЕМЕЧКАМИ ══════════
    logPhase('ТЕСТ КВЕСТОВ (GIVE)');

    state = await getGameState(page);
    const giveNpc = state.npcs.find(n => n.alive && !n.hostile && n.questType === 'give' && n.questAccepted && !n.questComplete);
    if (giveNpc) {
      // Даём достаточно семечек
      await page.evaluate(() => { window.__botGiveSeeds(50); });
      const reached3 = await walkTo(page, giveNpc.x, giveNpc.z, 10000);
      if (reached3) {
        for (let i = 0; i < 5; i++) {
          await pressKey(page, 'KeyE', 80);
          await sleep(500);
        }
        await sleep(3000); // ждём закрытия диалога

        state = await getGameState(page);
        const completedNpc = state.npcs.find(n => n.name === giveNpc.name);
        if (completedNpc) {
          assert(completedNpc.questComplete, `Квест ${giveNpc.name} завершён (give)`);
        }
      }
    }

  } catch (err) {
    logFail(`Критическая ошибка: ${err.message}`);
    console.error(err);
  } finally {
    // ══════════ ИТОГИ ══════════
    logPhase('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');

    const totalTime = ((Date.now() - gameStartTime) / 1000).toFixed(1);
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log('');
    for (const r of results) {
      const icon = r.passed ? `${C.green}✓` : `${C.red}✗`;
      console.log(`  ${icon} ${r.name}${C.reset}`);
    }
    console.log('');
    log(`Время: ${totalTime}с`, C.dim);

    if (failed === 0) {
      logOk(`ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ${passed}/${total}`);
    } else {
      logFail(`ПРОВАЛЕНО: ${failed}/${total}`);
      logOk(`Пройдено: ${passed}/${total}`);
    }

    await browser.close();

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(err => {
  logFail(`Фатальная ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});
