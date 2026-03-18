import * as THREE from 'three';
import { BOSS_ARENA_POS, BOSS_ARENA_R, ATTACK_RANGE } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { sfxBossSlam, sfxBossCharge, sfxBossSwipe, sfxBossHit, sfxHit, sfxBossDefeat } from './music.js';
import { BOSS_AIS } from './boss-ai.js';
import { startBossDeathSequence, isCinematicActive } from './boss-death.js';
import { triggerScreenShake } from './postprocessing.js';

export const bossState = {
  bossObj: null,
  bossActive: false,
  bossDefeated: false,
  currentBossIndex: 0,
};

const arenaPillars = [];
let arenaFloor = null;

function createHruschMesh() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(2.5, 16, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 3; body.castShadow = true;
  g.add(body); g.userData.body = body;
  const hornGeo = new THREE.ConeGeometry(0.3, 2, 6);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, metalness: 0.4 });
  const horn = new THREE.Mesh(hornGeo, hornMat);
  horn.position.set(0, 5.5, 1.5); horn.rotation.x = -0.4; horn.castShadow = true;
  g.add(horn);
  for (let s = -1; s <= 1; s += 2) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.2, 4), hornMat);
    m.position.set(s * 0.8, 3.5, 2.2); m.rotation.x = -0.8; m.rotation.z = s * 0.3;
    g.add(m);
  }
  const eyeGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.8 });
  g.add(new THREE.Mesh(eyeGeo, eyeMat).translateX(-0.8).translateY(4).translateZ(2));
  g.add(new THREE.Mesh(eyeGeo, eyeMat).translateX(0.8).translateY(4).translateZ(2));
  const legGeo = new THREE.CylinderGeometry(0.15, 0.12, 2, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
  for (let i = 0; i < 3; i++) for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(s * 2.2, 1, (i - 1) * 1.2); leg.rotation.z = s * 0.6; leg.castShadow = true;
    g.add(leg);
  }
  const plate = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6, metalness: 0.2 })
  );
  plate.position.y = 3; plate.castShadow = true;
  g.add(plate);
  return g;
}

function createSharlottaMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 12), bodyMat);
  body.position.y = 3; body.castShadow = true;
  g.add(body); g.userData.body = body;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), bodyMat);
  head.position.set(0, 5.2, 1.5); head.castShadow = true;
  g.add(head);
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xffccbc });
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), snoutMat);
  snout.position.set(0, 5, 2.8);
  g.add(snout);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.6 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), eyeMat).translateX(-0.6).translateY(5.5).translateZ(2.2));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), eyeMat).translateX(0.6).translateY(5.5).translateZ(2.2));
  for (let s = -1; s <= 1; s += 2) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 6), bodyMat);
    ear.position.set(s * 0.8, 6.2, 1); ear.rotation.z = s * 0.3;
    g.add(ear);
  }
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, metalness: 0.7, roughness: 0.3 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.6, 8), crownMat);
  crown.position.set(0, 6.5, 1.2);
  g.add(crown);
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), crownMat);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.7, 7, 1.2 + Math.sin(a) * 0.7);
    g.add(spike);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 4, 6), tailMat);
  tail.position.set(0, 2.5, -2.5); tail.rotation.x = 0.8;
  g.add(tail);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x757575 });
  for (let s = -1; s <= 1; s += 2) for (let f = -1; f <= 1; f += 2) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 2, 6), legMat);
    leg.position.set(s * 1.8, 1, f * 1.2); leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

function createKarlushaMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10), bodyMat);
  body.position.y = 3.5; body.castShadow = true;
  g.add(body); g.userData.body = body;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), bodyMat);
  head.position.set(0, 5.5, 1.5);
  g.add(head);
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8f00 });
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 4), beakMat);
  beak.position.set(0, 5.3, 2.5); beak.rotation.x = -Math.PI / 2;
  g.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.8 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), eyeMat).translateX(-0.5).translateY(5.8).translateZ(2));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), eyeMat).translateX(0.5).translateY(5.8).translateZ(2));
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x616161, metalness: 0.6, roughness: 0.4 });
  const chest = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), armorMat);
  chest.position.y = 3.5;
  g.add(chest);
  for (let s = -1; s <= 1; s += 2) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), bodyMat);
    wing.position.set(s * 3, 4, -0.5); wing.rotation.y = s * 0.3;
    g.add(wing);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: 0xff8f00 });
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 2.5, 6), legMat);
    leg.position.set(s * 0.8, 1, 0); leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

function createWormMesh() {
  const g = new THREE.Group();
  const segMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.8 });
  const headSeg = new THREE.Mesh(new THREE.SphereGeometry(2.5, 14, 10), segMat);
  headSeg.position.y = 5; headSeg.castShadow = true;
  g.add(headSeg); g.userData.body = headSeg;
  for (let i = 1; i < 6; i++) {
    const r = 2.5 - i * 0.2;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshStandardMaterial({
      color: new THREE.Color().lerpColors(new THREE.Color(0x558b2f), new THREE.Color(0x4e342e), i / 6),
      roughness: 0.8
    }));
    seg.position.set(0, 5 - i * 1.5, -i * 1.5); seg.castShadow = true;
    g.add(seg);
  }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 1 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), eyeMat).translateX(-1).translateY(6).translateZ(1.5));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), eyeMat).translateX(1).translateY(6).translateZ(1.5));
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc62828 });
  const mouth = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.5, 16), mouthMat);
  mouth.position.set(0, 4.5, 2.4); mouth.rotation.x = -0.3;
  g.add(mouth);
  return g;
}

function createNozhovMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.3, roughness: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 1.5), bodyMat);
  torso.position.y = 4; torso.castShadow = true;
  g.add(torso); g.userData.body = torso;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffccbc });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), headMat);
  head.position.y = 6;
  g.add(head);
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.5 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetMat);
  helmet.position.y = 6;
  g.add(helmet);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.5 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), eyeMat).translateX(-0.3).translateY(6.1).translateZ(0.7));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), eyeMat).translateX(0.3).translateY(6.1).translateZ(0.7));
  const armMat = new THREE.MeshStandardMaterial({ color: 0x546e7a });
  for (let s = -1; s <= 1; s += 2) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 6), armMat);
    arm.position.set(s * 1.7, 3.5, 0); arm.rotation.z = s * 0.2;
    g.add(arm);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 2.5, 6), legMat);
    leg.position.set(s * 0.6, 1.2, 0); leg.castShadow = true;
    g.add(leg);
  }
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, metalness: 0.8, roughness: 0.2 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 0.5), bladeMat);
  blade.position.set(2, 4.5, 0.5);
  g.add(blade);
  const hiltMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), hiltMat);
  hilt.position.set(2, 2.6, 0.5);
  g.add(hilt);
  return g;
}

function createDuvalMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 1.8), bodyMat);
  torso.position.y = 4.5; torso.castShadow = true;
  g.add(torso); g.userData.body = torso;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffccbc });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), headMat);
  head.position.y = 6.8;
  g.add(head);
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 12), hatMat);
  hatBase.position.y = 7.5;
  g.add(hatBase);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.5, 12), hatMat);
  hatTop.position.y = 8.4;
  g.add(hatTop);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xc62828, emissive: 0xc62828, emissiveIntensity: 0.4 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), eyeMat).translateX(-0.35).translateY(7).translateZ(0.75));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), eyeMat).translateX(0.35).translateY(7).translateZ(0.75));
  const mustacheMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  for (let s = -1; s <= 1; s += 2) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.5, 4), mustacheMat);
    m.position.set(s * 0.3, 6.6, 0.8); m.rotation.z = s * 1.2;
    g.add(m);
  }
  const armMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
  for (let s = -1; s <= 1; s += 2) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 6), armMat);
    arm.position.set(s * 1.7, 4, 0); arm.rotation.z = s * 0.2;
    g.add(arm);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 2.5, 6), legMat);
    leg.position.set(s * 0.6, 1.2, 0); leg.castShadow = true;
    g.add(leg);
  }
  const knifeMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, metalness: 0.9, roughness: 0.1 });
  const knife = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.3), knifeMat);
  knife.position.set(2.2, 4.5, 0.5);
  g.add(knife);
  return g;
}

const BOSS_DEFS = [
  { name: 'ХРУЩ', emoji: '🪲', create: createHruschMesh, hp: 500, xpReward: 200, color: 0xc62828 },
  { name: 'ШАРЛОТТА', emoji: '🐀', create: createSharlottaMesh, hp: 700, xpReward: 350, color: 0x9e9e9e },
  { name: 'КАРЛУША', emoji: '🐦‍⬛', create: createKarlushaMesh, hp: 900, xpReward: 500, color: 0x212121 },
  { name: 'МУСОРНЫЙ ЧЕРВЬ', emoji: '🪱', create: createWormMesh, hp: 1200, xpReward: 700, color: 0x558b2f },
  { name: 'ПОЛКОВНИК НОЖОВ', emoji: '🗡️', create: createNozhovMesh, hp: 1500, xpReward: 900, color: 0x455a64 },
  { name: 'ЖАН-ПЬЕР ДЮВАЛЬ', emoji: '👨‍🍳', create: createDuvalMesh, hp: 2000, xpReward: 1500, color: 0xfafafa },
];

export function getBossDef(locationIndex) {
  const i = Math.min(locationIndex, BOSS_DEFS.length - 1);
  return BOSS_DEFS[i];
}

export function setupArena() {
  clearArena();
  const arenaY = getTerrainHeight(BOSS_ARENA_POS.x, BOSS_ARENA_POS.z);
  BOSS_ARENA_POS.y = arenaY;
  const def = getBossDef(bossState.currentBossIndex);
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
    arenaPillars.push(pillar);
  }
  arenaFloor = new THREE.Mesh(
    new THREE.RingGeometry(BOSS_ARENA_R - 1, BOSS_ARENA_R, 32),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  arenaFloor.rotation.x = -Math.PI / 2;
  arenaFloor.position.set(BOSS_ARENA_POS.x, arenaY + 0.1, BOSS_ARENA_POS.z);
  scene.add(arenaFloor);
}

function clearArena() {
  for (const p of arenaPillars) scene.remove(p);
  arenaPillars.length = 0;
  if (arenaFloor) { scene.remove(arenaFloor); arenaFloor = null; }
}

export function spawnBoss() {
  if (bossState.bossObj) return;
  const def = getBossDef(bossState.currentBossIndex);
  const arenaY = getTerrainHeight(BOSS_ARENA_POS.x, BOSS_ARENA_POS.z);
  BOSS_ARENA_POS.y = arenaY;
  const mesh = def.create();
  mesh.position.set(BOSS_ARENA_POS.x, arenaY, BOSS_ARENA_POS.z);
  scene.add(mesh);
  bossState.bossObj = {
    mesh, x: BOSS_ARENA_POS.x, z: BOSS_ARENA_POS.z, y: arenaY,
    hp: def.hp, maxHp: def.hp,
    alive: true, facing: 0,
    state: 'idle', stateTimer: 2,
    atkCd: 0, chargeDir: new THREE.Vector3(),
    charging: false, chargeTimer: 0,
    slamCd: 0, phase: 1,
    flashTimer: 0, stunTimer: 0,
    vel: new THREE.Vector3(),
    windupTimer: 0, nextAttack: '',
    xpReward: def.xpReward,
    slamJumping: false, slamJumpVel: 0, slamLanding: false, slamLandTimer: 0,
    spinAngle: 0, saltoAngle: 0,
    swipeSpinAngle: 0, swipeLunging: false, swipeLungeTimer: 0,
  };
  bossState.bossActive = true;
  // Инициализируем уникальный AI
  const ai = BOSS_AIS[Math.min(bossState.currentBossIndex, BOSS_AIS.length - 1)];
  if (ai && ai.init) ai.init(bossState.bossObj);
}

const telegraphChargeMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
const telegraphChargeGeo = new THREE.PlaneGeometry(2, 30);
const telegraphChargeMesh = new THREE.Mesh(telegraphChargeGeo, telegraphChargeMat);
telegraphChargeMesh.rotation.x = -Math.PI / 2;
telegraphChargeMesh.renderOrder = 999;
scene.add(telegraphChargeMesh);

const telegraphSlamMat = new THREE.MeshBasicMaterial({ color: 0xff6f00, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
const telegraphSlamGeo = new THREE.RingGeometry(0.5, 8, 24);
const telegraphSlamMesh = new THREE.Mesh(telegraphSlamGeo, telegraphSlamMat);
telegraphSlamMesh.rotation.x = -Math.PI / 2;
telegraphSlamMesh.renderOrder = 999;
scene.add(telegraphSlamMesh);

const telegraphSwipeMat = new THREE.MeshBasicMaterial({ color: 0xffab00, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
const telegraphSwipeGeo = new THREE.RingGeometry(2, 5, 16, 1, 0, Math.PI * 0.6);
const telegraphSwipeMesh = new THREE.Mesh(telegraphSwipeGeo, telegraphSwipeMat);
telegraphSwipeMesh.rotation.x = -Math.PI / 2;
telegraphSwipeMesh.renderOrder = 999;
scene.add(telegraphSwipeMesh);

setupArena();

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

  // Используем уникальный AI если доступен
  const ai = BOSS_AIS[Math.min(bossState.currentBossIndex, BOSS_AIS.length - 1)];
  if (ai && ai.update) {
    // Проверка выхода из арены
    const playerInArena = Math.sqrt((player.pos.x - BOSS_ARENA_POS.x) ** 2 + (player.pos.z - BOSS_ARENA_POS.z) ** 2) < BOSS_ARENA_R + 3;
    if (!playerInArena) {
      const toCenterX = BOSS_ARENA_POS.x - b.x, toCenterZ = BOSS_ARENA_POS.z - b.z;
      const toCenterD = Math.sqrt(toCenterX * toCenterX + toCenterZ * toCenterZ);
      if (toCenterD > 2) {
        b.x += (toCenterX / toCenterD) * 4 * dt;
        b.z += (toCenterZ / toCenterD) * 4 * dt;
      }
      b.hp = Math.min(b.maxHp, b.hp + 50 * dt);
      b.y = getTerrainHeight(b.x, b.z);
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y = b.facing;
      return;
    }
    // Фазовая проверка
    if (b.hp <= b.maxHp * 0.5 && b.phase === 1) {
      b.phase = 2;
      spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xff1744, 20, 8);
    }
    // Вызываем уникальный AI
    ai.update(dt, b, dist, dx, dz);
    // Обновляем позицию меша
    b.y = getTerrainHeight(b.x, b.z);
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.y = b.facing;
    // Визуальные эффекты урона
    if (b.flashTimer > 0) {
      b.mesh.userData.body.material.emissive.set(0xff0000);
      b.mesh.userData.body.material.emissiveIntensity = b.flashTimer * 5;
    } else {
      b.mesh.userData.body.material.emissiveIntensity = b.phase === 2 ? 0.2 : 0;
      if (b.phase === 2) b.mesh.userData.body.material.emissive.set(0xff1744);
    }
    return;
  }

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
      const cx = b.x + dir.x * 15, cz = b.z + dir.z * 15;
      let maxH = getTerrainHeight(b.x, b.z);
      for (let i = 1; i <= 5; i++) {
        const sx = b.x + dir.x * i * 6, sz = b.z + dir.z * i * 6;
        maxH = Math.max(maxH, getTerrainHeight(sx, sz));
      }
      telegraphChargeMesh.position.set(cx, maxH + 0.5, cz);
      telegraphChargeMesh.rotation.y = -Math.atan2(dir.z, dir.x) + Math.PI / 2;
      telegraphChargeMesh.rotation.x = -Math.PI / 2;
      b.mesh.position.y = b.y + Math.sin(b.windupTimer * 12) * 0.5;
    } else if (b.nextAttack === 'slam') {
      telegraphSlamMat.opacity = 0.2 + Math.sin(b.windupTimer * 15) * 0.15;
      telegraphSlamMesh.position.set(b.x, b.y + 0.5, b.z);
      const jumpProgress = 1 - b.windupTimer / (b.phase === 2 ? 0.6 : 0.8);
      b.mesh.position.y = b.y + jumpProgress * 14;
      // Приседание при подъёме, вытягивание наверху — без сальто
      b.mesh.scale.set(1 - jumpProgress * 0.15, 1 + jumpProgress * 0.3, 1 - jumpProgress * 0.15);
      // Лёгкий наклон назад при взлёте вместо полного вращения
      b.mesh.rotation.x = -jumpProgress * 0.4;
    } else if (b.nextAttack === 'swipe') {
      telegraphSwipeMat.opacity = 0.25 + Math.sin(b.windupTimer * 15) * 0.15;
      telegraphSwipeMesh.position.set(b.x, b.y + 0.5, b.z);
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
      b.spinAngle = 0;
      sfxBossCharge();
    } else if (b.nextAttack === 'slam') {
      b.slamJumping = false;
      b.slamLanding = true;
      b.slamLandTimer = 0.25;
      b.mesh.rotation.x = 0;
      b.mesh.scale.set(1, 1, 1);
    } else if (b.nextAttack === 'swipe') {
      sfxBossSwipe();
      spawnParticles(new THREE.Vector3(b.x + Math.sin(b.facing) * 3, b.y + 2, b.z + Math.cos(b.facing) * 3), 0xffab00, 8, 6);
      b.swipeLunging = true;
      b.swipeLungeTimer = 0.35;
      b.swipeSpinAngle = 0;
      const lungeDir = new THREE.Vector3(dx, 0, dz).normalize();
      b.vel.copy(lungeDir.multiplyScalar(15));
      b.vel.y = 4;
    }
    b.nextAttack = '';
  }
  else if (b.slamLanding) {
    b.slamLandTimer -= dt;
    const landProg = 1 - b.slamLandTimer / 0.25;
    b.mesh.position.y = b.y + (1 - landProg) * 14;
    b.mesh.scale.set(1 + landProg * 0.3, 1 - landProg * 0.2, 1 + landProg * 0.3);
    if (b.slamLandTimer <= 0) {
      b.slamLanding = false;
      b.mesh.position.y = b.y;
      b.mesh.scale.set(1, 1, 1);
      b.mesh.rotation.x = 0;
      b.slamCd = b.phase === 2 ? 2 : 3;
      sfxBossSlam();
      triggerScreenShake(0.8, 0.5);
      spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0x8d6e63, 25, 12);
      spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0xff6f00, 15, 8);
      spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0xfdd835, 10, 6);
      if (dist < 9 && player.invuln <= 0) {
        sfxHit();
        player.hp -= (b.phase === 2 ? 35 : 25);
        player.dmgFlash = 0.3;
        triggerScreenShake(0.3, 0.2);
        player.vel.y = 10;
        const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(8);
        player.vel.x = kd.x; player.vel.z = kd.z;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 10, 5);
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }
      b.stateTimer = 1.5;
      b.state = 'idle';
    }
  }
  else if (b.swipeLunging) {
    b.swipeLungeTimer -= dt;
    const lungeProgress = 1 - b.swipeLungeTimer / 0.35;
    // Наклон вперёд при выпаде + лёгкий поворот корпуса, без бешеного вращения
    b.mesh.rotation.x = Math.sin(lungeProgress * Math.PI) * 0.4;
    b.mesh.rotation.z = Math.sin(lungeProgress * Math.PI) * 0.25;
    b.mesh.position.y = b.y + 1.5 + Math.max(0, b.vel.y * b.swipeLungeTimer);
    spawnParticles(new THREE.Vector3(b.x, b.y + 2, b.z), 0xffab00, 2, 3);
    if (dist < 5 && player.invuln <= 0) {
      sfxHit();
      player.hp -= (b.phase === 2 ? 22 : 15);
      player.dmgFlash = 0.2;
      triggerScreenShake(0.3, 0.2);
      const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(8);
      player.vel.copy(kd); player.vel.y = 4;
      spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 8, 4);
      if (player.hp <= 0) {
        player.alive = false;
        document.getElementById('death-screen').style.display = 'flex';
        document.exitPointerLock();
      }
      b.swipeLunging = false;
    }
    if (b.swipeLungeTimer <= 0) {
      b.swipeLunging = false;
      b.mesh.rotation.z = 0;
      b.mesh.rotation.x = 0;
      b.atkCd = 1.0;
      b.state = 'idle';
      b.stateTimer = 0.8;
    }
  }
  else if (b.charging) {
    b.chargeTimer -= dt;
    b.x += b.chargeDir.x * 25 * dt;
    b.z += b.chargeDir.z * 25 * dt;
    // Наклон вперёд при чардже + тряска корпуса, БЕЗ полного вращения
    b.mesh.rotation.x = 0.5 + Math.sin(b.chargeTimer * 30) * 0.15;
    b.mesh.rotation.z = Math.sin(b.chargeTimer * 25) * 0.1;
    spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0x8d6e63, 3, 4);
    spawnParticles(new THREE.Vector3(b.x, b.y + 2, b.z), 0xff1744, 1, 3);
    if (dist < 4) {
      if (player.invuln <= 0) {
        sfxHit();
        player.hp -= (b.phase === 2 ? 35 : 25);
        player.dmgFlash = 0.3;
        triggerScreenShake(0.3, 0.2);
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
    if (b.chargeTimer <= 0) { b.charging = false; b.atkCd = 1.5; b.state = 'idle'; b.stateTimer = 1; b.mesh.rotation.x = 0; b.mesh.rotation.z = 0; }
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

  if (!b.animT) b.animT = 0;
  b.animT += dt;
  if (!b.slamLanding && !b.slamJumping && !b.swipeLunging && !b.charging) {
    const idleBob = Math.sin(b.animT * 2.5) * 0.15;
    const breathScale = 1 + Math.sin(b.animT * 3) * 0.02;
    b.mesh.position.y += idleBob;
    if (b.windupTimer <= 0 || b.nextAttack !== 'slam') {
      b.mesh.scale.set(breathScale, breathScale, breathScale);
    }
  }
  if (b.charging) {
    // Лёгкий подъём при чардже для эффекта массы
    b.mesh.position.y += 0.5;
  } else if (b.windupTimer > 0) {
    /* windup shake handled above */
  } else if (!b.swipeLunging && !b.slamLanding) {
    b.mesh.rotation.z *= 0.9;
  }

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
    // Проверяем AI onHit (например counter stance у Ножова)
    const ai = BOSS_AIS[Math.min(bossState.currentBossIndex, BOSS_AIS.length - 1)];
    if (ai && ai.onHit) {
      const blocked = ai.onHit(b, dmg);
      if (blocked) return; // AI заблокировал удар
    }
    b.hp -= dmg;
    b.flashTimer = 0.15;
    b.stunTimer = 0.2;
    sfxBossHit();
    const kd = new THREE.Vector3(b.x - player.pos.x, 0, b.z - player.pos.z).normalize();
    b.vel.copy(kd.multiplyScalar(3));
    spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xff1744, 8, 5);
    if (b.hp <= 0) {
      player.xp += b.xpReward;
      player.kills++;
      // Запуск кинематографической смерти босса
      startBossDeathSequence(b, () => {
        b.alive = false;
        b.mesh.visible = false;
        bossState.bossActive = false;
        bossState.bossDefeated = true;
        // Cleanup AI
        const ai = BOSS_AIS[Math.min(bossState.currentBossIndex, BOSS_AIS.length - 1)];
        if (ai && ai.cleanup) ai.cleanup(b);
      });
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
  clearArena();
}
