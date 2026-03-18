import { player, camState } from './player.js';
import { enemies } from './enemies.js';
import { bossState, getBossDef } from './boss.js';
import { obstacles } from './world.js';
import { WORLD_SIZE, BOSS_ARENA_POS, BOSS_ARENA_R, ENEMY_COUNT } from './constants.js';

const hpFill = document.querySelector('#hp-bar .bar-fill');
const stamFill = document.querySelector('#stam-bar .bar-fill');
const enemyHpEl = document.getElementById('enemy-hp');
const enemyHpFill = document.querySelector('#enemy-hp .bar-fill');
const enemyNameEl = document.querySelector('#enemy-hp .name');
const xpFill = document.querySelector('#xp-bar .bar-fill');
const levelDisp = document.getElementById('level-display');
const killCounter = document.getElementById('kill-counter');
const compassEl = document.getElementById('compass');
const bossHpEl = document.getElementById('boss-hp');
const bossHpFill = document.querySelector('#boss-hp .bar-fill');
const bossNameEl = document.querySelector('#boss-hp .name');
const minimapCanvas = document.getElementById('minimap');
const mctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 160;
minimapCanvas.height = 160;

const seedsEl = document.getElementById('seeds-counter');

export function updateHud(lastTarget, targetShowTimer, gameLocation) {
  hpFill.style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  stamFill.style.width = Math.max(0, player.stamina / player.maxStamina * 100) + '%';
  xpFill.style.width = Math.max(0, player.xp / player.xpToNext * 100) + '%';
  levelDisp.textContent = 'Ур. ' + player.level;
  killCounter.textContent = 'Убийств: ' + player.kills + ' / ' + ENEMY_COUNT;
  if (seedsEl) seedsEl.textContent = '🌰 Семечки: ' + player.seeds;

  const def = getBossDef(bossState.currentBossIndex);
  if (bossState.bossDefeated) {
    compassEl.textContent = '🍉 Локация ' + gameLocation;
  } else if (bossState.bossActive && bossState.bossObj && bossState.bossObj.alive) {
    compassEl.textContent = '💀 ' + def.name + ' — БОСС';
  } else {
    const bdx = BOSS_ARENA_POS.x - player.pos.x;
    const bdz = BOSS_ARENA_POS.z - player.pos.z;
    const bDist = Math.floor(Math.sqrt(bdx * bdx + bdz * bdz));
    compassEl.textContent = '⚔️ Логово ' + def.name + ' — ' + bDist + 'м';
  }

  if (lastTarget && lastTarget.alive && targetShowTimer > 0) {
    enemyHpEl.style.display = 'block';
    enemyNameEl.textContent = lastTarget.type.name;
    enemyHpFill.style.width = Math.max(0, lastTarget.hp / lastTarget.maxHp * 100) + '%';
  } else {
    enemyHpEl.style.display = 'none';
  }

  const b = bossState.bossObj;
  if (b && b.alive && bossState.bossActive) {
    bossHpEl.style.display = 'block';
    bossNameEl.textContent = def.emoji + ' ' + def.name + (b.phase === 2 ? ' — ЯРОСТЬ' : '');
    bossHpFill.style.width = Math.max(0, b.hp / b.maxHp * 100) + '%';
  } else {
    bossHpEl.style.display = 'none';
  }
}

export function drawMinimap() {
  const w = 160, h = 160;
  mctx.fillStyle = '#2e5a1e';
  mctx.fillRect(0, 0, w, h);

  const scale = w / (WORLD_SIZE * 1.1);
  const cx = w / 2, cy = h / 2;

  mctx.fillStyle = '#1a3610';
  for (const t of obstacles) {
    const mx = cx + (t.x - player.pos.x) * scale;
    const mz = cy + (t.z - player.pos.z) * scale;
    if (mx < 0 || mx > w || mz < 0 || mz > h) continue;
    mctx.beginPath();
    mctx.arc(mx, mz, Math.max(1, t.r * scale), 0, Math.PI * 2);
    mctx.fill();
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    const mx = cx + (e.x - player.pos.x) * scale;
    const mz = cy + (e.z - player.pos.z) * scale;
    if (mx < 0 || mx > w || mz < 0 || mz > h) continue;
    mctx.fillStyle = '#ff1744';
    mctx.beginPath();
    mctx.arc(mx, mz, 2, 0, Math.PI * 2);
    mctx.fill();
  }

  if (bossState.bossObj && bossState.bossObj.alive) {
    const bmx = cx + (bossState.bossObj.x - player.pos.x) * scale;
    const bmz = cy + (bossState.bossObj.z - player.pos.z) * scale;
    mctx.fillStyle = '#ff1744';
    mctx.beginPath();
    mctx.arc(bmx, bmz, 5, 0, Math.PI * 2);
    mctx.fill();
    mctx.strokeStyle = '#fdd835'; mctx.lineWidth = 1;
    mctx.stroke();
  }

  if (!bossState.bossDefeated) {
    const amx = cx + (BOSS_ARENA_POS.x - player.pos.x) * scale;
    const amz = cy + (BOSS_ARENA_POS.z - player.pos.z) * scale;
    mctx.strokeStyle = '#c62828';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.arc(amx, amz, BOSS_ARENA_R * scale, 0, Math.PI * 2);
    mctx.stroke();
  }

  mctx.fillStyle = '#4caf50';
  mctx.beginPath();
  mctx.arc(cx, cy, 4, 0, Math.PI * 2);
  mctx.fill();

  mctx.strokeStyle = '#fff';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.moveTo(cx, cy);
  mctx.lineTo(cx + Math.sin(player.yaw) * 12, cy + Math.cos(player.yaw) * 12);
  mctx.stroke();

  mctx.globalCompositeOperation = 'destination-in';
  mctx.fillStyle = '#fff';
  mctx.beginPath();
  mctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  mctx.fill();
  mctx.globalCompositeOperation = 'source-over';
}
