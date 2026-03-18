import * as THREE from 'three';
import { BOSS_ARENA_POS, BOSS_ARENA_R, ATTACK_RANGE } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';

export const bossState = {
  bossObj: null,
  bossActive: false,
  bossDefeated: false,
};

function createBossMesh() {
  const g = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(2.5, 16, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 3;
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;

  const hornGeo = new THREE.ConeGeometry(0.3, 2, 6);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, metalness: 0.4 });
  const horn = new THREE.Mesh(hornGeo, hornMat);
  horn.position.set(0, 5.5, 1.5);
  horn.rotation.x = -0.4;
  horn.castShadow = true;
  g.add(horn);

  for (let s = -1; s <= 1; s += 2) {
    const mGeo = new THREE.ConeGeometry(0.2, 1.2, 4);
    const m = new THREE.Mesh(mGeo, hornMat);
    m.position.set(s * 0.8, 3.5, 2.2);
    m.rotation.x = -0.8;
    m.rotation.z = s * 0.3;
    g.add(m);
  }

  const eyeGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.8 });
  const eL = new THREE.Mesh(eyeGeo, eyeMat);
  eL.position.set(-0.8, 4, 2);
  g.add(eL);
  const eR = new THREE.Mesh(eyeGeo, eyeMat);
  eR.position.set(0.8, 4, 2);
  g.add(eR);

  const legGeo = new THREE.CylinderGeometry(0.15, 0.12, 2, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
  for (let i = 0; i < 3; i++) {
    for (let s = -1; s <= 1; s += 2) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(s * 2.2, 1, (i - 1) * 1.2);
      leg.rotation.z = s * 0.6;
      leg.castShadow = true;
      g.add(leg);
    }
  }

  const plateGeo = new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6, metalness: 0.2 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = 3;
  plate.castShadow = true;
  g.add(plate);

  return g;
}

export function spawnBoss() {
  if (bossState.bossObj) return;
  const arenaY = getTerrainHeight(BOSS_ARENA_POS.x, BOSS_ARENA_POS.z);
  BOSS_ARENA_POS.y = arenaY;
  const mesh = createBossMesh();
  mesh.position.set(BOSS_ARENA_POS.x, arenaY, BOSS_ARENA_POS.z);
  scene.add(mesh);
  bossState.bossObj = {
    mesh, x: BOSS_ARENA_POS.x, z: BOSS_ARENA_POS.z, y: arenaY,
    hp: 500, maxHp: 500,
    alive: true, facing: 0,
    state: 'idle', stateTimer: 2,
    atkCd: 0, chargeDir: new THREE.Vector3(),
    charging: false, chargeTimer: 0,
    slamCd: 0, phase: 1,
    flashTimer: 0, stunTimer: 0,
    vel: new THREE.Vector3(),
    windupTimer: 0, nextAttack: '',
  };
  bossState.bossActive = true;
}

const arenaY = getTerrainHeight(BOSS_ARENA_POS.x, BOSS_ARENA_POS.z);
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2;
  const px = BOSS_ARENA_POS.x + Math.cos(a) * BOSS_ARENA_R;
  const pz = BOSS_ARENA_POS.z + Math.sin(a) * BOSS_ARENA_R;
  const py = getTerrainHeight(px, pz);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x616161, roughness: 0.9 })
  );
  pillar.position.set(px, py + 3, pz);
  pillar.castShadow = true;
  scene.add(pillar);
}
const arenaFloor = new THREE.Mesh(
  new THREE.RingGeometry(BOSS_ARENA_R - 1, BOSS_ARENA_R, 32),
  new THREE.MeshBasicMaterial({ color: 0xc62828, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
);
arenaFloor.rotation.x = -Math.PI / 2;
arenaFloor.position.set(BOSS_ARENA_POS.x, arenaY + 0.1, BOSS_ARENA_POS.z);
scene.add(arenaFloor);

const telegraphChargeMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0, side: THREE.DoubleSide });
const telegraphChargeGeo = new THREE.PlaneGeometry(2, 30);
const telegraphChargeMesh = new THREE.Mesh(telegraphChargeGeo, telegraphChargeMat);
telegraphChargeMesh.rotation.x = -Math.PI / 2;
telegraphChargeMesh.position.y = 0.15;
scene.add(telegraphChargeMesh);

const telegraphSlamMat = new THREE.MeshBasicMaterial({ color: 0xff6f00, transparent: true, opacity: 0, side: THREE.DoubleSide });
const telegraphSlamGeo = new THREE.RingGeometry(0.5, 8, 24);
const telegraphSlamMesh = new THREE.Mesh(telegraphSlamGeo, telegraphSlamMat);
telegraphSlamMesh.rotation.x = -Math.PI / 2;
telegraphSlamMesh.position.y = 0.15;
scene.add(telegraphSlamMesh);

const telegraphSwipeMat = new THREE.MeshBasicMaterial({ color: 0xffab00, transparent: true, opacity: 0, side: THREE.DoubleSide });
const telegraphSwipeGeo = new THREE.RingGeometry(2, 5, 16, 1, 0, Math.PI * 0.6);
const telegraphSwipeMesh = new THREE.Mesh(telegraphSwipeGeo, telegraphSwipeMat);
telegraphSwipeMesh.rotation.x = -Math.PI / 2;
telegraphSwipeMesh.position.y = 0.15;
scene.add(telegraphSwipeMesh);

export function updateBoss(dt) {
  const b = bossState.bossObj;
  if (!b || !b.alive) return;

  b.flashTimer = Math.max(0, b.flashTimer - dt);
  b.stunTimer = Math.max(0, b.stunTimer - dt);
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.slamCd = Math.max(0, b.slamCd - dt);
  b.windupTimer = Math.max(0, b.windupTimer - dt);

  const dx = player.pos.x - b.x, dz = player.pos.z - b.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  b.facing = Math.atan2(dx, dz);

  const playerInArena = Math.sqrt((player.pos.x - BOSS_ARENA_POS.x) ** 2 + (player.pos.z - BOSS_ARENA_POS.z) ** 2) < BOSS_ARENA_R + 3;
  if (!playerInArena) {
    const toCenterX = BOSS_ARENA_POS.x - b.x, toCenterZ = BOSS_ARENA_POS.z - b.z;
    const toCenterD = Math.sqrt(toCenterX * toCenterX + toCenterZ * toCenterZ);
    if (toCenterD > 2) {
      b.x += (toCenterX / toCenterD) * 4 * dt;
      b.z += (toCenterZ / toCenterD) * 4 * dt;
    }
    b.hp = Math.min(b.maxHp, b.hp + 50 * dt);
    b.charging = false;
    b.windupTimer = 0;
    b.nextAttack = '';
    b.state = 'idle'; b.stateTimer = 1;
    b.y = getTerrainHeight(b.x, b.z);
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.y = b.facing;
    telegraphChargeMat.opacity = 0;
    telegraphSlamMat.opacity = 0;
    telegraphSwipeMat.opacity = 0;
    return;
  }

  const bossFromCenter = Math.sqrt((b.x - BOSS_ARENA_POS.x) ** 2 + (b.z - BOSS_ARENA_POS.z) ** 2);
  if (bossFromCenter > BOSS_ARENA_R - 2) {
    const pullX = (BOSS_ARENA_POS.x - b.x) / bossFromCenter;
    const pullZ = (BOSS_ARENA_POS.z - b.z) / bossFromCenter;
    b.x += pullX * 2;
    b.z += pullZ * 2;
  }

  if (b.hp <= b.maxHp * 0.5 && b.phase === 1) {
    b.phase = 2;
    spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xff1744, 20, 8);
  }

  if (b.stunTimer > 0) {
    b.vel.x *= 0.9;
    b.vel.z *= 0.9;
  }
  else if (b.windupTimer > 0) {
    if (b.nextAttack === 'charge') {
      telegraphChargeMat.opacity = 0.25 + Math.sin(b.windupTimer * 15) * 0.15;
      const dir = b.chargeDir.clone();
      telegraphChargeMesh.position.set(b.x + dir.x * 15, b.y + 0.15, b.z + dir.z * 15);
      telegraphChargeMesh.rotation.y = -Math.atan2(dir.z, dir.x) + Math.PI / 2;
      telegraphChargeMesh.rotation.x = -Math.PI / 2;
      b.mesh.position.y = b.y + Math.sin(b.windupTimer * 12) * 0.5;
    } else if (b.nextAttack === 'slam') {
      telegraphSlamMat.opacity = 0.2 + Math.sin(b.windupTimer * 15) * 0.15;
      telegraphSlamMesh.position.set(b.x, b.y + 0.15, b.z);
      b.mesh.position.y = b.y + (0.8 - b.windupTimer) * 4;
    } else if (b.nextAttack === 'swipe') {
      telegraphSwipeMat.opacity = 0.25 + Math.sin(b.windupTimer * 15) * 0.15;
      telegraphSwipeMesh.position.set(b.x, b.y + 0.15, b.z);
      telegraphSwipeMesh.rotation.y = b.facing - Math.PI * 0.3;
      telegraphSwipeMesh.rotation.x = -Math.PI / 2;
      b.mesh.rotation.z = Math.sin(b.windupTimer * 10) * 0.2;
    }
  }
  else if (b.nextAttack) {
    telegraphChargeMat.opacity = 0;
    telegraphSlamMat.opacity = 0;
    telegraphSwipeMat.opacity = 0;
    b.mesh.rotation.z = 0;

    if (b.nextAttack === 'charge') {
      b.charging = true;
      b.chargeTimer = 0.8;
      b.state = 'charge';
    } else if (b.nextAttack === 'slam') {
      b.slamCd = b.phase === 2 ? 2 : 3;
      spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0x8d6e63, 20, 10);
      spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0xff6f00, 10, 6);
      if (dist < 8 && player.invuln <= 0) {
        player.hp -= (b.phase === 2 ? 30 : 20);
        player.dmgFlash = 0.3;
        player.vel.y = 8;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 8, 4);
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }
      b.stateTimer = 1.5;
      b.state = 'idle';
    } else if (b.nextAttack === 'swipe') {
      spawnParticles(new THREE.Vector3(b.x + Math.sin(b.facing) * 3, b.y + 2, b.z + Math.cos(b.facing) * 3), 0xffab00, 8, 6);
      if (dist < 4.5 && player.invuln <= 0) {
        player.hp -= (b.phase === 2 ? 20 : 15);
        player.dmgFlash = 0.2;
        const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(6);
        player.vel.copy(kd); player.vel.y = 3;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 6, 4);
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }
      b.atkCd = 1.0;
      b.state = 'idle';
      b.stateTimer = 0.8;
    }
    b.nextAttack = '';
  }
  else if (b.charging) {
    b.chargeTimer -= dt;
    b.x += b.chargeDir.x * 25 * dt;
    b.z += b.chargeDir.z * 25 * dt;
    spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0x8d6e63, 2, 3);
    if (dist < 4) {
      if (player.invuln <= 0) {
        player.hp -= (b.phase === 2 ? 35 : 25);
        player.dmgFlash = 0.3;
        const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(12);
        player.vel.copy(kd); player.vel.y = 6;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 10, 5);
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }
    }
    if (b.chargeTimer <= 0) { b.charging = false; b.atkCd = 1.5; b.state = 'idle'; b.stateTimer = 1; }
  }
  else {
    b.stateTimer -= dt;

    if (dist > 3) {
      const spd = b.phase === 2 ? 5 : 3;
      b.x += (dx / dist) * spd * dt;
      b.z += (dz / dist) * spd * dt;
    }

    if (b.stateTimer <= 0) {
      if (dist > 8 && b.atkCd <= 0) {
        b.windupTimer = b.phase === 2 ? 0.6 : 0.8;
        b.nextAttack = 'charge';
        b.chargeDir.set(dx, 0, dz).normalize();
        b.stateTimer = 2;
      } else if (dist < 6 && b.slamCd <= 0) {
        b.windupTimer = b.phase === 2 ? 0.6 : 0.8;
        b.nextAttack = 'slam';
        b.stateTimer = 2;
      } else {
        b.stateTimer = 0.3;
      }
    }

    if (dist < 4.5 && b.atkCd <= 0 && b.windupTimer <= 0) {
      b.windupTimer = b.phase === 2 ? 0.4 : 0.6;
      b.nextAttack = 'swipe';
    }
  }

  b.x += b.vel.x * dt; b.z += b.vel.z * dt;
  b.vel.x *= 0.9; b.vel.z *= 0.9;
  b.y = getTerrainHeight(b.x, b.z);
  b.mesh.position.set(b.x, b.y, b.z);
  b.mesh.rotation.y = b.facing;

  if (b.flashTimer > 0) {
    b.mesh.userData.body.material.emissive.set(0xff0000);
    b.mesh.userData.body.material.emissiveIntensity = b.flashTimer * 5;
  } else {
    b.mesh.userData.body.material.emissiveIntensity = b.phase === 2 ? 0.2 : 0;
    if (b.phase === 2) b.mesh.userData.body.material.emissive.set(0xff1744);
  }
}

export function hitBoss(dmg) {
  const b = bossState.bossObj;
  if (!b || !b.alive) return;
  const atkPos = player.pos.clone();
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  atkPos.add(fwd.multiplyScalar(2));
  atkPos.y += 1;
  const d = atkPos.distanceTo(new THREE.Vector3(b.x, b.y + 3, b.z));
  if (d < ATTACK_RANGE + 3) {
    b.hp -= dmg;
    b.flashTimer = 0.15;
    b.stunTimer = 0.2;
    const kd = new THREE.Vector3(b.x - player.pos.x, 0, b.z - player.pos.z).normalize();
    b.vel.copy(kd.multiplyScalar(3));
    spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xff1744, 8, 5);
    if (b.hp <= 0) {
      b.alive = false;
      b.mesh.visible = false;
      bossState.bossActive = false;
      bossState.bossDefeated = true;
      player.xp += 200;
      player.kills++;
      spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xfdd835, 30, 10);
    }
  }
}

export function resetBoss() {
  if (bossState.bossObj) {
    bossState.bossObj.mesh.visible = false;
    scene.remove(bossState.bossObj.mesh);
  }
  bossState.bossObj = null;
  bossState.bossActive = false;
  telegraphChargeMat.opacity = 0;
  telegraphSlamMat.opacity = 0;
  telegraphSwipeMat.opacity = 0;
}
