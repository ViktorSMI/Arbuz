import * as THREE from 'three';
import {
  WORLD_SIZE, GRAVITY, PLAYER_SPRINT, PLAYER_JUMP,
  DODGE_SPEED, DODGE_DURATION, DODGE_IFRAMES, DODGE_COST,
  ATTACK_COST, STAMINA_REGEN, STAMINA_REGEN_DELAY,
  ATTACK_RANGE, ATTACK_DMG, ATTACK_CD, COMBO_WINDOW,
  CAM_SENSITIVITY, BOSS_ARENA_POS, BOSS_ARENA_R, WATER_LEVEL,
} from './constants.js';
import { scene, renderer, camera } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { obstacles } from './world.js';
import { player, playerMesh, camState } from './player.js';
import { enemies, spawnEnemies, clearEnemies, updateEnemyAI } from './enemies.js';
import { bossState, spawnBoss, updateBoss, hitBoss, resetBoss, setupArena, getBossDef } from './boss.js';
import { spawnParticles, updateParticles } from './particles.js';
import { mouse, pointer, keys, keysJustPressed, lockOn } from './input.js';
import { updateHud, drawMinimap } from './hud.js';
import { portalState, spawnPortal, updatePortal, removePortal } from './portal.js';
import { spawnSeed, updateSeeds, clearSeeds } from './seeds.js';
import { startMusic, switchToBossMusic, switchToExploreMusic } from './music.js';

spawnEnemies();

let gameStarted = false;
let gameLocation = 1;
let lastTarget = null;
let targetShowTimer = 0;

let lockTarget = null;
let lockActive = false;

const lockReticle = document.getElementById('lock-reticle');

const slashGeo = new THREE.TorusGeometry(1.5, 0.08, 4, 16, Math.PI * 0.6);
const slashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const slashMesh = new THREE.Mesh(slashGeo, slashMat);
scene.add(slashMesh);

const blocker = document.getElementById('blocker');
const deathScreen = document.getElementById('death-screen');
const upgradePanel = document.getElementById('upgrade-panel');
const portalPrompt = document.getElementById('portal-prompt');
const lockInfo = document.getElementById('lock-info');

document.getElementById('btn-play').addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
  blocker.style.display = 'none';
  gameStarted = true;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  startMusic(0);
});

document.getElementById('btn-respawn').addEventListener('click', () => {
  deathScreen.style.display = 'none';
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.alive = true;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  player.vel.set(0, 0, 0);
  resetBoss();
  switchToExploreMusic();
  renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !pointer.locked) {
    renderer.domElement.requestPointerLock();
    if (lockInfo) lockInfo.style.display = 'none';
  }
});

document.addEventListener('pointerlockchange', () => {
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
    renderer.domElement.requestPointerLock();
  });
});

const clock = new THREE.Clock();

function update() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!gameStarted || !player.alive) {
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
      if (bestE) { lockTarget = bestE; lockActive = true; }
    }
  }

  if (lockActive && lockTarget) {
    if (!lockTarget.alive) {
      lockActive = false; lockTarget = null;
    } else {
      const tdx = lockTarget.x - player.pos.x, tdz = lockTarget.z - player.pos.z;
      const tDist = Math.sqrt(tdx * tdx + tdz * tdz);
      if (tDist > 40) { lockActive = false; lockTarget = null; }
    }
  }

  if (lockActive && lockTarget && (Math.abs(clampedDx) > 30)) {
    const camRight2 = new THREE.Vector3(Math.cos(camState.yaw), 0, -Math.sin(camState.yaw));
    const dir = clampedDx > 0 ? 1 : -1;
    let bestE2 = null, bestAngle = Infinity;
    for (const e of enemies) {
      if (!e.alive || e === lockTarget) continue;
      const dx2 = e.x - player.pos.x, dz2 = e.z - player.pos.z;
      const d = Math.sqrt(dx2 * dx2 + dz2 * dz2);
      if (d > 30) continue;
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

  player.attackCd = Math.max(0, player.attackCd - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (player.comboTimer <= 0) player.comboCount = 0;

  if (mouse.down && !player.attacking && player.attackCd <= 0 && player.stamina >= ATTACK_COST && !player.dodging) {
    player.attacking = true;
    player.attackTimer = 0.25;
    player.attackCd = ATTACK_CD;
    player.stamina -= ATTACK_COST;
    player.staminaDelay = STAMINA_REGEN_DELAY;
    player.comboCount = (player.comboCount % 3) + 1;
    player.comboTimer = COMBO_WINDOW;

    const atkPos = player.pos.clone().add(forward.clone().multiplyScalar(2));
    atkPos.y += 1;
    const dmg = ATTACK_DMG * (1 + (player.comboCount - 1) * 0.15) * (1 + player.upgrades.damage * 0.25);
    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x, ez = e.z, ey = e.y + e.type.r;
      const d = atkPos.distanceTo(new THREE.Vector3(ex, ey, ez));
      if (d < ATTACK_RANGE + e.type.r) {
        e.hp -= dmg;
        e.flashTimer = 0.15;
        e.stunTimer = 0.3;
        const knockDir = new THREE.Vector3(ex - player.pos.x, 0, ez - player.pos.z).normalize();
        e.vel.copy(knockDir.multiplyScalar(8));
        e.vel.y = 3;
        spawnParticles(new THREE.Vector3(ex, ey, ez), 0xff1744, 8, 5);
        lastTarget = e; targetShowTimer = 3;
        if (e.hp <= 0) {
          e.alive = false;
          e.mesh.visible = false;
          spawnParticles(new THREE.Vector3(ex, ey, ez), e.type.color, 15, 6);
          player.xp += e.type.xp;
          player.kills++;
          const seedCount = 1 + Math.floor(Math.random() * 3);
          for (let si = 0; si < seedCount; si++) spawnSeed(ex, e.y, ez);
        }
      }
    }
    hitBoss(dmg);

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
        removePortal();
        clearEnemies();
        clearSeeds();
        resetBoss();
        gameLocation++;
        bossState.currentBossIndex = gameLocation - 1;
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
        spawnEnemies();
        bossState.bossDefeated = false;
        portalPrompt.style.display = 'none';
        startMusic(gameLocation - 1);
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
  }

  updateEnemyAI(dt);
  updateParticles(dt);
  updateSeeds(dt);

  targetShowTimer = Math.max(0, targetShowTimer - dt);

  playerMesh.position.copy(player.pos);

  if (player.dodging) {
    player.dodgeRollAngle += dt * 18;
    const dodgeYaw = Math.atan2(player.dodgeDir.x, player.dodgeDir.z);
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
    const legSwing = Math.sin(player.animTime) * 0.4;
    playerMesh.userData.legL.rotation.x = legSwing;
    playerMesh.userData.legR.rotation.x = -legSwing;
    playerMesh.userData.shoeL.position.z = 0.05 + Math.sin(player.animTime) * 0.15;
    playerMesh.userData.shoeR.position.z = 0.05 - Math.sin(player.animTime) * 0.15;
    playerMesh.userData.armL.rotation.x = -legSwing * 0.5;
    playerMesh.userData.armR.rotation.x = legSwing * 0.5;
  } else {
    playerMesh.userData.legL.rotation.x *= 0.85;
    playerMesh.userData.legR.rotation.x *= 0.85;
    playerMesh.userData.armL.rotation.x *= 0.85;
    playerMesh.userData.armR.rotation.x *= 0.85;
  }

  if (player.attacking) {
    const t = 1 - player.attackTimer / 0.25;
    const swingAngle = Math.sin(t * Math.PI) * (player.comboCount % 2 === 1 ? 1.5 : -1.5);
    playerMesh.userData.sword.rotation.x = swingAngle;
    playerMesh.userData.armR.rotation.x = swingAngle * 0.5;
  } else {
    playerMesh.userData.sword.rotation.x *= 0.8;
  }

  if (player.dodging) {
    playerMesh.scale.set(1, 1, 1);
  } else {
    playerMesh.scale.x += (1 - playerMesh.scale.x) * 0.2;
    playerMesh.scale.y += (1 - playerMesh.scale.y) * 0.2;
    playerMesh.scale.z += (1 - playerMesh.scale.z) * 0.2;
  }

  if (player.dmgFlash > 0) {
    playerMesh.userData.body.material.emissive.set(0xff0000);
    playerMesh.userData.body.material.emissiveIntensity = player.dmgFlash * 5;
  } else {
    playerMesh.userData.body.material.emissiveIntensity = 0;
  }

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
  camera.lookAt(camTarget);
  if (lockActive && lockTarget && lockTarget.alive) {
    const tpos = new THREE.Vector3(lockTarget.x, lockTarget.y + lockTarget.type.r * 1.5, lockTarget.z);
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

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

player.pos.set(0, getTerrainHeight(0, 0), 0);
requestAnimationFrame(update);
