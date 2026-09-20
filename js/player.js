import * as THREE from 'three';
import { PLAYER_HP, PLAYER_SPEED, STAMINA_MAX, CAM_DIST } from './constants.js';
import { scene } from './scene.js';
import { createHero } from './art/characters.js';

export const createWatermelon = createHero;

export const playerMesh = createWatermelon();
scene.add(playerMesh);

export const player = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  hp: PLAYER_HP, maxHp: PLAYER_HP,
  stamina: STAMINA_MAX, maxStamina: STAMINA_MAX,
  staminaDelay: 0,
  grounded: false,
  yaw: 0,
  dodging: false, dodgeTimer: 0, dodgeDir: new THREE.Vector3(),
  dodgeCd: 0,
  dodgeRollAngle: 0,
  invuln: 0,
  attacking: false, attackTimer: 0, attackCd: 0,
  comboCount: 0, comboTimer: 0,
  alive: true,
  speed: PLAYER_SPEED,
  dmgFlash: 0,
  animTime: 0,
  xp: 0, level: 1, xpToNext: 50,
  kills: 0,
  seeds: 0,
  upgrades: { hp: 0, damage: 0, stamina: 0, speed: 0 },
  blocking: false,
  parrying: false,
  parryTimer: 0,
  parrySuccess: false,
  blockDmgReduction: 0.6,
  equipment: { sword: 'basic', armor: 'none' },
  inventory: [],
  reputation: 0,
  foundLore: [],
  ngPlus: 0,
};

export const camState = {
  yaw: Math.PI,
  pitch: 0.3,
  dist: CAM_DIST,
};
