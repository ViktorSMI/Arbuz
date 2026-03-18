import * as THREE from 'three';
import { ENEMY_COUNT, GRAVITY, WORLD_SIZE } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';

const ENEMY_TYPES = [
  { name: 'Жук-солдат', color: 0x5d4037, hp: 60, dmg: 15, speed: 3, r: 0.7, score: 10, xp: 20 },
  { name: 'Муравей', color: 0x3e2723, hp: 30, dmg: 10, speed: 5, r: 0.5, score: 5, xp: 10 },
  { name: 'Оса', color: 0xfdd835, hp: 40, dmg: 18, speed: 4, r: 0.6, score: 8, xp: 15 },
  { name: 'Таракан', color: 0x4e342e, hp: 45, dmg: 12, speed: 6, r: 0.6, score: 7, xp: 12 },
  { name: 'Богомол', color: 0x2e7d32, hp: 120, dmg: 25, speed: 3, r: 0.9, score: 25, xp: 40 },
  { name: 'Кот', color: 0xff8a65, hp: 100, dmg: 20, speed: 4.5, r: 0.8, score: 20, xp: 35 },
  { name: 'Дворник', color: 0x607d8b, hp: 80, dmg: 18, speed: 3, r: 0.8, score: 15, xp: 25 },
  { name: 'Крыса-мутант', color: 0xab47bc, hp: 70, dmg: 22, speed: 5, r: 0.6, score: 18, xp: 30 },
];

export const enemies = [];

function createEnemyMesh(type) {
  const group = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(type.r, 10, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = type.r;
  body.castShadow = true;
  group.add(body);
  group.userData.body = body;

  const eyeGeo = new THREE.SphereGeometry(type.r * 0.15, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744 });
  const eL = new THREE.Mesh(eyeGeo, eyeMat);
  eL.position.set(-type.r * 0.3, type.r * 1.2, type.r * 0.7);
  group.add(eL);
  const eR = new THREE.Mesh(eyeGeo, eyeMat);
  eR.position.set(type.r * 0.3, type.r * 1.2, type.r * 0.7);
  group.add(eR);

  const legGeo2 = new THREE.CylinderGeometry(type.r * 0.12, type.r * 0.15, type.r * 0.6, 5);
  const legMat2 = new THREE.MeshStandardMaterial({ color: type.color });
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(legGeo2, legMat2);
    leg.position.set(s * type.r * 0.5, type.r * 0.2, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  const sh = new THREE.Mesh(
    new THREE.CircleGeometry(type.r * 0.8, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05;
  group.add(sh);

  return group;
}

export function spawnEnemies() {
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const dc = Math.sqrt(x * x + z * z);
    if (dc < 20) { i--; continue; }
    const y = getTerrainHeight(x, z);
    const mesh = createEnemyMesh(type);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    enemies.push({
      type, mesh, x, z, y,
      hp: type.hp, maxHp: type.hp,
      alive: true,
      state: 'patrol',
      stateTimer: Math.random() * 3,
      facing: Math.random() * Math.PI * 2,
      vel: new THREE.Vector3(),
      patrolX: x, patrolZ: z,
      atkCd: 0, aggroRange: 18,
      stunTimer: 0, flashTimer: 0,
    });
  }
}

export function clearEnemies() {
  for (const e of enemies) {
    if (e.mesh) scene.remove(e.mesh);
  }
  enemies.length = 0;
}

export function updateEnemyAI(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.flashTimer = Math.max(0, e.flashTimer - dt);
    e.stunTimer = Math.max(0, e.stunTimer - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);

    const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    e.vel.y -= GRAVITY * dt;
    e.x += e.vel.x * dt; e.z += e.vel.z * dt; e.y += e.vel.y * dt;
    const eth = getTerrainHeight(e.x, e.z);
    if (e.y < eth) { e.y = eth; e.vel.y = 0; }
    e.vel.x *= 0.92; e.vel.z *= 0.92;

    if (e.stunTimer > 0) continue;

    if (dist < e.aggroRange) e.state = 'chase';
    else if (dist > e.aggroRange * 1.5) e.state = 'patrol';

    if (e.state === 'chase') {
      const nx = dx / dist, nz = dz / dist;
      e.x += nx * e.type.speed * dt;
      e.z += nz * e.type.speed * dt;
      e.facing = Math.atan2(nx, nz);

      if (dist < e.type.r + 1.5 && e.atkCd <= 0) {
        if (player.invuln <= 0) {
          player.hp -= e.type.dmg;
          player.dmgFlash = 0.2;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 6, 4);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
        e.atkCd = 1.2;
      }
    } else {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.facing += ((Math.random() - 0.5) * 2);
        e.stateTimer = 1 + Math.random() * 3;
      }
      e.x += Math.sin(e.facing) * e.type.speed * 0.3 * dt;
      e.z += Math.cos(e.facing) * e.type.speed * 0.3 * dt;
    }

    e.y = getTerrainHeight(e.x, e.z);
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.rotation.y = e.facing;

    if (e.flashTimer > 0) {
      e.mesh.userData.body.material.emissive.set(0xff0000);
      e.mesh.userData.body.material.emissiveIntensity = e.flashTimer * 5;
    } else {
      e.mesh.userData.body.material.emissiveIntensity = 0;
    }
  }
}
