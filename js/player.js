import * as THREE from 'three';
import { PLAYER_HP, PLAYER_SPEED, STAMINA_MAX, CAM_DIST } from './constants.js';
import { scene } from './scene.js';

export function createWatermelon() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(0.8, 24, 18);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.position.y = 1.2;
  group.add(body);

  for (let i = 0; i < 6; i++) {
    const stripeGeo = new THREE.TorusGeometry(0.8, 0.04, 4, 24);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({ color: 0x1b5e20 }));
    stripe.rotation.y = i * Math.PI / 6;
    stripe.position.y = 1.2;
    group.add(stripe);
  }

  const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 2.1;
  group.add(stem);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.15, 0.15, 0.3, 0.05);
  leafShape.quadraticCurveTo(0.15, -0.05, 0, 0);
  const leafGeoP = new THREE.ExtrudeGeometry(leafShape, { depth: 0.02, bevelEnabled: false });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x4caf50, side: THREE.DoubleSide });
  const leaf = new THREE.Mesh(leafGeoP, leafMat2);
  leaf.position.set(0.05, 2.2, 0);
  leaf.rotation.z = 0.3;
  group.add(leaf);

  const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.25, 1.5, 0.65);
  group.add(eyeL);
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-0.25, 1.5, 0.76);
  group.add(pupilL);

  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.25, 1.5, 0.65);
  group.add(eyeR);
  const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
  pupilR.position.set(0.25, 1.5, 0.76);
  group.add(pupilR);

  const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.95, 1.1, 0);
  armL.rotation.z = 0.5;
  armL.castShadow = true;
  group.add(armL);
  group.userData.armL = armL;

  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.95, 1.1, 0);
  armR.rotation.z = -0.5;
  armR.castShadow = true;
  group.add(armR);
  group.userData.armR = armR;

  const gloveGeo = new THREE.SphereGeometry(0.13, 6, 6);
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
  const gloveL = new THREE.Mesh(gloveGeo, gloveMat);
  gloveL.position.set(-1.2, 0.85, 0);
  group.add(gloveL);
  const gloveR = new THREE.Mesh(gloveGeo, gloveMat);
  gloveR.position.set(1.2, 0.85, 0);
  group.add(gloveR);

  const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.3, 0.25, 0);
  legL.castShadow = true;
  group.add(legL);
  group.userData.legL = legL;

  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.3, 0.25, 0);
  legR.castShadow = true;
  group.add(legR);
  group.userData.legR = legR;

  const shoeGeo = new THREE.BoxGeometry(0.2, 0.12, 0.3);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
  shoeL.position.set(-0.3, 0, 0.05);
  group.add(shoeL);
  group.userData.shoeL = shoeL;
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
  shoeR.position.set(0.3, 0, 0.05);
  group.add(shoeR);
  group.userData.shoeR = shoeR;

  const swordGroup = new THREE.Group();
  const handleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  swordGroup.add(handle);

  const bladeGeo = new THREE.ConeGeometry(0.12, 1.2, 4);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.6 });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = 0.8;
  swordGroup.add(blade);

  const guardGeo = new THREE.BoxGeometry(0.35, 0.06, 0.08);
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, metalness: 0.5 });
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.y = 0.18;
  swordGroup.add(guard);

  swordGroup.position.set(1.25, 0.9, 0.3);
  swordGroup.rotation.z = -0.3;
  group.add(swordGroup);
  group.userData.sword = swordGroup;

  const shadowGeo = new THREE.CircleGeometry(0.6, 16);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
  const shadowBlob = new THREE.Mesh(shadowGeo, shadowMat);
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.05;
  group.add(shadowBlob);
  group.userData.shadow = shadowBlob;

  group.userData.body = body;
  return group;
}

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
