import { createCreature } from './art/characters.js';
import { animateCreature, releaseAnimator } from './art/animation.js';
import { disposeRig } from './art/geometry.js';
import { processIncomingDamage } from './combat.js';
import * as THREE from 'three';
import { ENEMY_COUNT, GRAVITY, WORLD_SIZE, WATER_LEVEL } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { sfxHit, sfxEnemyAttack } from './music.js';
import { triggerScreenShake } from './postprocessing.js';

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

const BIOME_ENEMIES = [
  ['Жук-солдат', 'Муравей', 'Светлячок'],
  ['Крыса-мутант', 'Таракан', 'Муравей'],
  ['Голубь-бомбер', 'Оса', 'Светлячок'],
  ['Таракан', 'Крыса-мутант', 'Богомол'],
  ['Дворник', 'Кот', 'Жук-солдат'],
  ['Кот', 'Дворник', 'Богомол', 'Оса'],
];

export function spawnEnemies(locationIndex = 0) {
  const biomeNames = BIOME_ENEMIES[Math.min(locationIndex, BIOME_ENEMIES.length - 1)] || BIOME_ENEMIES[0];
  const biomeTypes = ENEMY_TYPES.filter(t => biomeNames.includes(t.name));
  const pool = biomeTypes.length > 0 ? biomeTypes : ENEMY_TYPES;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const dc = Math.sqrt(x * x + z * z);
    if (dc < 20) { i--; continue; }
    const y = getTerrainHeight(x, z);
    if (!type.flying && y < WATER_LEVEL + 0.5) { i--; continue; }
    const ngMultiplier = Math.pow(1.5, player.ngPlus || 0);
    const scaledHp = Math.floor(type.hp * ngMultiplier);
    const mesh = createCreature(type);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    enemies.push({
      type, mesh, x, z, y,
      hp: scaledHp, maxHp: scaledHp,
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
    if (e.mesh) { releaseAnimator(e.mesh); disposeRig(e.mesh); }
  }
  enemies.length = 0;
}

export function updateEnemyAI(dt) {
  initSfx();
  for (const e of enemies) {
    if (e.dying) {
      e.deathTimer -= dt;
      const t = e.deathTimer / 0.5;
      animateCreature(e.mesh, dt, e);
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
    const dist = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
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

    if (e.stunTimer > 0) {
      e.windup = 0;
      e.mesh.position.set(e.x, e.y, e.z);
      animateCreature(e.mesh, dt, e);
      continue;
    }
    if (e.windup > 0) {
      e.windup = Math.max(0, e.windup - dt);
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.y = e.facing;
      if (e.windup === 0) {
        e.atkAnim = .3;
        sfxEnemyAttack();
        if (dist < e.type.r + 1.9 && player.invuln <= 0) {
          const damage = processIncomingDamage(e.type.dmg, e);
          player.hp = Math.max(0, player.hp - damage);
          if (damage > 0) {
            player.dmgFlash = .2; player.invuln = .18;
            sfxHit(); triggerScreenShake(.2, .15);
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc98765, 6, 3);
          }
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
      }
      animateCreature(e.mesh, dt, e);
      continue;
    }

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
        e.windup = .32;
        e.atkCd = 1.35;
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
    animateCreature(e.mesh, dt, e);

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


  }
}
