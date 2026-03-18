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
  },
  {
    id: 'vine',
    name: 'Vine Whip',
    key: 'Digit1',
    unlockLevel: 4,
    cooldown: 8,
    currentCd: 0,
    staminaCost: 25,
    icon: '🌿'
  },
  {
    id: 'shield',
    name: 'Melon Shield',
    key: 'Digit2',
    unlockLevel: 6,
    cooldown: 15,
    currentCd: 0,
    staminaCost: 50,
    icon: '🛡️'
  },
  {
    id: 'rain',
    name: 'Seed Rain',
    key: 'Digit3',
    unlockLevel: 9,
    cooldown: 12,
    currentCd: 0,
    staminaCost: 45,
    icon: '🌧️'
  },
  {
    id: 'rind',
    name: 'Rind Armor',
    key: 'Digit4',
    unlockLevel: 8,
    cooldown: 20,
    currentCd: 0,
    staminaCost: 35,
    icon: '🍉'
  }
];

const activeEntities = [];

function getPlayerDmgMult() {
  return 1 + (player.upgrades ? player.upgrades.damage * 0.25 : 0);
}

function getPlayerForward() {
  return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
}

function getPlayerPos() {
  return player.pos.clone();
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

    spawnParticles(new THREE.Vector3(px, py, pz), 0x4caf50, 3, 3);

    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e || !e.alive) continue;
      const ex = e.x;
      const ez = e.z;
      const dist = Math.sqrt((px - ex) ** 2 + (pz - ez) ** 2);
      if (dist < 2.0) {
        damageEnemy(e, dmg);
        spawnParticles(new THREE.Vector3(ex, e.y + 1, ez), 0x4caf50, 8, 5);
      }
    }

    const bo = bossState.bossObj;
      if (bo && bo.alive) {
        const dist = Math.sqrt((px - bo.x) ** 2 + (pz - bo.z) ** 2);
        if (dist < 3.0) {
          bo.hp -= dmg;
          spawnParticles(new THREE.Vector3(bo.x, bo.y + 3, bo.z), 0x4caf50, 10, 5);
        }
      }
  }

  const targetPos = pos.clone().add(dir.clone().multiplyScalar(dashDist));
  const terrainY = getTerrainHeight(targetPos.x, targetPos.z);
  player.pos.set(targetPos.x, terrainY, targetPos.z);
  player.vel.set(0, 0, 0);
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

  spawnParticles(new THREE.Vector3(pos.x, terrainY + 0.5, pos.z), 0xff9800, 30, 8);

  for (let j = 0; j < enemies.length; j++) {
    const e = enemies[j];
    if (!e || !e.alive) continue;
    const dist = Math.sqrt((pos.x - e.x) ** 2 + (pos.z - e.z) ** 2);
    if (dist <= radius) {
      damageEnemy(e, dmg);
      spawnParticles(new THREE.Vector3(e.x, e.y + 1, e.z), 0xff9800, 8, 5);
    }
  }

  const bo2 = bossState.bossObj;
  if (bo2 && bo2.alive) {
    const bDist = Math.sqrt((pos.x - bo2.x) ** 2 + (pos.z - bo2.z) ** 2);
    if (bDist <= radius) {
      bo2.hp -= dmg;
      spawnParticles(new THREE.Vector3(bo2.x, bo2.y + 3, bo2.z), 0xff9800, 10, 5);
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

    if (e.type === 'slam_ring' || e.type === 'vine_whip') {
      e.mesh.material.opacity = Math.max(0, e.life / 0.6) * 0.7;
    }

    // Скиллы, следующие за игроком
    if (e.followPlayer) {
      e.mesh.position.copy(player.pos);
      e.mesh.position.y += 1;
      e.mesh.rotation.y += dt * 2;
    }

    // Падающие семечки (Seed Rain)
    if (e.type === 'rain_seed' && !e.hit) {
      e.mesh.position.y += e.vy * dt;
      if (e.mesh.position.y <= e.targetY) {
        e.mesh.position.y = e.targetY;
        e.hit = true;
        e.life = 0.3;
        spawnParticles(e.mesh.position.clone(), 0x8d6e63, 5, 3);
        // Урон врагам в радиусе 2
        for (const en of enemies) {
          if (!en.alive) continue;
          const d = Math.sqrt((e.mesh.position.x - en.x) ** 2 + (e.mesh.position.z - en.z) ** 2);
          if (d < 2) {
            en.hp -= e.dmg;
            en.flashTimer = 0.15;
            en.stunTimer = 0.2;
          }
        }
      }
    }

    // Обработка onExpire
    if (e.life <= 0 && e.onExpire) e.onExpire();

    if (e.type === 'seed' && !e.hit) {
      e.mesh.position.x += e.dir.x * e.speed * dt;
      e.mesh.position.z += e.dir.z * e.speed * dt;

      const terrainY = getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
      e.mesh.position.y = Math.max(terrainY + 0.5, e.mesh.position.y);

      for (let j = 0; j < enemies.length; j++) {
        const en = enemies[j];
        if (!en || !en.alive) continue;
        const dist = Math.sqrt((e.mesh.position.x - en.x) ** 2 + (e.mesh.position.z - en.z) ** 2);
        if (dist < 1.5) {
          damageEnemy(en, e.dmg);
          spawnParticles(new THREE.Vector3(en.x, en.y + 1, en.z), 0x1a1a1a, 10, 5);
          e.hit = true;
          e.life = 0;
          break;
        }
      }

      const bo3 = bossState.bossObj;
      if (!e.hit && bo3 && bo3.alive) {
        const dist = Math.sqrt((e.mesh.position.x - bo3.x) ** 2 + (e.mesh.position.z - bo3.z) ** 2);
        if (dist < 2.5) {
          bo3.hp -= e.dmg;
          spawnParticles(new THREE.Vector3(bo3.x, bo3.y + 3, bo3.z), 0x1a1a1a, 10, 5);
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

// ── Vine Whip: притягивает ближайших врагов к игроку ──
function executeVineWhip() {
  const pos = getPlayerPos();
  const range = 10;
  const dmg = ATTACK_DMG * 0.8 * getPlayerDmgMult();

  // Визуальный хлыст — зелёная линия
  const vineGeo = new THREE.CylinderGeometry(0.05, 0.08, range, 6);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, emissive: 0x2e7d32, emissiveIntensity: 0.3 });
  const vine = new THREE.Mesh(vineGeo, vineMat);
  const dir = getPlayerForward();
  vine.position.set(pos.x + dir.x * range / 2, pos.y + 1, pos.z + dir.z * range / 2);
  vine.rotation.z = Math.PI / 2;
  vine.rotation.y = -Math.atan2(dir.z, dir.x);
  scene.add(vine);
  activeEntities.push({ mesh: vine, type: 'vine_whip', life: 0.4 });

  spawnParticles(pos.clone().setY(pos.y + 1), 0x4caf50, 10, 4);

  // Притягиваем врагов
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.sqrt((pos.x - e.x) ** 2 + (pos.z - e.z) ** 2);
    if (d < range && d > 1) {
      const pullX = (pos.x - e.x) / d * 8;
      const pullZ = (pos.z - e.z) / d * 8;
      e.vel.x += pullX;
      e.vel.z += pullZ;
      e.vel.y = 3;
      e.hp -= dmg;
      e.stunTimer = 0.5;
      e.flashTimer = 0.15;
      spawnParticles(new THREE.Vector3(e.x, e.y + 1, e.z), 0x4caf50, 5, 3);
    }
  }
}

// ── Melon Shield: временная неуязвимость на 3 секунды ──
function executeMelonShield() {
  player.invuln = 3.0;

  // Визуальная сфера-щит вокруг игрока
  const shieldGeo = new THREE.SphereGeometry(2, 16, 12);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x4caf50, transparent: true, opacity: 0.25,
    emissive: 0x4caf50, emissiveIntensity: 0.5, side: THREE.DoubleSide
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.copy(player.pos);
  shield.position.y += 1;
  scene.add(shield);
  activeEntities.push({ mesh: shield, type: 'melon_shield', life: 3.0, followPlayer: true });

  spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0x4caf50, 20, 6);
}

// ── Seed Rain: дождь семечек сверху по площади ──
function executeSeedRain() {
  const pos = getPlayerPos();
  const dir = getPlayerForward();
  const center = pos.clone().add(dir.clone().multiplyScalar(8));
  const dmg = ATTACK_DMG * 0.6 * getPlayerDmgMult();
  const radius = 6;

  spawnParticles(new THREE.Vector3(center.x, center.y + 10, center.z), 0xfdd835, 15, 3);

  // Спавним 12 падающих семечек
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const sx = center.x + Math.cos(angle) * r;
    const sz = center.z + Math.sin(angle) * r;
    const seedGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const seedMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x333300 });
    const seedMesh = new THREE.Mesh(seedGeo, seedMat);
    seedMesh.position.set(sx, pos.y + 12 + Math.random() * 4, sz);
    scene.add(seedMesh);
    activeEntities.push({
      mesh: seedMesh, type: 'rain_seed', life: 2.0,
      vy: -15 - Math.random() * 5, dmg, hit: false,
      targetY: getTerrainHeight(sx, sz) + 0.3
    });
  }
}

// ── Rind Armor: временный буст защиты на 8 секунд ──
function executeRindArmor() {
  player.blockDmgReduction = 0.85; // 85% вместо 60%
  spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0x388e3c, 15, 5);

  // Визуальная корка вокруг
  const rindGeo = new THREE.SphereGeometry(1.2, 12, 8);
  const rindMat = new THREE.MeshStandardMaterial({
    color: 0x1b5e20, transparent: true, opacity: 0.3,
    emissive: 0x2e7d32, emissiveIntensity: 0.3, side: THREE.DoubleSide
  });
  const rind = new THREE.Mesh(rindGeo, rindMat);
  rind.position.copy(player.pos);
  rind.position.y += 1;
  scene.add(rind);
  activeEntities.push({
    mesh: rind, type: 'rind_armor', life: 8.0, followPlayer: true,
    onExpire: () => { player.blockDmgReduction = 0.6; }
  });
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
      case 'vine':
        executeVineWhip();
        break;
      case 'shield':
        executeMelonShield();
        break;
      case 'rain':
        executeSeedRain();
        break;
      case 'rind':
        executeRindArmor();
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
