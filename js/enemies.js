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
  const baseColor = new THREE.Color(type.color);
  const darkerColor = baseColor.clone().multiplyScalar(0.7).getHex();
  const name = type.name;

  // --- Determine per-type flags ---
  const isInsect = ['Жук-солдат', 'Муравей', 'Таракан'].includes(name);
  const isWasp = name === 'Оса';
  const isMantis = name === 'Богомол';
  const isCat = name === 'Кот';
  const isJanitor = name === 'Дворник';
  const isRat = name === 'Крыса-мутант';
  const isPigeon = name === 'Голубь-бомбер';
  const isFirefly = name === 'Светлячок';
  const useFlatShading = isInsect || name === 'Жук-солдат' || isWasp;
  const scaleVariation = 0.92 + Math.random() * 0.16; // 0.92..1.08

  // --- Body with vertex colors ---
  const bodySegW = 16, bodySegH = 12;
  const bodyGeo = new THREE.SphereGeometry(r, bodySegW, bodySegH);
  const posAttr = bodyGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const bc = baseColor.clone();

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const normY = (y / r + 1) * 0.5; // 0 bottom, 1 top
    // Ambient occlusion: darker on bottom
    const aoFactor = 0.6 + normY * 0.4;
    let cr = bc.r * aoFactor, cg = bc.g * aoFactor, cb = bc.b * aoFactor;

    // Random spots for natural look
    const spotNoise = Math.sin(posAttr.getX(i) * 17.3 + posAttr.getZ(i) * 13.7) * 0.5 + 0.5;
    if (spotNoise > 0.75) {
      const spotIntensity = (spotNoise - 0.75) * 1.2;
      cr += spotIntensity * 0.08;
      cg += spotIntensity * 0.06;
      cb += spotIntensity * 0.04;
    }

    // Type-specific patterns
    if (isWasp) {
      // Black and yellow stripes
      const stripe = Math.sin(y / r * Math.PI * 5);
      if (stripe < -0.2) { cr = 0.08; cg = 0.08; cb = 0.05; }
    } else if (isRat) {
      // Dark patches
      const patch = Math.sin(posAttr.getX(i) * 7 + posAttr.getZ(i) * 11) *
                     Math.cos(posAttr.getY(i) * 5);
      if (patch > 0.4) { cr *= 0.5; cg *= 0.4; cb *= 0.5; }
    } else if (isFirefly) {
      // Bright glowing spots on back half
      const nz = posAttr.getZ(i) / r;
      if (nz < -0.2 && spotNoise > 0.6) {
        cr = Math.min(1, cr + 0.4);
        cg = Math.min(1, cg + 0.6);
        cb = Math.min(1, cb + 0.1);
      }
    }

    colors[i * 3] = Math.min(1, Math.max(0, cr));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, cg));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, cb));
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: useFlatShading ? 0.85 : 0.6,
    flatShading: useFlatShading,
    emissive: baseColor.clone().multiplyScalar(0.08),
    emissiveIntensity: isFirefly ? 0.6 : 0.15,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = r;
  body.scale.set(scaleVariation, 1, scaleVariation);
  body.castShadow = true;
  group.add(body);
  group.userData.body = body;

  // --- Belly (lighter half-sphere on front/bottom) ---
  const bellyGeo = new THREE.SphereGeometry(r * 0.75, 12, 8, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.5);
  const bellyColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.3);
  const bellyMat = new THREE.MeshStandardMaterial({
    color: bellyColor,
    roughness: 0.5,
    flatShading: useFlatShading,
  });
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, r * 0.85, r * 0.15);
  belly.rotation.x = -0.3;
  group.add(belly);

  // --- Antennae for insects ---
  if (isInsect || isWasp || isMantis) {
    const antMat = new THREE.MeshStandardMaterial({ color: darkerColor });
    for (let s = -1; s <= 1; s += 2) {
      const antBase = new THREE.CylinderGeometry(r * 0.025, r * 0.02, r * 0.5, 4);
      const ant = new THREE.Mesh(antBase, antMat);
      ant.position.set(s * r * 0.2, r * 1.6, r * 0.5);
      ant.rotation.z = s * -0.3;
      ant.rotation.x = -0.5;
      group.add(ant);
      // Antenna tip (small sphere)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.04, 5, 5), antMat);
      tip.position.set(s * r * 0.34, r * 1.85, r * 0.72);
      group.add(tip);
    }
  }

  // --- Mandibles / mouth ---
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
  if (isInsect || isWasp || isMantis) {
    for (let s = -1; s <= 1; s += 2) {
      const mandGeo = new THREE.ConeGeometry(r * 0.06, r * 0.2, 4);
      const mand = new THREE.Mesh(mandGeo, mouthMat);
      mand.position.set(s * r * 0.15, r * 0.75, r * 0.85);
      mand.rotation.x = -1.2;
      mand.rotation.z = s * 0.3;
      group.add(mand);
    }
  }

  // --- Cat-specific: ears, tail, nose ---
  if (isCat) {
    const earMat = new THREE.MeshStandardMaterial({ color: type.color, flatShading: false });
    const earInnerMat = new THREE.MeshStandardMaterial({ color: 0xffab91 });
    for (let s = -1; s <= 1; s += 2) {
      const earGeo = new THREE.ConeGeometry(r * 0.2, r * 0.35, 4);
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(s * r * 0.45, r * 1.65, r * 0.1);
      ear.rotation.z = s * 0.2;
      group.add(ear);
      // Inner ear (pink)
      const earInGeo = new THREE.ConeGeometry(r * 0.1, r * 0.2, 4);
      const earIn = new THREE.Mesh(earInGeo, earInnerMat);
      earIn.position.set(s * r * 0.45, r * 1.63, r * 0.15);
      earIn.rotation.z = s * 0.2;
      group.add(earIn);
    }
    // Nose
    const noseGeo = new THREE.SphereGeometry(r * 0.08, 6, 6);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, r * 0.95, r * 0.92);
    group.add(nose);
    // Tail (curved via multiple segments)
    const tailMat = new THREE.MeshStandardMaterial({ color: type.color });
    const tailSegs = 5;
    for (let i = 0; i < tailSegs; i++) {
      const t = i / tailSegs;
      const segGeo = new THREE.CylinderGeometry(r * 0.06 * (1 - t * 0.5), r * 0.06 * (1 - (t + 1 / tailSegs) * 0.5), r * 0.25, 5);
      const seg = new THREE.Mesh(segGeo, tailMat);
      const angle = t * 1.2;
      seg.position.set(0, r * (0.6 + Math.sin(angle) * t * 0.5), -r * (0.8 + t * 0.5));
      seg.rotation.x = 0.5 + t * 0.4;
      group.add(seg);
    }
    // Tail tip
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 5, 5), tailMat);
    tailTip.position.set(0, r * 1.0, -r * 1.4);
    group.add(tailTip);
  }

  // --- Janitor (Дворник): broom ---
  if (isJanitor) {
    const broomStickGeo = new THREE.CylinderGeometry(r * 0.04, r * 0.04, r * 1.8, 5);
    const broomStickMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
    const broomStick = new THREE.Mesh(broomStickGeo, broomStickMat);
    broomStick.position.set(r * 1.1, r * 1.1, 0);
    broomStick.rotation.z = -0.3;
    group.add(broomStick);
    // Broom head
    const broomHeadGeo = new THREE.CylinderGeometry(r * 0.25, r * 0.05, r * 0.4, 6);
    const broomHeadMat = new THREE.MeshStandardMaterial({ color: 0xa1887f });
    const broomHead = new THREE.Mesh(broomHeadGeo, broomHeadMat);
    broomHead.position.set(r * 1.35, r * 0.25, 0);
    group.add(broomHead);
    // Hat (flat cylinder on top)
    const hatGeo = new THREE.CylinderGeometry(r * 0.5, r * 0.55, r * 0.2, 8);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x37474f });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.set(0, r * 1.75, 0);
    group.add(hat);
    const brimGeo = new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 0.04, 10);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.set(0, r * 1.65, 0);
    group.add(brim);
  }

  // --- Rat (Крыса-мутант): tail, ears ---
  if (isRat) {
    // Tail (long thin)
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xe1bee7 });
    const tailSegs = 7;
    for (let i = 0; i < tailSegs; i++) {
      const t = i / tailSegs;
      const segGeo = new THREE.CylinderGeometry(r * 0.04 * (1 - t * 0.6), r * 0.04 * (1 - (t + 0.15) * 0.6), r * 0.3, 4);
      const seg = new THREE.Mesh(segGeo, tailMat);
      seg.position.set(Math.sin(t * 2) * r * 0.15, r * (0.3 + t * 0.1), -r * (0.7 + t * 0.4));
      seg.rotation.x = 0.3 + t * 0.15;
      group.add(seg);
    }
    // Round ears (pink)
    const earMat = new THREE.MeshStandardMaterial({ color: 0xf48fb1, side: THREE.DoubleSide });
    for (let s = -1; s <= 1; s += 2) {
      const earGeo = new THREE.CircleGeometry(r * 0.25, 10);
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(s * r * 0.5, r * 1.55, r * 0.05);
      ear.rotation.y = s * -0.4;
      group.add(ear);
    }
    // Whiskers
    const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    for (let s = -1; s <= 1; s += 2) {
      for (let w = 0; w < 2; w++) {
        const wGeo = new THREE.CylinderGeometry(0.008, 0.005, r * 0.5, 3);
        const wh = new THREE.Mesh(wGeo, whiskerMat);
        wh.position.set(s * r * 0.4, r * 0.9 + w * r * 0.12, r * 0.8);
        wh.rotation.z = s * (0.8 + w * 0.3);
        wh.rotation.x = -0.15;
        group.add(wh);
      }
    }
  }

  // --- Pigeon (Голубь-бомбер): beak ---
  if (isPigeon) {
    const beakGeo = new THREE.ConeGeometry(r * 0.1, r * 0.35, 5);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, r * 0.95, r * 0.95);
    beak.rotation.x = -Math.PI / 2;
    group.add(beak);
  }

  // --- Firefly (Светлячок): glow sphere behind body ---
  if (isFirefly) {
    const glowGeo = new THREE.SphereGeometry(r * 0.6, 10, 8);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xccff00,
      emissive: 0xaaee00,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.5,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, r, -r * 0.7);
    group.add(glow);
    // Small bright core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xeeff44 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 6, 6), coreMat);
    core.position.set(0, r, -r * 0.7);
    group.add(core);
  }

  // --- Mantis (Богомол): long front arms override will happen via geometry, add scythe-arms ---
  if (isMantis) {
    const scytheMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20 });
    for (let s = -1; s <= 1; s += 2) {
      // Upper arm
      const uaGeo = new THREE.CylinderGeometry(r * 0.06, r * 0.05, r * 0.6, 5);
      const ua = new THREE.Mesh(uaGeo, scytheMat);
      ua.position.set(s * r * 0.7, r * 1.3, r * 0.5);
      ua.rotation.x = -0.8;
      ua.rotation.z = s * 0.3;
      group.add(ua);
      // Blade
      const bladeGeo = new THREE.ConeGeometry(r * 0.04, r * 0.4, 4);
      const blade = new THREE.Mesh(bladeGeo, scytheMat);
      blade.position.set(s * r * 0.6, r * 1.6, r * 0.85);
      blade.rotation.x = -1.2;
      group.add(blade);
    }
  }

  // --- Eyes (improved with per-type variation) ---
  let eyeSize = r * 0.2;
  let pupilSize = r * 0.1;
  let eyeColor = 0xffffff;
  let pupilColor = 0x111111;

  if (isCat) { eyeSize = r * 0.28; pupilSize = r * 0.09; }
  else if (name === 'Таракан') { eyeSize = r * 0.13; pupilSize = r * 0.07; }
  else if (isRat) { eyeSize = r * 0.18; pupilColor = 0xdd1133; }
  else if (isFirefly) { eyeSize = r * 0.17; pupilColor = 0x44ff00; eyeColor = 0xccffcc; }
  else if (isPigeon) { eyeSize = r * 0.16; pupilColor = 0x331100; }

  const whiteEyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.2, metalness: 0.05 });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: pupilColor,
    roughness: 0.1,
    emissive: isFirefly ? 0x22cc00 : (isRat ? 0x990022 : 0x000000),
    emissiveIntensity: (isFirefly || isRat) ? 0.8 : 0,
  });

  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 10, 10), whiteEyeMat);
    eye.position.set(s * r * 0.35, r * 1.25, r * 0.75);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(pupilSize, 8, 8), pupilMat);
    pupil.position.set(s * r * 0.35, r * 1.25, r * 0.75 + eyeSize * 0.6);
    group.add(pupil);
    // Specular highlight dot
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl = new THREE.Mesh(new THREE.SphereGeometry(pupilSize * 0.35, 4, 4), hlMat);
    hl.position.set(s * r * 0.35 + eyeSize * 0.15, r * 1.25 + eyeSize * 0.2, r * 0.75 + eyeSize * 0.75);
    group.add(hl);
  }

  // --- Arms (same positions/structure) ---
  const armGeo = new THREE.CylinderGeometry(r * 0.08, r * 0.06, r * 0.7, 5);
  const armMat = new THREE.MeshStandardMaterial({ color: darkerColor, flatShading: useFlatShading });
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

  // --- Legs (same positions/structure) ---
  const legGeo = new THREE.CylinderGeometry(r * 0.1, r * 0.12, r * 0.5, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: darkerColor, flatShading: useFlatShading });
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

  // --- Extra legs for insects (middle pair) ---
  if (isInsect || isWasp) {
    const midLegMat = new THREE.MeshStandardMaterial({ color: darkerColor, flatShading: true });
    for (let s = -1; s <= 1; s += 2) {
      const mlGeo = new THREE.CylinderGeometry(r * 0.06, r * 0.08, r * 0.45, 4);
      const ml = new THREE.Mesh(mlGeo, midLegMat);
      ml.position.set(s * r * 0.7, r * 0.2, -r * 0.25);
      ml.rotation.z = s * 0.6;
      group.add(ml);
    }
  }

  // --- Wings ---
  if (type.flying) {
    const wingScale = isPigeon ? 1.5 : (isFirefly ? 0.8 : 1.0);
    const wingGeo = new THREE.PlaneGeometry(r * 1.2 * wingScale, r * 0.6 * wingScale);
    const wingColor = isPigeon ? 0xb0bec5 : (isFirefly ? 0xccff88 : 0xffffff);
    const wingOpacity = isPigeon ? 0.7 : (isFirefly ? 0.35 : 0.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: wingColor, transparent: true, opacity: wingOpacity, side: THREE.DoubleSide,
      emissive: isFirefly ? 0x66ff00 : 0x000000,
      emissiveIntensity: isFirefly ? 0.3 : 0,
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

  // --- Shadow ---
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
