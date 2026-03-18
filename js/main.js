import * as THREE from 'three';
import {
  WORLD_SIZE, GRAVITY, PLAYER_SPRINT, PLAYER_JUMP,
  DODGE_SPEED, DODGE_DURATION, DODGE_IFRAMES, DODGE_COST,
  ATTACK_COST, STAMINA_REGEN, STAMINA_REGEN_DELAY,
  ATTACK_RANGE, ATTACK_DMG, ATTACK_CD, COMBO_WINDOW,
  CAM_SENSITIVITY, BOSS_ARENA_POS, BOSS_ARENA_R,
} from './constants.js';
import { scene, renderer, camera } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { obstacles } from './world.js';
import { player, playerMesh, camState } from './player.js';
import { enemies, spawnEnemies, clearEnemies, updateEnemyAI } from './enemies.js';
import { bossState, spawnBoss, updateBoss, hitBoss, resetBoss } from './boss.js';
import { spawnParticles, updateParticles } from './particles.js';
import { mouse, pointer, keys, keysJustPressed } from './input.js';
import { updateHud, drawMinimap } from './hud.js';
import { portalState, spawnPortal, updatePortal, removePortal } from './portal.js';

spawnEnemies();

let gameStarted = false;
let gameLocation = 1;
let lastTarget = null;
let targetShowTimer = 0;

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
});

document.getElementById('btn-respawn').addEventListener('click', () => {
  deathScreen.style.display = 'none';
  player.hp = player.maxHp;
  player.stamina = player.maxStamina;
  player.alive = true;
  player.pos.set(0, getTerrainHeight(0, 0), 0);
  player.vel.set(0, 0, 0);
  resetBoss();
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

  camState.yaw -= mouse.dx * CAM_SENSITIVITY;
  camState.pitch = Math.max(0.05, Math.min(1.2, camState.pitch + mouse.dy * CAM_SENSITIVITY));
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

  const sprinting = keys['KeyR'] && moving && player.stamina > 1;
  const spd = sprinting ? PLAYER_SPRINT : player.speed;
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

  if ((keys['Space']) && player.grounded && !player.dodging) {
    player.vel.y = PLAYER_JUMP;
    player.grounded = false;
  }

  player.vel.y -= GRAVITY * dt;

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;

  const th = getTerrainHeight(player.pos.x, player.pos.z);
  if (player.pos.y <= th) {
    player.pos.y = th;
    player.vel.y = 0;
    player.grounded = true;
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
  }
  if (bossState.bossObj && bossState.bossObj.alive) {
    updateBoss(dt);
  }

  if (bossState.bossDefeated && !portalState.spawned) {
    spawnPortal();
  }
  updatePortal(dt);

  if (portalState.spawned && portalState.mesh) {
    const portalDist = player.pos.distanceTo(portalState.mesh.position);
    if (portalDist < 5) {
      portalPrompt.style.display = 'block';
      if (keys['KeyE']) {
        removePortal();
        clearEnemies();
        gameLocation++;
        const nx = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
        const nz = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
        player.pos.set(nx, getTerrainHeight(nx, nz), nz);
        player.vel.set(0, 0, 0);
        spawnEnemies();
        bossState.bossDefeated = false;
        portalPrompt.style.display = 'none';
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

  targetShowTimer = Math.max(0, targetShowTimer - dt);

  playerMesh.position.copy(player.pos);

  if (player.dodging) {
    player.dodgeRollAngle += dt * 18;
    playerMesh.rotation.set(0, player.yaw + Math.PI, 0);
    playerMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), player.dodgeRollAngle);
  } else {
    player.dodgeRollAngle = 0;
    playerMesh.rotation.set(0, player.yaw + Math.PI, 0);
  }

  if (moving && player.grounded && !player.dodging) {
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
    playerMesh.scale.set(1, 0.7, 1);
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

  camera.position.lerp(desiredPos, 0.12);
  camera.lookAt(camTarget);

  updateHud(lastTarget, targetShowTimer, gameLocation);
  drawMinimap();

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

player.pos.set(0, getTerrainHeight(0, 0), 0);
requestAnimationFrame(update);
