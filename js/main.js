import * as THREE from 'three';
import {
  WORLD_SIZE, GRAVITY, PLAYER_SPRINT, PLAYER_JUMP,
  DODGE_SPEED, DODGE_DURATION, DODGE_IFRAMES, DODGE_COST,
  ATTACK_COST, STAMINA_REGEN, STAMINA_REGEN_DELAY,
  ATTACK_RANGE, ATTACK_DMG, ATTACK_CD, COMBO_WINDOW,
  CAM_SENSITIVITY, BOSS_ARENA_POS, BOSS_ARENA_R, WATER_LEVEL,
} from './constants.js';
import { scene, renderer, camera, sunLight } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { obstacles } from './world.js';
import { player, playerMesh, camState } from './player.js';
import { enemies, spawnEnemies, clearEnemies, updateEnemyAI } from './enemies.js';
import { bossState, spawnBoss, updateBoss, hitBoss, resetBoss, setupArena, getBossDef } from './boss.js';
import { spawnParticles, updateParticles } from './particles.js';
import { mouse, pointer, keys, keysJustPressed, lockOn, touch } from './input.js';
import { updateHud, drawMinimap } from './hud.js';
import { portalState, spawnPortal, updatePortal, removePortal } from './portal.js';
import { spawnSeed, updateSeeds, clearSeeds } from './seeds.js';
import { startMusic, switchToBossMusic, switchToExploreMusic, sfxJump, sfxLand, sfxAttack, sfxDodge, sfxHit, sfxDeath, sfxEnemyHit, sfxNpcBabble, sfxLevelUp, sfxPickup, sfxSplash, sfxPortalEnter, sfxQuestComplete } from './music.js';
import { npcs, spawnNpcs, clearNpcs, updateNpcs, getNearestNpc, interactNpc, hitNpc } from './npc.js';
import { updateBlock, processIncomingDamage, isBlocking } from './combat.js';
import { updateSkills, getSkillStates, clearSkillEntities } from './skills.js';
import { updateLootDrops, clearLootDrops, rollLootDrop, getDmgMultiplier, getDefMultiplier, getEquippedSword } from './equipment.js';
import { applyBiome, getBiome } from './biomes.js';
import { updateDayNight, isNight, getTimeOfDay } from './daynight.js';
import { initPostProcessing, getComposer, resizePostProcessing, setBloomIntensity, triggerScreenShake, getScreenShakeOffset, setLowHpEffect } from './postprocessing.js';
import { spawnDamageNumber, updateDamageNumbers, clearDamageNumbers } from './damage-numbers.js';
import { updateProjectiles, clearProjectiles } from './projectiles.js';
import { updateHazards, clearHazards } from './hazards.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { loadSettings, getSetting, setSetting, saveSettings } from './settings.js';
import { setMusicVolume, setSfxVolume, sfxBlock, sfxParry, sfxEquip } from './music.js';
import { ambientLight, hemiLight } from './scene.js';
import { terrainMat } from './terrain.js';
import { grassMat, leafMats, skyMat, sunMesh, waterMat } from './world.js';
import { updateCompanions, clearCompanions, companions, companionCount } from './companions.js';
import { spawnCaravans, updateCaravans, clearCaravans, getNearestCaravan, raidCaravan, getCaravanGoods, buyFromCaravan } from './caravans.js';
import { spawnLoreItems, updateLoreItems, clearLoreItems, getFoundLoreCount } from './lore.js';
import { canSteal, attemptSteal, showStealResult } from './stealing.js';

// Инициализация post-processing
const composer = initPostProcessing(renderer, scene, camera);
window.addEventListener('resize', () => resizePostProcessing(window.innerWidth, window.innerHeight));

// Загрузка настроек
loadSettings();

// Ссылки для biome/daynight систем
const worldRefs = { terrainMat, grassMat, leafMats, scene, ambientLight, hemiLight, sunLight, waterMat, skyMat };
const dayNightRefs = { sunLight, ambientLight, hemiLight, scene, sunMesh, baseFogDensity: 0.005 };

spawnEnemies(0);
spawnNpcs();
spawnCaravans(0);
spawnLoreItems(0);

let shopOpen = false;
let activeCaravan = null;
let loreOpen = false;

let gameStarted = false;
let settingsOpen = false;
let inventoryOpen = false;
let gameLocation = 1;
let lastTarget = null;
let targetShowTimer = 0;

let lockTarget = null;
let lockActive = false;

let dialogueOpen = false;
let dialogueNpc = null;
let wasInWater = false;

const lockReticle = document.getElementById('lock-reticle');
const npcPrompt = document.getElementById('npc-prompt');
const npcDialogueEl = document.getElementById('npc-dialogue');
const npcDialogueName = document.getElementById('npc-dialogue-name');
const npcDialogueText = document.getElementById('npc-dialogue-text');
const npcRewardEl = document.getElementById('npc-reward');

const slashGeo = new THREE.TorusGeometry(1.5, 0.08, 4, 16, Math.PI * 0.6);
const slashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const slashMesh = new THREE.Mesh(slashGeo, slashMat);
scene.add(slashMesh);

const blocker = document.getElementById('blocker');
const deathScreen = document.getElementById('death-screen');
const upgradePanel = document.getElementById('upgrade-panel');
const portalPrompt = document.getElementById('portal-prompt');
const lockInfo = document.getElementById('lock-info');

// Показать кнопку "Продолжить" если есть сохранение
const btnContinue = document.getElementById('btn-continue');
if (hasSave() && btnContinue) btnContinue.style.display = 'block';

document.getElementById('btn-play').addEventListener('click', () => {
  if (!touch.active) renderer.domElement.requestPointerLock();
  blocker.style.display = 'none';
  gameStarted = true;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  applyBiome(0, worldRefs);
  startMusic(0);
});

if (btnContinue) btnContinue.addEventListener('click', () => {
  const save = loadGame();
  if (!save) return;
  blocker.style.display = 'none';
  gameStarted = true;
  // Применяем сохранение
  Object.assign(player, {
    hp: save.player.hp, maxHp: save.player.maxHp,
    stamina: save.player.stamina, maxStamina: save.player.maxStamina,
    speed: save.player.speed, xp: save.player.xp, level: save.player.level,
    xpToNext: save.player.xpToNext, kills: save.player.kills, seeds: save.player.seeds,
    alive: true,
  });
  if (save.player.upgrades) Object.assign(player.upgrades, save.player.upgrades);
  if (save.player.equipment) Object.assign(player.equipment, save.player.equipment);
  if (save.player.inventory) player.inventory = save.player.inventory;
  player.pos.set(save.position.x, save.position.y, save.position.z);
  gameLocation = save.gameLocation || 1;
  bossState.currentBossIndex = save.bossIndex || 0;
  applyBiome(gameLocation - 1, worldRefs);
  startMusic(gameLocation - 1);
  if (!touch.active) renderer.domElement.requestPointerLock();
});

// Настройки
const settingsPanel = document.getElementById('settings-panel');
const invPanel = document.getElementById('inventory-panel');

document.getElementById('btn-settings-close')?.addEventListener('click', () => {
  settingsPanel.style.display = 'none';
  settingsOpen = false;
  if (!touch.active) renderer.domElement.requestPointerLock();
});

document.getElementById('btn-inv-close')?.addEventListener('click', () => {
  invPanel.style.display = 'none';
  inventoryOpen = false;
  if (!touch.active) renderer.domElement.requestPointerLock();
});

document.getElementById('set-volume')?.addEventListener('input', e => {
  const v = e.target.value / 100;
  setMusicVolume(v);
  setSetting('masterVolume', v);
  saveSettings();
});
document.getElementById('set-sfx')?.addEventListener('input', e => {
  const v = e.target.value / 100;
  setSfxVolume(v);
  setSetting('sfxVolume', v);
  saveSettings();
});
document.getElementById('set-sens')?.addEventListener('input', e => {
  setSetting('sensitivity', e.target.value / 1000);
  saveSettings();
});

document.getElementById('btn-respawn').addEventListener('click', () => {
  deathScreen.style.display = 'none';
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.alive = true;
  player._deathMusicStopped = false;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  player.vel.set(0, 0, 0);
  resetBoss();
  bossState.bossDefeated = false;
  setupArena();
  switchToExploreMusic();
  if (!touch.active) renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !pointer.locked && !touch.active) {
    renderer.domElement.requestPointerLock();
    if (lockInfo) lockInfo.style.display = 'none';
  }
});

document.addEventListener('pointerlockchange', () => {
  if (touch.active) return;
  if (!pointer.locked && player.alive && gameStarted) {
    blocker.style.display = 'none';
    if (lockInfo) lockInfo.style.display = 'block';
  } else if (pointer.locked && lockInfo) {
    lockInfo.style.display = 'none';
  }
});

document.querySelectorAll('.upgr-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const stat = btn.dataset.stat;
    player.upgrades[stat]++;
    if (stat === 'hp') { player.maxHp += 20; player.hp = Math.min(player.hp + 20, player.maxHp); }
    if (stat === 'stamina') { player.maxStamina += 15; player.stamina = Math.min(player.stamina + 15, player.maxStamina); }
    if (stat === 'speed') { player.speed += 0.5; }
    upgradePanel.style.display = 'none';
    if (!touch.active) renderer.domElement.requestPointerLock();
  });
});

const clock = new THREE.Clock();

function update() {
  let dt = Math.min(clock.getDelta(), 0.05);

  // ESC для настроек, Tab для инвентаря
  if (keysJustPressed['Escape'] && gameStarted && player.alive) {
    if (settingsOpen) {
      settingsPanel.style.display = 'none';
      settingsOpen = false;
      if (!touch.active) renderer.domElement.requestPointerLock();
    } else if (inventoryOpen) {
      invPanel.style.display = 'none';
      inventoryOpen = false;
      if (!touch.active) renderer.domElement.requestPointerLock();
    } else {
      settingsPanel.style.display = 'flex';
      settingsOpen = true;
      document.exitPointerLock();
    }
  }
  if (keysJustPressed['Tab'] && gameStarted && player.alive && !settingsOpen) {
    if (inventoryOpen) {
      invPanel.style.display = 'none';
      inventoryOpen = false;
      if (!touch.active) renderer.domElement.requestPointerLock();
    } else {
      invPanel.style.display = 'flex';
      inventoryOpen = true;
      // Обновляем инвентарь
      const sword = getEquippedSword();
      document.getElementById('inv-sword').textContent = 'Меч: ' + (sword ? sword.name : 'Обычный');
      document.getElementById('inv-armor').textContent = 'Броня: ' + (player.equipment.armor === 'none' ? 'Нет' : player.equipment.armor);
      const itemsEl = document.getElementById('inv-items');
      itemsEl.innerHTML = player.inventory.length === 0 ? '<div style="color:#666">Пусто</div>' :
        player.inventory.map((item, i) => `<div style="padding:4px 8px;border:1px solid #555;border-radius:4px;cursor:pointer" data-inv="${i}">${item.name}</div>`).join('');
      document.exitPointerLock();
    }
  }

  // День/ночь (работает всегда)
  updateDayNight(dt, dayNightRefs);
  const timeIndicator = document.getElementById('time-indicator');
  if (timeIndicator) {
    const t = getTimeOfDay();
    timeIndicator.textContent = t < 0.25 ? '🌅' : t < 0.5 ? '☀️' : t < 0.75 ? '🌆' : '🌙';
  }

  if (!gameStarted || !player.alive || settingsOpen || inventoryOpen) {
    if (!player.alive && !player._deathMusicStopped) {
      player._deathMusicStopped = true;
      switchToExploreMusic();
      sfxDeath();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(update);
    return;
  }

  const clampedDx = mouse.dx;
  const clampedDy = mouse.dy;

  if (!lockActive) {
    camState.yaw -= clampedDx * CAM_SENSITIVITY;
  }
  camState.pitch = Math.max(0.05, Math.min(1.2, camState.pitch + clampedDy * CAM_SENSITIVITY));

  if (lockOn.toggled) {
    lockOn.toggled = false;
    if (lockActive) {
      lockActive = false;
      lockTarget = null;
    } else {
      let bestE = null, bestD = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx2 = e.x - player.pos.x, dz2 = e.z - player.pos.z;
        const d = Math.sqrt(dx2 * dx2 + dz2 * dz2);
        if (d < 30 && d < bestD) { bestD = d; bestE = e; }
      }
      const bo = bossState.bossObj;
      if (bo && bo.alive) {
        const bdx = bo.x - player.pos.x, bdz = bo.z - player.pos.z;
        const bd = Math.sqrt(bdx * bdx + bdz * bdz);
        if (bd < 40 && bd < bestD) { bestD = bd; bestE = bo; }
      }
      if (bestE) { lockTarget = bestE; lockActive = true; }
    }
  }

  if (lockActive && lockTarget) {
    if (!lockTarget.alive) {
      lockActive = false; lockTarget = null;
    } else {
      const tdx = lockTarget.x - player.pos.x, tdz = lockTarget.z - player.pos.z;
      const tDist = Math.sqrt(tdx * tdx + tdz * tdz);
      const maxLockDist = lockTarget.type ? 40 : 50;
      if (tDist > maxLockDist) { lockActive = false; lockTarget = null; }
    }
  }

  if (lockActive && lockTarget && (Math.abs(clampedDx) > 30)) {
    const camRight2 = new THREE.Vector3(Math.cos(camState.yaw), 0, -Math.sin(camState.yaw));
    const dir = clampedDx > 0 ? 1 : -1;
    let bestE2 = null, bestAngle = Infinity;
    const candidates = [...enemies];
    const bo = bossState.bossObj;
    if (bo && bo.alive) candidates.push(bo);
    for (const e of candidates) {
      if (!e.alive || e === lockTarget) continue;
      const dx2 = e.x - player.pos.x, dz2 = e.z - player.pos.z;
      const d = Math.sqrt(dx2 * dx2 + dz2 * dz2);
      if (d > 40) continue;
      const toE = new THREE.Vector3(dx2, 0, dz2).normalize();
      const dot = toE.dot(camRight2) * dir;
      if (dot > 0.1 && dot < bestAngle) { bestAngle = dot; bestE2 = e; }
    }
    if (bestE2) lockTarget = bestE2;
  }

  if (lockActive && lockTarget) {
    const lx = lockTarget.x - player.pos.x;
    const lz = lockTarget.z - player.pos.z;
    const targetYaw = Math.atan2(-lx, -lz);
    let diff = targetYaw - camState.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camState.yaw += diff * 0.15;
    camState.pitch = Math.max(0.15, Math.min(0.8, camState.pitch));
    lastTarget = lockTarget;
    targetShowTimer = 1;
  }

  mouse.dx = 0; mouse.dy = 0;

  player.yaw = camState.yaw;

  const forward = new THREE.Vector3(-Math.sin(camState.yaw), 0, -Math.cos(camState.yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const moveDir = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
  if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right);
  if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);

  const moving = moveDir.lengthSq() > 0.01;
  if (moving) moveDir.normalize();

  const th0 = getTerrainHeight(player.pos.x, player.pos.z);
  const inWater = th0 < WATER_LEVEL && player.pos.y < WATER_LEVEL + 1;
  if (inWater && !wasInWater) sfxSplash();
  wasInWater = inWater;

  const sprinting = keys['KeyR'] && moving && player.stamina > 1 && !inWater;
  const swimFactor = inWater ? 0.45 : 1;
  const spd = (sprinting ? PLAYER_SPRINT : player.speed) * swimFactor;
  if (sprinting) { player.stamina -= 12 * dt; player.staminaDelay = STAMINA_REGEN_DELAY; }

  player.dodgeCd = Math.max(0, player.dodgeCd - dt);
  const dodgePressed = keysJustPressed['ShiftLeft'] || keysJustPressed['ShiftRight'];
  if (dodgePressed && !player.dodging && player.dodgeCd <= 0 && player.grounded && player.stamina >= DODGE_COST) {
    player.dodging = true;
    player.dodgeTimer = DODGE_DURATION;
    player.dodgeCd = 0.6;
    player.invuln = DODGE_IFRAMES;
    player.stamina -= DODGE_COST;
    player.staminaDelay = STAMINA_REGEN_DELAY;
    player.dodgeDir.copy(moving ? moveDir : forward);
    spawnParticles(player.pos.clone().setY(player.pos.y + 0.5), 0x4caf50, 5, 3);
    sfxDodge();
  }

  if (player.dodging) {
    player.dodgeTimer -= dt;
    player.vel.x = player.dodgeDir.x * DODGE_SPEED;
    player.vel.z = player.dodgeDir.z * DODGE_SPEED;
    if (player.dodgeTimer <= 0) player.dodging = false;
  } else {
    player.vel.x = moveDir.x * spd;
    player.vel.z = moveDir.z * spd;
  }

  if ((keys['Space']) && player.grounded && !player.dodging && !inWater) {
    player.vel.y = PLAYER_JUMP;
    player.grounded = false;
    sfxJump();
  }

  if (inWater) {
    player.vel.y -= GRAVITY * 0.15 * dt;
    if (keys['Space']) player.vel.y += 8 * dt;
    player.vel.y *= 0.92;
    const waterSurf = WATER_LEVEL + 0.3;
    if (player.pos.y + player.vel.y * dt > waterSurf) {
      player.pos.y = waterSurf;
      player.vel.y = 0;
    }
  } else {
    player.vel.y -= GRAVITY * dt;
  }

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;

  const th = getTerrainHeight(player.pos.x, player.pos.z);
  if (player.pos.y <= th) {
    player.pos.y = th;
    player.vel.y = 0;
    player.grounded = true;
  } else if (inWater) {
    player.grounded = false;
  }

  const halfW = WORLD_SIZE / 2 - 5;
  player.pos.x = Math.max(-halfW, Math.min(halfW, player.pos.x));
  player.pos.z = Math.max(-halfW, Math.min(halfW, player.pos.z));

  for (const t of obstacles) {
    const dx = player.pos.x - t.x, dz = player.pos.z - t.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < t.r + 0.5) {
      const push = (t.r + 0.5 - dist);
      const nx = dx / dist, nz = dz / dist;
      player.pos.x += nx * push;
      player.pos.z += nz * push;
    }
  }

  player.invuln = Math.max(0, player.invuln - dt);
  player.dmgFlash = Math.max(0, player.dmgFlash - dt);

  player.staminaDelay = Math.max(0, player.staminaDelay - dt);
  if (player.staminaDelay <= 0 && player.stamina < player.maxStamina) {
    player.stamina = Math.min(player.maxStamina, player.stamina + STAMINA_REGEN * dt);
  }

  // Блок/парирование
  updateBlock(dt, mouse.rightDown);
  const blockIndicator = document.getElementById('block-indicator');
  if (blockIndicator) blockIndicator.style.display = isBlocking() ? 'block' : 'none';

  player.attackCd = Math.max(0, player.attackCd - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (player.comboTimer <= 0) player.comboCount = 0;

  if (mouse.down && !player.attacking && player.attackCd <= 0 && player.stamina >= ATTACK_COST && !player.dodging && !player.blocking) {
    player.attacking = true;
    player.attackTimer = 0.25;
    player.attackCd = ATTACK_CD;
    player.stamina -= ATTACK_COST;
    player.staminaDelay = STAMINA_REGEN_DELAY;
    player.comboCount = (player.comboCount % 3) + 1;
    player.comboTimer = COMBO_WINDOW;
    sfxAttack(player.comboCount);

    const atkPos = player.pos.clone().add(forward.clone().multiplyScalar(2));
    atkPos.y += 1;
    const dmg = ATTACK_DMG * (1 + (player.comboCount - 1) * 0.15) * (1 + player.upgrades.damage * 0.25) * getDmgMultiplier();
    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x, ez = e.z, ey = e.y + e.type.r;
      const d = atkPos.distanceTo(new THREE.Vector3(ex, ey, ez));
      if (d < ATTACK_RANGE + e.type.r) {
        e.hp -= dmg;
        e.flashTimer = 0.15;
        e.stunTimer = 0.3;
        sfxEnemyHit();
        spawnDamageNumber(ex, ey, ez, dmg, 0xff4444);
        const knockDir = new THREE.Vector3(ex - player.pos.x, 0, ez - player.pos.z).normalize();
        e.vel.copy(knockDir.multiplyScalar(8));
        e.vel.y = 3;
        spawnParticles(new THREE.Vector3(ex, ey, ez), 0xff1744, 8, 5);
        lastTarget = e; targetShowTimer = 3;
        if (e.hp <= 0) {
          e.alive = false;
          e.dying = true;
          e.deathTimer = 0.5;
          spawnParticles(new THREE.Vector3(ex, ey, ez), e.type.color, 15, 6);
          player.xp += e.type.xp;
          player.kills++;
          const seedCount = 1 + Math.floor(Math.random() * 3);
          for (let si = 0; si < seedCount; si++) spawnSeed(ex, e.y, ez);
          rollLootDrop(ex, e.y, ez);
        }
      }
    }
    hitBoss(dmg);
    if (bossState.bossObj && bossState.bossObj.flashTimer > 0) {
      const b = bossState.bossObj;
      spawnDamageNumber(b.x, b.y + 3, b.z, dmg, 0xffaa00);
    }

    for (const n of npcs) {
      if (!n.alive) continue;
      const nd = atkPos.distanceTo(new THREE.Vector3(n.x, n.y + 1.5, n.z));
      if (nd < ATTACK_RANGE + 1) hitNpc(n, dmg);
    }

    slashMat.opacity = 0.8;
    slashMesh.position.copy(player.pos).add(forward.clone().multiplyScalar(1.5));
    slashMesh.position.y += 1.2;
    slashMesh.rotation.set(0, camState.yaw + Math.PI / 2 + (player.comboCount - 2) * 0.4, 0.3 * (player.comboCount % 2 === 0 ? 1 : -1));
  }

  if (player.attacking) {
    player.attackTimer -= dt;
    if (player.attackTimer <= 0) player.attacking = false;
  }
  slashMat.opacity = Math.max(0, slashMat.opacity - dt * 4);

  const nearNpc = getNearestNpc();
  if (dialogueOpen) {
    if (dialogueNpc && (!dialogueNpc.alive || Math.hypot(dialogueNpc.x - player.pos.x, dialogueNpc.z - player.pos.z) > 6)) {
      dialogueOpen = false;
      dialogueNpc = null;
      npcDialogueEl.style.display = 'none';
    } else if (keysJustPressed['KeyE']) {
      if (dialogueNpc) {
        const result = interactNpc(dialogueNpc, bossState.bossDefeated);
        if (result.done || (dialogueNpc.dialogueIndex >= dialogueNpc.def.dialogue.length && dialogueNpc.questAccepted)) {
          npcDialogueText.textContent = result.text;
          if (result.reward) {
            npcRewardEl.textContent = result.reward;
            npcRewardEl.style.display = 'block';
            spawnParticles(player.pos.clone().setY(player.pos.y + 1.5), 0x4caf50, 20, 8);
            sfxQuestComplete();
          } else {
            npcRewardEl.style.display = 'none';
          }
          sfxNpcBabble();
          setTimeout(() => {
            dialogueOpen = false;
            dialogueNpc = null;
            npcDialogueEl.style.display = 'none';
            npcRewardEl.style.display = 'none';
          }, 2500);
        } else {
          npcDialogueText.textContent = result.text;
          sfxNpcBabble();
        }
      } else {
        dialogueOpen = false;
        npcDialogueEl.style.display = 'none';
      }
    }
    npcPrompt.style.display = 'none';
  } else if (nearNpc && !dialogueOpen) {
    npcPrompt.style.display = 'block';
    if (keysJustPressed['KeyE']) {
      dialogueOpen = true;
      dialogueNpc = nearNpc;
      if (!nearNpc.questAccepted) nearNpc._killsAtAccept = player.kills;
      const result = interactNpc(nearNpc, bossState.bossDefeated);
      npcDialogueName.textContent = nearNpc.def.name;
      npcDialogueText.textContent = result.text;
      npcDialogueEl.style.display = 'block';
      npcRewardEl.style.display = 'none';
      sfxNpcBabble();
    }
  } else {
    npcPrompt.style.display = 'none';
  }

  // Взаимодействие с караваном
  const nearCaravan = getNearestCaravan();
  const caravanPrompt = document.getElementById('caravan-prompt');
  if (nearCaravan && !dialogueOpen && !shopOpen) {
    if (caravanPrompt) caravanPrompt.style.display = 'block';
    if (keysJustPressed['KeyE']) {
      // Торговля
      shopOpen = true;
      activeCaravan = nearCaravan;
      const shopPanel = document.getElementById('shop-panel');
      const shopItems = document.getElementById('shop-items');
      const shopSeeds = document.getElementById('shop-seeds');
      if (shopPanel && shopItems) {
        const goods = getCaravanGoods(nearCaravan);
        shopItems.innerHTML = goods.map((g, i) =>
          `<div style="padding:8px 12px;border:1px solid #ff8f00;border-radius:8px;cursor:pointer;color:#fff;display:flex;justify-content:space-between" data-shop="${i}">
            <span>${g.name}</span><span style="color:#fdd835">${g.price} 🌰</span>
          </div>`
        ).join('');
        shopItems.querySelectorAll('[data-shop]').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.shop);
            const result = buyFromCaravan(activeCaravan, idx);
            if (result) {
              el.style.opacity = '0.3';
              el.style.pointerEvents = 'none';
              if (shopSeeds) shopSeeds.textContent = '🌰 Семечки: ' + player.seeds;
            }
          });
        });
        if (shopSeeds) shopSeeds.textContent = '🌰 Семечки: ' + player.seeds;
        shopPanel.style.display = 'flex';
        document.exitPointerLock();
      }
    }
    if (keysJustPressed['KeyX']) {
      // Ограбление!
      raidCaravan(nearCaravan);
      if (caravanPrompt) caravanPrompt.style.display = 'none';
    }
  } else {
    if (caravanPrompt) caravanPrompt.style.display = 'none';
  }

  // Закрытие магазина
  if (shopOpen && (keysJustPressed['Escape'] || keysJustPressed['KeyE'])) {
    document.getElementById('shop-panel').style.display = 'none';
    shopOpen = false;
    activeCaravan = null;
    if (!touch.active) renderer.domElement.requestPointerLock();
  }

  // Воровство — F рядом с НПС (не в диалоге)
  if (keysJustPressed['KeyV'] && !dialogueOpen && !shopOpen) {
    const nearNpc2 = getNearestNpc();
    if (nearNpc2 && canSteal(nearNpc2)) {
      const result = attemptSteal(nearNpc2);
      showStealResult(result);
    }
  }

  // Репутация на HUD
  const repDisplay = document.getElementById('reputation-display');
  if (repDisplay) {
    const rep = player.reputation || 0;
    const repText = rep > 20 ? '😇 Герой' : rep > 0 ? '🙂 Уважаем' : rep > -20 ? '😐 Нейтрал' : rep > -50 ? '😠 Подозрителен' : '💀 Разыскивается';
    repDisplay.textContent = `Репутация: ${rep} ${repText}`;
  }

  // Компаньоны на HUD
  const compStatus = document.getElementById('companion-status');
  if (compStatus && companions.length > 0) {
    compStatus.innerHTML = companions.map(c =>
      `👤 ${c.name}: <span style="color:${c.hp > c.maxHp * 0.3 ? '#4caf50' : '#ff1744'}">${Math.round(c.hp)}/${c.maxHp}</span>`
    ).join('<br>');
  } else if (compStatus) {
    compStatus.textContent = '';
  }

  for (const k in keysJustPressed) delete keysJustPressed[k];

  const bossDistCheck = Math.sqrt((player.pos.x - BOSS_ARENA_POS.x) ** 2 + (player.pos.z - BOSS_ARENA_POS.z) ** 2);
  if (!bossState.bossDefeated && !bossState.bossObj && bossDistCheck < BOSS_ARENA_R + 5) {
    spawnBoss();
    switchToBossMusic();
  }
  if (bossState.bossObj && bossState.bossObj.alive) {
    updateBoss(dt);
  }

  if (bossState.bossDefeated && !portalState.spawned) {
    spawnPortal();
    switchToExploreMusic();
  }
  updatePortal(dt);

  if (portalState.spawned && portalState.mesh) {
    const portalDist = player.pos.distanceTo(portalState.mesh.position);
    if (portalDist < 5) {
      portalPrompt.style.display = 'block';
      if (keys['KeyE']) {
        sfxPortalEnter();
        removePortal();
        clearEnemies();
        clearSeeds();
        clearNpcs();
        resetBoss();
        gameLocation++;
        bossState.currentBossIndex = gameLocation - 1;

        if (gameLocation > 6) {
          // Show victory screen
          document.getElementById('victory-kills').textContent = 'Убийств: ' + player.kills;
          document.getElementById('victory-level').textContent = 'Уровень: ' + player.level;
          document.getElementById('victory-seeds').textContent = 'Семечек: ' + player.seeds;
          document.getElementById('victory-screen').style.display = 'flex';
          document.exitPointerLock();
          gameStarted = false;
          portalPrompt.style.display = 'none';
          return;
        }

        const nx = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
        const nz = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
        player.pos.set(nx, getTerrainHeight(nx, nz), nz);
        player.vel.set(0, 0, 0);
        BOSS_ARENA_POS.set(
          (Math.random() - 0.5) * WORLD_SIZE * 0.4,
          0,
          (Math.random() - 0.5) * WORLD_SIZE * 0.4
        );
        setupArena();
        spawnEnemies(gameLocation - 1);
        spawnNpcs();
        clearProjectiles();
        clearHazards();
        clearLootDrops();
        clearSkillEntities();
        clearCaravans();
        clearLoreItems();
        spawnCaravans(gameLocation - 1);
        spawnLoreItems(gameLocation - 1);
        clearDamageNumbers();
        bossState.bossDefeated = false;
        portalPrompt.style.display = 'none';
        applyBiome(gameLocation - 1, worldRefs);
        dayNightRefs.baseFogDensity = getBiome(gameLocation - 1).fogDensity;
        startMusic(gameLocation - 1);
        saveGame(player, gameLocation, bossState.currentBossIndex);
        // Показ названия биома
        const biomeName = document.getElementById('biome-name');
        if (biomeName) {
          biomeName.textContent = getBiome(gameLocation - 1).name;
          biomeName.style.display = 'block';
          biomeName.style.opacity = '1';
          setTimeout(() => { biomeName.style.opacity = '0'; }, 2000);
          setTimeout(() => { biomeName.style.display = 'none'; }, 3000);
        }
      }
    } else {
      portalPrompt.style.display = 'none';
    }
  }

  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.5);
    upgradePanel.style.display = 'flex';
    document.exitPointerLock();
    sfxLevelUp();
    saveGame(player, gameLocation, bossState.currentBossIndex);
  }

  // Скиллы
  updateSkills(dt, keysJustPressed);

  updateEnemyAI(dt);
  updateNpcs(dt);
  updateParticles(dt);
  updateSeeds(dt);
  updateProjectiles(dt);
  updateHazards(dt);
  updateLootDrops(dt);
  updateCompanions(dt);
  updateCaravans(dt);
  updateLoreItems(dt);
  updateDamageNumbers(dt);

  targetShowTimer = Math.max(0, targetShowTimer - dt);

  playerMesh.position.copy(player.pos);

  if (player.dodging) {
    player.dodgeRollAngle += dt * 18;
    const dodgeYaw = Math.atan2(player.dodgeDir.x, player.dodgeDir.z);
    // Поднимаем пивот до центра тела (y=1.2) чтобы кувырок не проваливался сквозь пол
    playerMesh.position.y += 1.2;
    playerMesh.rotation.set(0, dodgeYaw, 0);
    playerMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), player.dodgeRollAngle);
    playerMesh.userData.armL.rotation.set(1.8, 0, 0.3);
    playerMesh.userData.armR.rotation.set(1.8, 0, -0.3);
    playerMesh.userData.legL.rotation.x = 1.5;
    playerMesh.userData.legR.rotation.x = 1.5;
    playerMesh.userData.sword.visible = false;
  } else {
    player.dodgeRollAngle = 0;
    playerMesh.rotation.set(0, player.yaw + Math.PI, 0);
    if (!playerMesh.userData.sword.visible) playerMesh.userData.sword.visible = true;
  }

  if (inWater && !player.dodging) {
    player.animTime += dt * 4;
    const sw = Math.sin(player.animTime);
    playerMesh.userData.armL.rotation.x = sw * 1.2;
    playerMesh.userData.armR.rotation.x = -sw * 1.2;
    playerMesh.userData.armL.rotation.z = 0.8 + Math.abs(sw) * 0.3;
    playerMesh.userData.armR.rotation.z = -0.8 - Math.abs(sw) * 0.3;
    playerMesh.userData.legL.rotation.x = -sw * 0.5;
    playerMesh.userData.legR.rotation.x = sw * 0.5;
    playerMesh.rotation.x = 0.25;
  } else if (moving && player.grounded && !player.dodging) {
    player.animTime += dt * (sprinting ? 14 : 10);
    const amp = sprinting ? 0.55 : 0.4;
    const legSwing = Math.sin(player.animTime) * amp;
    playerMesh.userData.legL.rotation.x = legSwing;
    playerMesh.userData.legR.rotation.x = -legSwing;
    playerMesh.userData.shoeL.position.z = 0.05 + Math.sin(player.animTime) * 0.15;
    playerMesh.userData.shoeR.position.z = 0.05 - Math.sin(player.animTime) * 0.15;
    playerMesh.userData.armL.rotation.x = -legSwing * 0.6;
    playerMesh.userData.armR.rotation.x = legSwing * 0.6;
    playerMesh.userData.armL.rotation.z = 0.5 + Math.abs(legSwing) * 0.15;
    playerMesh.userData.armR.rotation.z = -0.5 - Math.abs(legSwing) * 0.15;
    if (sprinting) {
      playerMesh.rotation.x = 0.12;
      playerMesh.userData.body.position.y = 1.2 + Math.abs(Math.sin(player.animTime * 2)) * 0.08;
    }
  } else if (!player.grounded && !player.dodging && !inWater) {
    const airT = Math.min(1, Math.abs(player.vel.y) / 10);
    if (player.vel.y > 0.5) {
      playerMesh.userData.legL.rotation.x = -0.6 * airT;
      playerMesh.userData.legR.rotation.x = -0.6 * airT;
      playerMesh.userData.armL.rotation.x = -1.0 * airT;
      playerMesh.userData.armR.rotation.x = -1.0 * airT;
      playerMesh.userData.armL.rotation.z = 0.5 + 0.8 * airT;
      playerMesh.userData.armR.rotation.z = -0.5 - 0.8 * airT;
    } else {
      playerMesh.userData.legL.rotation.x = 0.4 * airT;
      playerMesh.userData.legR.rotation.x = 0.4 * airT;
      playerMesh.userData.armL.rotation.x = 0.6 * airT;
      playerMesh.userData.armR.rotation.x = 0.6 * airT;
      playerMesh.userData.armL.rotation.z = 0.5 + 0.3 * airT;
      playerMesh.userData.armR.rotation.z = -0.5 - 0.3 * airT;
    }
  } else {
    playerMesh.userData.legL.rotation.x *= 0.85;
    playerMesh.userData.legR.rotation.x *= 0.85;
    playerMesh.userData.armL.rotation.x *= 0.85;
    playerMesh.userData.armR.rotation.x *= 0.85;
    playerMesh.userData.armL.rotation.z = 0.5;
    playerMesh.userData.armR.rotation.z = -0.5;
    player.animTime += dt * 1.5;
    const idleBreath = Math.sin(player.animTime) * 0.015;
    playerMesh.scale.set(1 + idleBreath, 1 - idleBreath, 1 + idleBreath);
    playerMesh.userData.body.position.y = 1.2;
  }

  if (player.attacking) {
    const t = 1 - player.attackTimer / 0.25;
    const phase = Math.sin(t * Math.PI);
    const combo = player.comboCount % 3;
    if (combo === 1) {
      playerMesh.userData.sword.rotation.set(phase * 2.0, 0, -0.3);
      playerMesh.userData.armR.rotation.x = -phase * 1.2;
      playerMesh.userData.body.position.y = 1.2 - phase * 0.08;
      playerMesh.rotation.x = phase * 0.1;
    } else if (combo === 2) {
      playerMesh.userData.sword.rotation.set(-phase * 0.5, phase * 2.2, -0.3);
      playerMesh.userData.armR.rotation.x = phase * 0.3;
      playerMesh.userData.armR.rotation.z = -0.5 - phase * 0.8;
      playerMesh.userData.body.position.y = 1.2;
    } else {
      playerMesh.userData.sword.rotation.set(phase * 2.5, 0, -0.3 + phase * 0.6);
      playerMesh.userData.armR.rotation.x = -phase * 1.5;
      playerMesh.userData.armL.rotation.x = -phase * 0.4;
      playerMesh.userData.body.position.y = 1.2 - phase * 0.12;
      playerMesh.rotation.x = phase * 0.15;
      if (!player.grounded) player.vel.y = Math.min(player.vel.y, -2);
    }
  } else {
    playerMesh.userData.sword.rotation.x *= 0.8;
    playerMesh.userData.sword.rotation.y *= 0.8;
    playerMesh.userData.body.position.y += (1.2 - playerMesh.userData.body.position.y) * 0.3;
  }

  if (player.grounded && player.vel.y <= 0 && !player.dodging) {
    const landImpact = Math.min(1, Math.abs(player._prevVelY || 0) / 12);
    if (landImpact > 0.15 && (player._wasAirborne)) {
      playerMesh.scale.set(1 + landImpact * 0.2, 1 - landImpact * 0.15, 1 + landImpact * 0.2);
      sfxLand(landImpact);
      player._wasAirborne = false;
    }
  }
  if (!player.grounded) player._wasAirborne = true;
  player._prevVelY = player.vel.y;

  if (player.dodging) {
    playerMesh.scale.set(1, 1, 1);
  } else {
    playerMesh.scale.x += (1 - playerMesh.scale.x) * 0.15;
    playerMesh.scale.y += (1 - playerMesh.scale.y) * 0.15;
    playerMesh.scale.z += (1 - playerMesh.scale.z) * 0.15;
  }
  if (!player.attacking && !player.dodging) {
    playerMesh.rotation.x += (0 - playerMesh.rotation.x) * 0.2;
  }

  if (player.dmgFlash > 0) {
    playerMesh.userData.body.material.emissive.set(0xff0000);
    playerMesh.userData.body.material.emissiveIntensity = player.dmgFlash * 5;
  } else {
    playerMesh.userData.body.material.emissiveIntensity = 0;
  }
  setLowHpEffect(player.hp / player.maxHp);

  playerMesh.userData.shadow.position.y = getTerrainHeight(player.pos.x, player.pos.z) - player.pos.y + 0.05;

  const camTarget = player.pos.clone();
  camTarget.y += 2;
  const camOffset = new THREE.Vector3(
    Math.sin(camState.yaw) * Math.cos(camState.pitch) * camState.dist,
    Math.sin(camState.pitch) * camState.dist,
    Math.cos(camState.yaw) * Math.cos(camState.pitch) * camState.dist
  );
  const desiredPos = player.pos.clone().add(camOffset);
  desiredPos.y += 2;

  const camTerrH = getTerrainHeight(desiredPos.x, desiredPos.z);
  if (desiredPos.y < camTerrH + 1) desiredPos.y = camTerrH + 1;

  const lerpFactor = 1 - Math.exp(-8 * dt);
  camera.position.lerp(desiredPos, lerpFactor);
  const shake = getScreenShakeOffset();
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  camera.lookAt(camTarget);
  if (lockActive && lockTarget && lockTarget.alive) {
    const lockR = lockTarget.type ? lockTarget.type.r : 3;
    const tpos = new THREE.Vector3(lockTarget.x, lockTarget.y + lockR * 1.5, lockTarget.z);
    const screenPos = tpos.clone().project(camera);
    const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
    const sx = (screenPos.x * hw) + hw, sy = (-screenPos.y * hh) + hh;
    if (screenPos.z > 0 && screenPos.z < 1) {
      lockReticle.style.display = 'block';
      lockReticle.style.left = sx + 'px';
      lockReticle.style.top = sy + 'px';
    } else {
      lockReticle.style.display = 'none';
    }
  } else {
    lockReticle.style.display = 'none';
  }

  updateHud(lastTarget, targetShowTimer, gameLocation);
  drawMinimap();

  // Обновление HUD скиллов
  const skillStates = getSkillStates();
  document.querySelectorAll('.skill-slot').forEach((slot, i) => {
    if (i >= skillStates.length) return;
    const sk = skillStates[i];
    const icon = slot.querySelector('.skill-icon');
    const cdOverlay = slot.querySelector('.skill-cd-overlay');
    if (icon) icon.textContent = sk.unlocked ? sk.icon : '🔒';
    if (cdOverlay) cdOverlay.style.height = sk.unlocked && sk.currentCd > 0 ? (sk.currentCd / sk.cooldown * 100) + '%' : '0%';
    slot.style.borderColor = sk.unlocked ? (sk.currentCd > 0 ? '#666' : '#4caf50') : '#444';
  });

  // Отображение экипировки
  const equipDisp = document.getElementById('equip-display');
  if (equipDisp) {
    const sw = getEquippedSword();
    equipDisp.textContent = sw ? '⚔️ ' + sw.name : '';
  }

  const comp = getComposer();
  if (comp) comp.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(update);
}

// Victory screen buttons
document.getElementById('btn-newgame-plus')?.addEventListener('click', () => {
  player.ngPlus = (player.ngPlus || 0) + 1;
  gameLocation = 1;
  bossState.currentBossIndex = 0;
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.alive = true;
  player._deathMusicStopped = false;
  const nx = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
  const nz = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
  player.pos.set(nx, getTerrainHeight(nx, nz), nz);
  player.vel.set(0, 0, 0);
  BOSS_ARENA_POS.set(
    (Math.random() - 0.5) * WORLD_SIZE * 0.4,
    0,
    (Math.random() - 0.5) * WORLD_SIZE * 0.4
  );
  resetBoss();
  setupArena();
  clearEnemies();
  clearSeeds();
  clearNpcs();
  clearProjectiles();
  clearHazards();
  clearLootDrops();
  clearSkillEntities();
  // Scale enemy HP by 1.5x per NG+ cycle (handled via player.ngPlus in spawn)
  spawnEnemies(0);
  spawnNpcs();
  bossState.bossDefeated = false;
  applyBiome(0, worldRefs);
  dayNightRefs.baseFogDensity = getBiome(0).fogDensity;
  startMusic(0);
  document.getElementById('victory-screen').style.display = 'none';
  gameStarted = true;
  if (!touch.active) renderer.domElement.requestPointerLock();
});

document.getElementById('btn-victory-menu')?.addEventListener('click', () => {
  document.getElementById('victory-screen').style.display = 'none';
  blocker.style.display = 'flex';
  gameLocation = 1;
  bossState.currentBossIndex = 0;
  resetBoss();
  clearEnemies();
  clearSeeds();
  clearNpcs();
  clearProjectiles();
  clearHazards();
  clearLootDrops();
  clearSkillEntities();
  // Reset player for fresh start from menu
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.alive = true;
  player._deathMusicStopped = false;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  player.vel.set(0, 0, 0);
  applyBiome(0, worldRefs);
  spawnEnemies(0);
  spawnNpcs();
  setupArena();
});

player.pos.set(0, getTerrainHeight(0, 0), 0);
requestAnimationFrame(update);
