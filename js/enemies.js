import * as THREE from 'three';
import { ENEMY_COUNT, GRAVITY, WORLD_SIZE, WATER_LEVEL } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { sfxHit, sfxEnemyAttack } from './music.js';

let audioCtx = null;
let sfxGain = null;

function initSfx() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.12;
  sfxGain.connect(audioCtx.destination);
}

function playStepSound(dist, speed) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  const vol = Math.max(0, 1 - dist / 40) * 0.3;
  if (vol < 0.01) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 80 + Math.random() * 40 + speed * 10;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}

function playFlySound(dist) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  const vol = Math.max(0, 1 - dist / 50) * 0.15;
  if (vol < 0.01) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 150 + Math.random() * 80;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}

const ENEMY_TYPES = [
  { name: 'Жук-солдат', color: 0x5d4037, hp: 60, dmg: 15, speed: 3, r: 0.7, score: 10, xp: 20, flying: false },
  { name: 'Муравей', color: 0x3e2723, hp: 30, dmg: 10, speed: 5, r: 0.5, score: 5, xp: 10, flying: false },
  { name: 'Оса', color: 0xfdd835, hp: 40, dmg: 18, speed: 4, r: 0.6, score: 8, xp: 15, flying: true },
  { name: 'Таракан', color: 0x4e342e, hp: 45, dmg: 12, speed: 6, r: 0.6, score: 7, xp: 12, flying: false },
  { name: 'Богомол', color: 0x2e7d32, hp: 120, dmg: 25, speed: 3, r: 0.9, score: 25, xp: 40, flying: false },
  { name: 'Кот', color: 0xff8a65, hp: 100, dmg: 20, speed: 4.5, r: 0.8, score: 20, xp: 35, flying: false },
  { name: 'Дворник', color: 0x607d8b, hp: 80, dmg: 18, speed: 3, r: 0.8, score: 15, xp: 25, flying: false },
  { name: 'Крыса-мутант', color: 0xab47bc, hp: 70, dmg: 22, speed: 5, r: 0.6, score: 18, xp: 30, flying: false },
  { name: 'Голубь-бомбер', color: 0x90a4ae, hp: 35, dmg: 14, speed: 5.5, r: 0.55, score: 12, xp: 18, flying: true },
  { name: 'Светлячок', color: 0x76ff03, hp: 25, dmg: 20, speed: 6, r: 0.4, score: 15, xp: 22, flying: true },
];

export const enemies = [];

function createEnemyMesh(type) {
  const group = new THREE.Group();
  const r = type.r;
  const darkerColor = new THREE.Color(type.color).multiplyScalar(0.7).getHex();

  const bodyGeo = new THREE.SphereGeometry(r, 12, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = r;
  body.castShadow = true;
  group.add(body);
  group.userData.body = body;

  const whiteEyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eyeR2 = r * 0.2;
  const pupilR = r * 0.1;
  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR2, 8, 8), whiteEyeMat);
    eye.position.set(s * r * 0.35, r * 1.25, r * 0.75);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(pupilR, 6, 6), pupilMat);
    pupil.position.set(s * r * 0.35, r * 1.25, r * 0.75 + eyeR2 * 0.6);
    group.add(pupil);
  }

  const armGeo = new THREE.CylinderGeometry(r * 0.08, r * 0.06, r * 0.7, 5);
  const armMat = new THREE.MeshStandardMaterial({ color: darkerColor });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-r * 0.85, r * 0.9, 0);
  armL.rotation.z = 0.5;
  armL.castShadow = true;
  group.add(armL);
  group.userData.armL = armL;

  const armR2 = new THREE.Mesh(armGeo, armMat);
  armR2.position.set(r * 0.85, r * 0.9, 0);
  armR2.rotation.z = -0.5;
  armR2.castShadow = true;
  group.add(armR2);
  group.userData.armR = armR2;

  const legGeo = new THREE.CylinderGeometry(r * 0.1, r * 0.12, r * 0.5, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: darkerColor });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-r * 0.4, r * 0.15, 0);
  legL.castShadow = true;
  group.add(legL);
  group.userData.legL = legL;

  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(r * 0.4, r * 0.15, 0);
  legR.castShadow = true;
  group.add(legR);
  group.userData.legR = legR;

  if (type.flying) {
    const wingGeo = new THREE.PlaneGeometry(r * 1.2, r * 0.6);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-r * 0.9, r * 1.6, -r * 0.2);
    wingL.rotation.z = -0.3;
    group.add(wingL);
    group.userData.wingL = wingL;

    const wingR2 = new THREE.Mesh(wingGeo, wingMat);
    wingR2.position.set(r * 0.9, r * 1.6, -r * 0.2);
    wingR2.rotation.z = 0.3;
    group.add(wingR2);
    group.userData.wingR = wingR2;
  }

  const sh = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.8, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05;
  group.add(sh);
  group.userData.shadow = sh;

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
    if (!type.flying && y < WATER_LEVEL + 0.5) { i--; continue; }
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
      atkAnim: 0, atkLunge: 0,
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
  initSfx();
  for (const e of enemies) {
    if (e.dying) {
      e.deathTimer -= dt;
      const t = e.deathTimer / 0.5;
      e.mesh.rotation.x += dt * 12;
      e.mesh.position.y += dt * 3;
      e.mesh.scale.setScalar(Math.max(0, t));
      if (e.deathTimer <= 0) {
        e.dying = false;
        e.mesh.visible = false;
      }
      continue;
    }
    if (!e.alive) continue;
    e.flashTimer = Math.max(0, e.flashTimer - dt);
    e.stunTimer = Math.max(0, e.stunTimer - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    if (e.stepTimer === undefined) e.stepTimer = Math.random() * 0.5;
    if (e.animT === undefined) e.animT = Math.random() * 6.28;

    const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const isFlying = !!e.type.flying;

    if (!isFlying) {
      e.vel.y -= GRAVITY * dt;
      e.x += e.vel.x * dt; e.z += e.vel.z * dt; e.y += e.vel.y * dt;
      const eth = getTerrainHeight(e.x, e.z);
      if (e.y < eth) { e.y = eth; e.vel.y = 0; }
      e.vel.x *= 0.92; e.vel.z *= 0.92;
    } else {
      e.x += e.vel.x * dt; e.z += e.vel.z * dt;
      e.vel.x *= 0.92; e.vel.z *= 0.92;
    }

    if (e.stunTimer > 0) continue;

    if (dist < e.aggroRange) e.state = 'chase';
    else if (dist > e.aggroRange * 1.5) e.state = 'patrol';

    let moving = false;

    if (e.state === 'chase') {
      const nx = dx / dist, nz = dz / dist;
      const nextX = e.x + nx * e.type.speed * dt;
      const nextZ = e.z + nz * e.type.speed * dt;
      if (!isFlying && getTerrainHeight(nextX, nextZ) < WATER_LEVEL) {
        e.state = 'patrol';
        e.stateTimer = 1 + Math.random() * 2;
        e.facing += Math.PI * (0.5 + Math.random());
      } else {
        e.x = nextX;
        e.z = nextZ;
      }
      e.facing = Math.atan2(nx, nz);
      moving = true;

      if (dist < e.type.r + 1.5 && e.atkCd <= 0) {
        e.atkAnim = 0.35;
        const lungeX = (dx / dist) * 2;
        const lungeZ = (dz / dist) * 2;
        e.vel.x += lungeX;
        e.vel.z += lungeZ;
        sfxEnemyAttack();
        if (player.invuln <= 0) {
          sfxHit();
          player.hp -= e.type.dmg;
          player.dmgFlash = 0.2;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 6, 4);
          spawnParticles(new THREE.Vector3(e.x, e.y + e.type.r, e.z), e.type.color, 4, 3);
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
      const pnx = e.x + Math.sin(e.facing) * e.type.speed * 0.3 * dt;
      const pnz = e.z + Math.cos(e.facing) * e.type.speed * 0.3 * dt;
      if (!isFlying && getTerrainHeight(pnx, pnz) < WATER_LEVEL) {
        e.facing += Math.PI * (0.5 + Math.random());
        e.stateTimer = 0.5;
      } else {
        e.x = pnx;
        e.z = pnz;
      }
      moving = true;
    }

    const eth2 = getTerrainHeight(e.x, e.z);
    if (isFlying) {
      const hoverH = eth2 + 3 + Math.sin(e.animT * 1.5) * 0.5;
      e.y += (hoverH - e.y) * 2 * dt;
    } else {
      e.y = eth2;
    }

    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.rotation.y = e.facing;

    e.animT += dt * (e.state === 'chase' ? e.type.speed * 1.5 : e.type.speed * 0.6);
    if (e.atkAnim > 0) e.atkAnim = Math.max(0, e.atkAnim - dt);
    const ud = e.mesh.userData;
    const atkT = e.atkAnim / 0.35;
    if (e.atkAnim > 0) {
      const phase = (1 - atkT) * Math.PI;
      const swing = Math.sin(phase) * 1.6;
      if (ud.armL) { ud.armL.rotation.x = -swing; ud.armL.rotation.z = 0.5 + swing * 0.3; }
      if (ud.armR) { ud.armR.rotation.x = -swing; ud.armR.rotation.z = -0.5 - swing * 0.3; }
      if (ud.body) {
        const squash = Math.sin(phase) * 0.12;
        ud.body.scale.set(1 + squash, 1 - squash * 0.5, 1);
        ud.body.position.y = e.type.r + Math.sin(phase) * e.type.r * 0.3;
      }
      if (!isFlying) {
        if (ud.legL) ud.legL.rotation.x = Math.sin(phase) * 0.3;
        if (ud.legR) ud.legR.rotation.x = -Math.sin(phase) * 0.3;
      }
    } else {
      if (ud.body) { ud.body.scale.set(1, 1, 1); ud.body.position.y = e.type.r; }
      if (!isFlying) {
        const legSwing = Math.sin(e.animT * 4) * 0.4;
        if (ud.legL) ud.legL.rotation.x = legSwing;
        if (ud.legR) ud.legR.rotation.x = -legSwing;
        const armSwing = Math.sin(e.animT * 4) * 0.3;
        if (ud.armL) { ud.armL.rotation.x = -armSwing; ud.armL.rotation.z = 0.5; }
        if (ud.armR) { ud.armR.rotation.x = armSwing; ud.armR.rotation.z = -0.5; }
      } else {
        const wingFlap = Math.sin(e.animT * 12) * 0.6;
        if (ud.wingL) ud.wingL.rotation.z = -0.3 + wingFlap;
        if (ud.wingR) ud.wingR.rotation.z = 0.3 - wingFlap;
        if (ud.legL) ud.legL.rotation.x = 0.3;
        if (ud.legR) ud.legR.rotation.x = 0.3;
        if (ud.armL) ud.armL.rotation.z = 0.5;
        if (ud.armR) ud.armR.rotation.z = -0.5;
      }
    }
    if (ud.shadow) ud.shadow.position.y = eth2 - e.y + 0.05;

    if (moving) {
      e.stepTimer -= dt;
      if (e.stepTimer <= 0) {
        if (isFlying) {
          playFlySound(dist);
          e.stepTimer = 0.15;
        } else {
          playStepSound(dist, e.type.speed);
          e.stepTimer = 0.35 / Math.max(e.type.speed * 0.2, 1);
        }
      }
    }

    if (e.flashTimer > 0) {
      ud.body.material.emissive.set(0xff0000);
      ud.body.material.emissiveIntensity = e.flashTimer * 5;
    } else {
      ud.body.material.emissiveIntensity = 0;
    }
  }
}
