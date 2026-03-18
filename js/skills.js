import * as THREE from 'three';
import { player } from './player.js';
import { scene } from './scene.js';
import { enemies } from './enemies.js';
import { bossState } from './boss.js';
import { spawnParticles } from './particles.js';
import { getTerrainHeight } from './terrain.js';

const ATTACK_DMG = 20;

const SKILL_DEFS = [
  {
    id: 'dash',
    name: 'Dash Attack',
    key: 'KeyQ',
    unlockLevel: 3,
    cooldown: 6,
    currentCd: 0,
    staminaCost: 30,
    icon: '💨'
  },
  {
    id: 'slam',
    name: 'AoE Slam',
    key: 'KeyF',
    unlockLevel: 5,
    cooldown: 10,
    currentCd: 0,
    staminaCost: 40,
    icon: '💥'
  },
  {
    id: 'seed',
    name: 'Seed Throw',
    key: 'KeyC',
    unlockLevel: 7,
    cooldown: 3,
    currentCd: 0,
    staminaCost: 15,
    icon: '🌰'
  }
];

const activeEntities = [];

function getPlayerDmgMult() {
  return 1 + (player.upgrades ? player.upgrades.damage * 0.25 : 0);
}

function getPlayerForward() {
  const mesh = player.mesh || player;
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(mesh.quaternion);
  dir.y = 0;
  dir.normalize();
  return dir;
}

function getPlayerPos() {
  const mesh = player.mesh || player;
  return mesh.position.clone();
}

function damageEnemy(enemy, dmg) {
  if (enemy.hp !== undefined) {
    enemy.hp -= dmg;
  }
  if (enemy.health !== undefined) {
    enemy.health -= dmg;
  }
}

function executeDash() {
  const pos = getPlayerPos();
  const dir = getPlayerForward();
  const dmg = ATTACK_DMG * 1.5 * getPlayerDmgMult();
  const dashDist = 8;
  const steps = 16;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = pos.x + dir.x * dashDist * t;
    const pz = pos.z + dir.z * dashDist * t;
    const py = getTerrainHeight(px, pz) + 1;

    spawnParticles(px, py, pz, 0x4caf50, 3);

    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e || !e.mesh) continue;
      const ex = e.mesh.position.x;
      const ez = e.mesh.position.z;
      const dist = Math.sqrt((px - ex) ** 2 + (pz - ez) ** 2);
      if (dist < 2.0) {
        damageEnemy(e, dmg);
        spawnParticles(ex, e.mesh.position.y + 1, ez, 0x4caf50, 8);
      }
    }

    if (bossState && bossState.mesh && bossState.hp > 0) {
      const bx = bossState.mesh.position.x;
      const bz = bossState.mesh.position.z;
      const dist = Math.sqrt((px - bx) ** 2 + (pz - bz) ** 2);
      if (dist < 3.0) {
        bossState.hp -= dmg;
        spawnParticles(bx, bossState.mesh.position.y + 1, bz, 0x4caf50, 10);
      }
    }
  }

  const targetPos = pos.clone().add(dir.clone().multiplyScalar(dashDist));
  const terrainY = getTerrainHeight(targetPos.x, targetPos.z);
  const mesh = player.mesh || player;
  mesh.position.set(targetPos.x, terrainY, targetPos.z);
}

function executeSlam() {
  const pos = getPlayerPos();
  const dmg = ATTACK_DMG * 2.0 * getPlayerDmgMult();
  const radius = 5;

  const ringGeo = new THREE.RingGeometry(0.5, radius, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff9800,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  const terrainY = getTerrainHeight(pos.x, pos.z);
  ring.position.set(pos.x, terrainY + 0.15, pos.z);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  const entity = { mesh: ring, type: 'slam_ring', life: 0.6 };
  activeEntities.push(entity);

  spawnParticles(pos.x, terrainY + 0.5, pos.z, 0xff9800, 30);

  for (let j = 0; j < enemies.length; j++) {
    const e = enemies[j];
    if (!e || !e.mesh) continue;
    const dist = pos.distanceTo(e.mesh.position);
    if (dist <= radius) {
      damageEnemy(e, dmg);
      spawnParticles(e.mesh.position.x, e.mesh.position.y + 1, e.mesh.position.z, 0xff9800, 8);
    }
  }

  if (bossState && bossState.mesh && bossState.hp > 0) {
    const dist = pos.distanceTo(bossState.mesh.position);
    if (dist <= radius) {
      bossState.hp -= dmg;
      spawnParticles(bossState.mesh.position.x, bossState.mesh.position.y + 1, bossState.mesh.position.z, 0xff9800, 10);
    }
  }
}

function executeSeedThrow() {
  const pos = getPlayerPos();
  const dir = getPlayerForward();

  const seedGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const seedMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    emissive: 0x333333
  });
  const seedMesh = new THREE.Mesh(seedGeo, seedMat);
  seedMesh.position.set(pos.x, pos.y + 1.2, pos.z);
  scene.add(seedMesh);

  const entity = {
    mesh: seedMesh,
    type: 'seed',
    dir: dir.clone(),
    speed: 20,
    life: 2.0,
    dmg: ATTACK_DMG * getPlayerDmgMult(),
    hit: false
  };
  activeEntities.push(entity);
}

function updateEntities(dt) {
  for (let i = activeEntities.length - 1; i >= 0; i--) {
    const e = activeEntities[i];
    e.life -= dt;

    if (e.type === 'slam_ring') {
      e.mesh.material.opacity = Math.max(0, e.life / 0.6) * 0.7;
    }

    if (e.type === 'seed' && !e.hit) {
      e.mesh.position.x += e.dir.x * e.speed * dt;
      e.mesh.position.z += e.dir.z * e.speed * dt;

      const terrainY = getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
      e.mesh.position.y = Math.max(terrainY + 0.5, e.mesh.position.y);

      for (let j = 0; j < enemies.length; j++) {
        const en = enemies[j];
        if (!en || !en.mesh) continue;
        const dist = e.mesh.position.distanceTo(en.mesh.position);
        if (dist < 1.5) {
          damageEnemy(en, e.dmg);
          spawnParticles(en.mesh.position.x, en.mesh.position.y + 1, en.mesh.position.z, 0x1a1a1a, 10);
          e.hit = true;
          e.life = 0;
          break;
        }
      }

      if (!e.hit && bossState && bossState.mesh && bossState.hp > 0) {
        const dist = e.mesh.position.distanceTo(bossState.mesh.position);
        if (dist < 2.5) {
          bossState.hp -= e.dmg;
          spawnParticles(bossState.mesh.position.x, bossState.mesh.position.y + 1, bossState.mesh.position.z, 0x1a1a1a, 10);
          e.hit = true;
          e.life = 0;
        }
      }
    }

    if (e.life <= 0) {
      scene.remove(e.mesh);
      if (e.mesh.geometry) e.mesh.geometry.dispose();
      if (e.mesh.material) e.mesh.material.dispose();
      activeEntities.splice(i, 1);
    }
  }
}

export function updateSkills(dt, keysJustPressed) {
  for (let i = 0; i < SKILL_DEFS.length; i++) {
    const skill = SKILL_DEFS[i];
    if (skill.currentCd > 0) {
      skill.currentCd -= dt;
      if (skill.currentCd < 0) skill.currentCd = 0;
    }
  }

  for (let i = 0; i < SKILL_DEFS.length; i++) {
    const skill = SKILL_DEFS[i];
    const level = player.level || 1;

    if (level < skill.unlockLevel) continue;
    if (skill.currentCd > 0) continue;
    if (!keysJustPressed[skill.key]) continue;
    if (player.stamina < skill.staminaCost) continue;

    player.stamina -= skill.staminaCost;
    skill.currentCd = skill.cooldown;

    switch (skill.id) {
      case 'dash':
        executeDash();
        break;
      case 'slam':
        executeSlam();
        break;
      case 'seed':
        executeSeedThrow();
        break;
    }
  }

  updateEntities(dt);
}

export function getSkillStates() {
  const level = player.level || 1;
  return SKILL_DEFS.map(s => ({
    id: s.id,
    name: s.name,
    unlocked: level >= s.unlockLevel,
    currentCd: s.currentCd,
    cooldown: s.cooldown,
    icon: s.icon
  }));
}

export function clearSkillEntities() {
  for (let i = activeEntities.length - 1; i >= 0; i--) {
    const e = activeEntities[i];
    scene.remove(e.mesh);
    if (e.mesh.geometry) e.mesh.geometry.dispose();
    if (e.mesh.material) e.mesh.material.dispose();
  }
  activeEntities.length = 0;
}
