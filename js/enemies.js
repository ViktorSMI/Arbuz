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
  const darkerHex = baseColor.clone().multiplyScalar(0.7).getHex();
  const lighterHex = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.3).getHex();
  const name = type.name;

  // ===== Helper: add eyes to group =====
  function addEyes(eyeX, eyeY, eyeZ, size, pupilSz, pupilCol, emissiveCol, emissiveInt) {
    const wMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pMat = new THREE.MeshStandardMaterial({ color: pupilCol, roughness: 0.1, emissive: emissiveCol || 0x000000, emissiveIntensity: emissiveInt || 0 });
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 10), wMat);
      eye.position.set(s * eyeX, eyeY, eyeZ);
      group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(pupilSz, 8, 8), pMat);
      pupil.position.set(s * eyeX, eyeY, eyeZ + size * 0.6);
      group.add(pupil);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(pupilSz * 0.35, 4, 4), hlMat);
      hl.position.set(s * eyeX + size * 0.15, eyeY + size * 0.2, eyeZ + size * 0.75);
      group.add(hl);
    }
  }

  // ===============================================================
  //  1. Жук-солдат (Beetle Soldier) — oval body, hard shell, 6 legs
  // ===============================================================
  if (name === 'Жук-солдат') {
    // Oval body — wider than tall
    const bodyGeo = new THREE.SphereGeometry(r, 16, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.8, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = r;
    body.scale.set(1.2, 0.75, 1.0);
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Hard shell on top (half-sphere, darker and shinier)
    const shellGeo = new THREE.SphereGeometry(r * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const shellMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.3, metalness: 0.4, flatShading: true });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = r;
    shell.scale.set(1.15, 0.8, 1.0);
    group.add(shell);

    // Shell split line
    const splitGeo = new THREE.BoxGeometry(r * 0.02, r * 0.05, r * 1.8);
    const splitMat = new THREE.MeshStandardMaterial({ color: 0x1a1a0a });
    const split = new THREE.Mesh(splitGeo, splitMat);
    split.position.set(0, r * 1.4, -r * 0.1);
    group.add(split);

    // Head (small sphere at front)
    const headGeo = new THREE.SphereGeometry(r * 0.35, 10, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.7, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, r * 0.9, r * 0.95);
    group.add(head);

    // Pincers
    const pincerMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, flatShading: true });
    for (let s = -1; s <= 1; s += 2) {
      const pGeo = new THREE.ConeGeometry(r * 0.06, r * 0.3, 4);
      const p = new THREE.Mesh(pGeo, pincerMat);
      p.position.set(s * r * 0.2, r * 0.75, r * 1.2);
      p.rotation.x = -1.3;
      p.rotation.z = s * 0.4;
      group.add(p);
    }

    // Antennae — two short
    const antMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    for (let s = -1; s <= 1; s += 2) {
      const ag = new THREE.CylinderGeometry(r * 0.02, r * 0.015, r * 0.35, 4);
      const a = new THREE.Mesh(ag, antMat);
      a.position.set(s * r * 0.15, r * 1.15, r * 1.1);
      a.rotation.z = s * -0.3;
      a.rotation.x = -0.6;
      group.add(a);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.03, 4, 4), antMat);
      tip.position.set(s * r * 0.25, r * 1.3, r * 1.3);
      group.add(tip);
    }

    // Eyes on head
    addEyes(r * 0.2, r * 1.0, r * 1.15, r * 0.12, r * 0.06, 0x111111, 0x000000, 0);

    // 6 legs — 3 pairs
    const legMat = new THREE.MeshStandardMaterial({ color: darkerHex, flatShading: true });
    const legPositions = [
      { z: r * 0.3, spread: 0.7 },
      { z: 0, spread: 0.85 },
      { z: -r * 0.35, spread: 0.7 },
    ];
    for (const lp of legPositions) {
      for (let s = -1; s <= 1; s += 2) {
        const lg = new THREE.CylinderGeometry(r * 0.04, r * 0.05, r * 0.5, 4);
        const leg = new THREE.Mesh(lg, legMat);
        leg.position.set(s * r * lp.spread, r * 0.2, lp.z);
        leg.rotation.z = s * 0.6;
        group.add(leg);
      }
    }

    // Required animation legs/arms
    const armGeo = new THREE.CylinderGeometry(r * 0.06, r * 0.05, r * 0.55, 5);
    const armMat = new THREE.MeshStandardMaterial({ color: darkerHex, flatShading: true });
    const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.07, r * 0.08, r * 0.45, 5);
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  2. Муравей (Ant) — three segments, 6 thin legs, long antennae
  // ===============================================================
  else if (name === 'Муравей') {
    const antColor = type.color;
    const antMat = new THREE.MeshStandardMaterial({ color: antColor, roughness: 0.75, flatShading: true });
    const antDark = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.7, flatShading: true });

    // Abdomen (largest, at back)
    const abdGeo = new THREE.SphereGeometry(r * 0.6, 10, 8);
    const abd = new THREE.Mesh(abdGeo, antMat);
    abd.position.set(0, r * 0.6, -r * 0.5);
    abd.scale.set(0.8, 0.75, 1.1);
    group.add(abd);

    // Thorax (middle, small)
    const thorGeo = new THREE.SphereGeometry(r * 0.35, 8, 6);
    const thor = new THREE.Mesh(thorGeo, antMat);
    thor.position.set(0, r * 0.65, r * 0.15);
    group.add(thor);

    // Head (front, small round) — this is the main body for collision
    const headGeo = new THREE.SphereGeometry(r * 0.4, 10, 8);
    const body = new THREE.Mesh(headGeo, antDark);
    body.position.y = r;
    body.position.z = r * 0.6;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Mandibles
    const mandMat = new THREE.MeshStandardMaterial({ color: 0x1a0e00, flatShading: true });
    for (let s = -1; s <= 1; s += 2) {
      const mGeo = new THREE.ConeGeometry(r * 0.04, r * 0.18, 4);
      const m = new THREE.Mesh(mGeo, mandMat);
      m.position.set(s * r * 0.12, r * 0.85, r * 0.95);
      m.rotation.x = -1.4;
      m.rotation.z = s * 0.35;
      group.add(m);
    }

    // Long antennae
    const antennaMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    for (let s = -1; s <= 1; s += 2) {
      // Segment 1
      const a1g = new THREE.CylinderGeometry(r * 0.02, r * 0.015, r * 0.5, 4);
      const a1 = new THREE.Mesh(a1g, antennaMat);
      a1.position.set(s * r * 0.15, r * 1.25, r * 0.75);
      a1.rotation.z = s * -0.4;
      a1.rotation.x = -0.7;
      group.add(a1);
      // Segment 2 (bent)
      const a2g = new THREE.CylinderGeometry(r * 0.015, r * 0.01, r * 0.35, 4);
      const a2 = new THREE.Mesh(a2g, antennaMat);
      a2.position.set(s * r * 0.35, r * 1.5, r * 1.1);
      a2.rotation.x = -0.3;
      a2.rotation.z = s * -0.2;
      group.add(a2);
    }

    // Eyes
    addEyes(r * 0.22, r * 1.1, r * 0.85, r * 0.1, r * 0.05, 0x111111, 0x000000, 0);

    // 6 thin legs — 3 pairs from thorax/abdomen
    const thinLegMat = new THREE.MeshStandardMaterial({ color: darkerHex, flatShading: true });
    const legZs = [r * 0.15, -r * 0.05, -r * 0.35];
    for (const lz of legZs) {
      for (let s = -1; s <= 1; s += 2) {
        const lg = new THREE.CylinderGeometry(r * 0.025, r * 0.03, r * 0.5, 4);
        const leg = new THREE.Mesh(lg, thinLegMat);
        leg.position.set(s * r * 0.55, r * 0.2, lz);
        leg.rotation.z = s * 0.7;
        group.add(leg);
      }
    }

    // Required animation limbs
    const armGeo = new THREE.CylinderGeometry(r * 0.03, r * 0.025, r * 0.4, 5);
    const armL = new THREE.Mesh(armGeo, thinLegMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, thinLegMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.04, r * 0.05, r * 0.4, 5);
    const legL = new THREE.Mesh(legGeo, thinLegMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, thinLegMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  3. Оса (Wasp) — narrow waist, striped abdomen, stinger, FLYING
  // ===============================================================
  else if (name === 'Оса') {
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.6, flatShading: true });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, flatShading: true });

    // Head sphere
    const headGeo = new THREE.SphereGeometry(r * 0.35, 10, 8);
    const body = new THREE.Mesh(headGeo, yellowMat);
    body.position.y = r;
    body.position.z = r * 0.5;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Big compound eyes (dark hemispheres on sides of head)
    const compEyeMat = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.2, metalness: 0.3 });
    for (let s = -1; s <= 1; s += 2) {
      const ceGeo = new THREE.SphereGeometry(r * 0.18, 8, 8, 0, Math.PI);
      const ce = new THREE.Mesh(ceGeo, compEyeMat);
      ce.position.set(s * r * 0.28, r * 1.05, r * 0.65);
      ce.rotation.y = s * -Math.PI / 2;
      group.add(ce);
      // Highlight
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.04, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.35, r * 1.1, r * 0.75);
      group.add(hl);
    }

    // Thin waist (narrow cylinder)
    const waistGeo = new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.3, 6);
    const waist = new THREE.Mesh(waistGeo, blackMat);
    waist.position.set(0, r * 0.85, -r * 0.05);
    waist.rotation.x = Math.PI / 2;
    group.add(waist);

    // Abdomen (elongated cone) with stripes via vertex colors
    const abdGeo = new THREE.ConeGeometry(r * 0.45, r * 1.2, 10, 6);
    const abdPosAttr = abdGeo.attributes.position;
    const abdColors = new Float32Array(abdPosAttr.count * 3);
    for (let i = 0; i < abdPosAttr.count; i++) {
      const y = abdPosAttr.getY(i);
      const normY = (y / (r * 0.6) + 1) * 0.5;
      const stripe = Math.sin(normY * Math.PI * 5);
      if (stripe > 0) {
        abdColors[i * 3] = 0.99; abdColors[i * 3 + 1] = 0.85; abdColors[i * 3 + 2] = 0.1;
      } else {
        abdColors[i * 3] = 0.07; abdColors[i * 3 + 1] = 0.07; abdColors[i * 3 + 2] = 0.05;
      }
    }
    abdGeo.setAttribute('color', new THREE.BufferAttribute(abdColors, 3));
    const abdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true });
    const abd = new THREE.Mesh(abdGeo, abdMat);
    abd.position.set(0, r * 0.75, -r * 0.7);
    abd.rotation.x = Math.PI * 0.6;
    group.add(abd);

    // Stinger (small cone at tip)
    const stingerGeo = new THREE.ConeGeometry(r * 0.04, r * 0.2, 4);
    const stingerMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const stinger = new THREE.Mesh(stingerGeo, stingerMat);
    stinger.position.set(0, r * 0.5, -r * 1.3);
    stinger.rotation.x = Math.PI * 0.6;
    group.add(stinger);

    // Antennae
    const antMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let s = -1; s <= 1; s += 2) {
      const ag = new THREE.CylinderGeometry(r * 0.015, r * 0.01, r * 0.4, 4);
      const a = new THREE.Mesh(ag, antMat);
      a.position.set(s * r * 0.1, r * 1.2, r * 0.75);
      a.rotation.z = s * -0.3;
      a.rotation.x = -0.5;
      group.add(a);
    }

    // Limbs for animation
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
    const armGeo = new THREE.CylinderGeometry(r * 0.03, r * 0.025, r * 0.45, 5);
    const armL = new THREE.Mesh(armGeo, limbMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, limbMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.035, r * 0.04, r * 0.4, 5);
    const legL = new THREE.Mesh(legGeo, limbMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, limbMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;

    // Extra middle legs
    for (let s = -1; s <= 1; s += 2) {
      const ml = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.025, r * 0.03, r * 0.35, 4), limbMat);
      ml.position.set(s * r * 0.5, r * 0.2, -r * 0.15);
      ml.rotation.z = s * 0.6;
      group.add(ml);
    }

    // Wings (transparent)
    const wingGeo = new THREE.PlaneGeometry(r * 1.2, r * 0.5);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.set(-r * 0.9, r * 1.6, -r * 0.2); wingL.rotation.z = -0.3; group.add(wingL); group.userData.wingL = wingL;
    const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.position.set(r * 0.9, r * 1.6, -r * 0.2); wingR.rotation.z = 0.3; group.add(wingR); group.userData.wingR = wingR;
  }

  // ===============================================================
  //  4. Таракан (Cockroach) — flat wide oval, shiny shell
  // ===============================================================
  else if (name === 'Таракан') {
    // Flat wide body
    const bodyGeo = new THREE.SphereGeometry(r, 14, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.2, metalness: 0.5, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = r;
    body.scale.set(1.3, 0.5, 1.1); // flat and wide
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Shiny shell overlay
    const shellGeo = new THREE.SphereGeometry(r * 0.98, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const shellMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.1, metalness: 0.6, flatShading: true });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = r;
    shell.scale.set(1.25, 0.55, 1.1);
    group.add(shell);

    // Small flat head
    const headGeo = new THREE.SphereGeometry(r * 0.3, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.3, metalness: 0.4, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, r * 0.75, r * 0.9);
    head.scale.set(1.2, 0.6, 1);
    group.add(head);

    // Small eyes
    addEyes(r * 0.18, r * 0.85, r * 1.05, r * 0.08, r * 0.04, 0x111111, 0x000000, 0);

    // Long antennae that curve back
    const antMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    for (let s = -1; s <= 1; s += 2) {
      const segs = 4;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const ag = new THREE.CylinderGeometry(r * 0.015 * (1 - t * 0.5), r * 0.012 * (1 - t * 0.5), r * 0.35, 4);
        const a = new THREE.Mesh(ag, antMat);
        const angle = t * 1.0;
        a.position.set(s * (r * 0.15 + t * r * 0.15), r * 0.9 + t * r * 0.15, r * (1.0 + t * 0.5));
        a.rotation.z = s * (-0.2 - t * 0.3);
        a.rotation.x = -0.3 + t * 0.2;
        group.add(a);
      }
    }

    // 6 legs spread wide
    const legMat = new THREE.MeshStandardMaterial({ color: darkerHex, flatShading: true });
    const legZpos = [r * 0.3, 0, -r * 0.35];
    for (const lz of legZpos) {
      for (let s = -1; s <= 1; s += 2) {
        const lg = new THREE.CylinderGeometry(r * 0.03, r * 0.04, r * 0.55, 4);
        const leg = new THREE.Mesh(lg, legMat);
        leg.position.set(s * r * 0.85, r * 0.2, lz);
        leg.rotation.z = s * 0.8;
        group.add(leg);
      }
    }

    // Animation limbs
    const armGeo = new THREE.CylinderGeometry(r * 0.04, r * 0.035, r * 0.5, 5);
    const armL = new THREE.Mesh(armGeo, legMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, legMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeoA = new THREE.CylinderGeometry(r * 0.05, r * 0.06, r * 0.4, 5);
    const legL = new THREE.Mesh(legGeoA, legMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeoA, legMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  5. Богомол (Mantis) — tall thin, triangular head, scythe arms
  // ===============================================================
  else if (name === 'Богомол') {
    const greenMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.6, flatShading: true });
    const darkGreenMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.5, flatShading: true });

    // Long thin body (cylinder) — main body for collision
    const bodyGeo = new THREE.CylinderGeometry(r * 0.3, r * 0.25, r * 1.4, 8);
    const body = new THREE.Mesh(bodyGeo, greenMat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Triangular head on top
    const headGeo = new THREE.ConeGeometry(r * 0.35, r * 0.4, 3);
    const head = new THREE.Mesh(headGeo, darkGreenMat);
    head.position.set(0, r * 1.9, r * 0.15);
    head.rotation.x = 0.2;
    head.rotation.y = Math.PI;
    group.add(head);

    // Large eyes on sides of head
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.2, emissive: 0x446600, emissiveIntensity: 0.3 });
    for (let s = -1; s <= 1; s += 2) {
      const eg = new THREE.SphereGeometry(r * 0.18, 8, 8);
      const e = new THREE.Mesh(eg, eyeMat);
      e.position.set(s * r * 0.32, r * 2.0, r * 0.2);
      group.add(e);
      // Pupil
      const pg = new THREE.SphereGeometry(r * 0.08, 6, 6);
      const p = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x111111 }));
      p.position.set(s * r * 0.35, r * 2.0, r * 0.35);
      group.add(p);
      // Highlight
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.03, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.36, r * 2.05, r * 0.38);
      group.add(hl);
    }

    // Abdomen (elongated at back-bottom)
    const abdGeo = new THREE.SphereGeometry(r * 0.4, 8, 8);
    const abd = new THREE.Mesh(abdGeo, greenMat);
    abd.position.set(0, r * 0.5, -r * 0.3);
    abd.scale.set(0.8, 0.7, 1.3);
    group.add(abd);

    // Scythe/claw front arms — these ARE the animation arms
    const scytheMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, flatShading: true });
    // Left scythe arm
    const scytheArmGeoL = new THREE.CylinderGeometry(r * 0.06, r * 0.05, r * 0.8, 5);
    const armL = new THREE.Mesh(scytheArmGeoL, scytheMat);
    armL.position.set(-r * 0.85, r * 0.9, 0);
    armL.rotation.z = 0.5;
    armL.castShadow = true;
    group.add(armL);
    group.userData.armL = armL;
    // Left blade
    const bladeL = new THREE.Mesh(new THREE.ConeGeometry(r * 0.05, r * 0.5, 4), scytheMat);
    bladeL.position.set(-r * 0.6, r * 1.5, r * 0.6);
    bladeL.rotation.x = -1.0;
    bladeL.rotation.z = 0.3;
    group.add(bladeL);

    // Right scythe arm
    const armR = new THREE.Mesh(scytheArmGeoL, scytheMat);
    armR.position.set(r * 0.85, r * 0.9, 0);
    armR.rotation.z = -0.5;
    armR.castShadow = true;
    group.add(armR);
    group.userData.armR = armR;
    // Right blade
    const bladeR = new THREE.Mesh(new THREE.ConeGeometry(r * 0.05, r * 0.5, 4), scytheMat);
    bladeR.position.set(r * 0.6, r * 1.5, r * 0.6);
    bladeR.rotation.x = -1.0;
    bladeR.rotation.z = -0.3;
    group.add(bladeR);

    // 4 thin back legs
    const thinLegMat = new THREE.MeshStandardMaterial({ color: darkerHex, flatShading: true });
    const backLegZ = [-r * 0.1, -r * 0.35];
    for (const lz of backLegZ) {
      for (let s = -1; s <= 1; s += 2) {
        const lg = new THREE.CylinderGeometry(r * 0.03, r * 0.04, r * 0.7, 4);
        const leg = new THREE.Mesh(lg, thinLegMat);
        leg.position.set(s * r * 0.45, r * 0.2, lz);
        leg.rotation.z = s * 0.5;
        group.add(leg);
      }
    }

    // Animation legs
    const legGeo = new THREE.CylinderGeometry(r * 0.05, r * 0.06, r * 0.55, 5);
    const legL = new THREE.Mesh(legGeo, thinLegMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, thinLegMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  6. Кот (Cat) — round body, separate head, ears, whiskers, tail
  // ===============================================================
  else if (name === 'Кот') {
    const furMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.8 });
    const lighterMat = new THREE.MeshStandardMaterial({ color: lighterHex, roughness: 0.7 });

    // Round body
    const bodyGeo = new THREE.SphereGeometry(r * 0.8, 14, 12);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = r;
    body.scale.set(1, 0.9, 0.95);
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Belly (lighter front)
    const bellyGeo = new THREE.SphereGeometry(r * 0.6, 10, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5);
    const belly = new THREE.Mesh(bellyGeo, lighterMat);
    belly.position.set(0, r * 0.85, r * 0.15);
    belly.rotation.x = -0.2;
    group.add(belly);

    // Head (separate sphere on top-front)
    const headGeo = new THREE.SphereGeometry(r * 0.5, 12, 10);
    const head = new THREE.Mesh(headGeo, furMat);
    head.position.set(0, r * 1.55, r * 0.3);
    group.add(head);

    // Triangle ears with pink insides
    const earMat = new THREE.MeshStandardMaterial({ color: type.color });
    const earInMat = new THREE.MeshStandardMaterial({ color: 0xffab91 });
    for (let s = -1; s <= 1; s += 2) {
      const earGeo = new THREE.ConeGeometry(r * 0.18, r * 0.35, 4);
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(s * r * 0.35, r * 2.0, r * 0.25);
      ear.rotation.z = s * 0.15;
      group.add(ear);
      const earInGeo = new THREE.ConeGeometry(r * 0.09, r * 0.2, 4);
      const earIn = new THREE.Mesh(earInGeo, earInMat);
      earIn.position.set(s * r * 0.35, r * 1.97, r * 0.3);
      earIn.rotation.z = s * 0.15;
      group.add(earIn);
    }

    // Cat eyes — slit pupils
    const catEyeMat = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.2 });
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 10, 10), catEyeMat);
      eye.position.set(s * r * 0.25, r * 1.6, r * 0.7);
      group.add(eye);
      // Vertical slit pupil
      const slitGeo = new THREE.BoxGeometry(r * 0.03, r * 0.2, r * 0.06);
      const slit = new THREE.Mesh(slitGeo, slitMat);
      slit.position.set(s * r * 0.25, r * 1.6, r * 0.7 + r * 0.12);
      group.add(slit);
      // Highlight
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.03, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.25 + r * 0.05, r * 1.65, r * 0.83);
      group.add(hl);
    }

    // Pink nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff7043 }));
    nose.position.set(0, r * 1.48, r * 0.78);
    group.add(nose);

    // Mouth lines (tiny cylinders)
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    for (let s = -1; s <= 1; s += 2) {
      const mg = new THREE.CylinderGeometry(0.01, 0.01, r * 0.12, 3);
      const m = new THREE.Mesh(mg, mouthMat);
      m.position.set(s * r * 0.06, r * 1.4, r * 0.78);
      m.rotation.z = s * 0.5;
      group.add(m);
    }

    // Whiskers (thin lines)
    const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    for (let s = -1; s <= 1; s += 2) {
      for (let w = 0; w < 3; w++) {
        const wg = new THREE.CylinderGeometry(0.008, 0.005, r * 0.45, 3);
        const wh = new THREE.Mesh(wg, whiskerMat);
        wh.position.set(s * r * 0.35, r * 1.45 + w * r * 0.06, r * 0.72);
        wh.rotation.z = s * (0.8 + w * 0.15);
        wh.rotation.x = -0.1;
        group.add(wh);
      }
    }

    // Puffy tail curving up
    const tailMat = new THREE.MeshStandardMaterial({ color: type.color });
    const tailSegs = 6;
    for (let i = 0; i < tailSegs; i++) {
      const t = i / tailSegs;
      const thickness = r * 0.08 * (1 + Math.sin(t * Math.PI) * 0.8);
      const sg = new THREE.SphereGeometry(thickness, 5, 5);
      const seg = new THREE.Mesh(sg, tailMat);
      const curve = t * 1.8;
      seg.position.set(0, r * (0.6 + Math.sin(curve) * t * 0.8), -r * (0.7 + t * 0.45));
      group.add(seg);
    }
    // Fluffy tail tip
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 6), tailMat);
    tailTip.position.set(0, r * 1.3, -r * 1.4);
    group.add(tailTip);

    // 4 stubby legs — animation limbs
    const legMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    const armGeo = new THREE.CylinderGeometry(r * 0.1, r * 0.12, r * 0.45, 6);
    const armL = new THREE.Mesh(armGeo, legMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, legMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    // Paws on front legs
    for (let s = -1; s <= 1; s += 2) {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 6, 6), lighterMat);
      paw.position.set(s * r * 0.85, r * 0.55, r * 0.05);
      group.add(paw);
    }
    const legGeo = new THREE.CylinderGeometry(r * 0.12, r * 0.14, r * 0.4, 6);
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  7. Дворник (Janitor) — humanoid, box torso, flat cap, broom
  // ===============================================================
  else if (name === 'Дворник') {
    const clothMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.6 });
    const darkClothMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.7 });

    // Box torso — main body
    const bodyGeo = new THREE.BoxGeometry(r * 1.0, r * 1.1, r * 0.7);
    const body = new THREE.Mesh(bodyGeo, clothMat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Apron (flat box on front)
    const apronGeo = new THREE.BoxGeometry(r * 0.8, r * 0.8, r * 0.05);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.set(0, r * 0.85, r * 0.37);
    group.add(apron);

    // Apron pocket
    const pocketGeo = new THREE.BoxGeometry(r * 0.3, r * 0.2, r * 0.03);
    const pocket = new THREE.Mesh(pocketGeo, new THREE.MeshStandardMaterial({ color: 0x795548 }));
    pocket.position.set(0, r * 0.95, r * 0.4);
    group.add(pocket);

    // Round head
    const headGeo = new THREE.SphereGeometry(r * 0.38, 12, 10);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, r * 1.85, 0);
    group.add(head);

    // Grumpy expression — furrowed brows
    const browMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    for (let s = -1; s <= 1; s += 2) {
      const bg = new THREE.BoxGeometry(r * 0.15, r * 0.03, r * 0.04);
      const brow = new THREE.Mesh(bg, browMat);
      brow.position.set(s * r * 0.15, r * 1.97, r * 0.32);
      brow.rotation.z = s * -0.25;
      group.add(brow);
    }

    // Eyes
    addEyes(r * 0.15, r * 1.9, r * 0.3, r * 0.1, r * 0.05, 0x333333, 0x000000, 0);

    // Frown mouth
    const mouthGeo = new THREE.BoxGeometry(r * 0.2, r * 0.025, r * 0.03);
    const mouth = new THREE.Mesh(mouthGeo, browMat);
    mouth.position.set(0, r * 1.72, r * 0.35);
    group.add(mouth);

    // Nose
    const noseGeo = new THREE.SphereGeometry(r * 0.06, 6, 6);
    const noseRed = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: 0xee8888 }));
    noseRed.position.set(0, r * 1.82, r * 0.38);
    group.add(noseRed);

    // Flat cap / hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x37474f });
    const hatGeo = new THREE.CylinderGeometry(r * 0.42, r * 0.45, r * 0.15, 8);
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.set(0, r * 2.2, 0);
    group.add(hat);
    // Visor/brim
    const brimGeo = new THREE.CylinderGeometry(r * 0.5, r * 0.5, r * 0.03, 10);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.set(0, r * 2.12, r * 0.15);
    group.add(brim);

    // Broom (held in right hand area)
    const broomStickMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
    const broomStickGeo = new THREE.CylinderGeometry(r * 0.035, r * 0.035, r * 2.0, 5);
    const broomStick = new THREE.Mesh(broomStickGeo, broomStickMat);
    broomStick.position.set(r * 1.1, r * 1.0, 0);
    broomStick.rotation.z = -0.2;
    group.add(broomStick);
    // Broom head (wider)
    const broomHeadGeo = new THREE.BoxGeometry(r * 0.4, r * 0.35, r * 0.15);
    const broomHeadMat = new THREE.MeshStandardMaterial({ color: 0xa1887f });
    const broomHead = new THREE.Mesh(broomHeadGeo, broomHeadMat);
    broomHead.position.set(r * 1.25, r * 0.15, 0);
    group.add(broomHead);
    // Bristles
    const bristleMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8 });
    for (let i = 0; i < 5; i++) {
      const bg = new THREE.CylinderGeometry(0.015, 0.01, r * 0.25, 3);
      const b = new THREE.Mesh(bg, bristleMat);
      b.position.set(r * 1.1 + (i - 2) * r * 0.08, r * 0.02, 0);
      group.add(b);
    }

    // Arms — humanoid
    const armGeo = new THREE.CylinderGeometry(r * 0.1, r * 0.08, r * 0.7, 6);
    const armL = new THREE.Mesh(armGeo, clothMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, clothMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    // Hands
    for (let s = -1; s <= 1; s += 2) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 6, 6), skinMat);
      hand.position.set(s * r * 0.95, r * 0.55, 0);
      group.add(hand);
    }

    // Legs — pants
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
    const legGeo = new THREE.CylinderGeometry(r * 0.12, r * 0.1, r * 0.6, 6);
    const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
    // Boots
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
    for (let s = -1; s <= 1; s += 2) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 0.1, r * 0.22), bootMat);
      boot.position.set(s * r * 0.4, r * -0.05, r * 0.04);
      group.add(boot);
    }
  }

  // ===============================================================
  //  8. Крыса-мутант (Mutant Rat) — elongated body, pointy snout
  // ===============================================================
  else if (name === 'Крыса-мутант') {
    const furMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.7 });

    // Elongated body
    const bodyGeo = new THREE.SphereGeometry(r, 14, 10);
    // Add patchy vertex colors
    const bPosAttr = bodyGeo.attributes.position;
    const bColors = new Float32Array(bPosAttr.count * 3);
    const bc = baseColor.clone();
    for (let i = 0; i < bPosAttr.count; i++) {
      const px = bPosAttr.getX(i), py = bPosAttr.getY(i), pz = bPosAttr.getZ(i);
      const normY = (py / r + 1) * 0.5;
      const ao = 0.6 + normY * 0.4;
      let cr = bc.r * ao, cg = bc.g * ao, cb = bc.b * ao;
      // Patchy fur
      const patch = Math.sin(px * 7 + pz * 11) * Math.cos(py * 5);
      if (patch > 0.3) { cr *= 0.5; cg *= 0.4; cb *= 0.55; }
      if (patch < -0.4) { cr = Math.min(1, cr * 1.3); cg = Math.min(1, cg * 1.1); }
      // Lighter belly
      if (normY < 0.3) { cr = Math.min(1, cr + 0.15); cg = Math.min(1, cg + 0.1); cb = Math.min(1, cb + 0.15); }
      bColors[i * 3] = Math.min(1, Math.max(0, cr));
      bColors[i * 3 + 1] = Math.min(1, Math.max(0, cg));
      bColors[i * 3 + 2] = Math.min(1, Math.max(0, cb));
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(bColors, 3));
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = r;
    body.scale.set(0.8, 0.85, 1.3); // stretched on Z
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Pointy snout (cone at front)
    const snoutGeo = new THREE.ConeGeometry(r * 0.2, r * 0.5, 6);
    const snoutMat = new THREE.MeshStandardMaterial({ color: lighterHex, roughness: 0.6 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, r * 0.9, r * 1.15);
    snout.rotation.x = -Math.PI / 2;
    group.add(snout);

    // Nose tip
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 5, 5), new THREE.MeshStandardMaterial({ color: 0xff6699 }));
    noseTip.position.set(0, r * 0.9, r * 1.4);
    group.add(noseTip);

    // Large round ears
    const earMat = new THREE.MeshStandardMaterial({ color: 0xf48fb1, side: THREE.DoubleSide });
    for (let s = -1; s <= 1; s += 2) {
      const earGeo = new THREE.CircleGeometry(r * 0.3, 12);
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(s * r * 0.5, r * 1.5, r * 0.2);
      ear.rotation.y = s * -0.5;
      group.add(ear);
      // Inner ear (darker pink)
      const earIn = new THREE.Mesh(new THREE.CircleGeometry(r * 0.18, 10), new THREE.MeshStandardMaterial({ color: 0xf06292, side: THREE.DoubleSide }));
      earIn.position.set(s * r * 0.48, r * 1.5, r * 0.22);
      earIn.rotation.y = s * -0.5;
      group.add(earIn);
    }

    // Glowing red/pink eyes
    const redEyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.1, emissive: 0xdd0033, emissiveIntensity: 0.8 });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 8), redEyeMat);
      eye.position.set(s * r * 0.3, r * 1.15, r * 0.85);
      group.add(eye);
      // Bright pupil center
      const pc = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4488 }));
      pc.position.set(s * r * 0.3, r * 1.15, r * 0.95);
      group.add(pc);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.025, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.3 + r * 0.04, r * 1.2, r * 0.97);
      group.add(hl);
    }

    // Whiskers
    const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    for (let s = -1; s <= 1; s += 2) {
      for (let w = 0; w < 3; w++) {
        const wg = new THREE.CylinderGeometry(0.007, 0.004, r * 0.5, 3);
        const wh = new THREE.Mesh(wg, whiskerMat);
        wh.position.set(s * r * 0.35, r * 0.85 + w * r * 0.1, r * 1.0);
        wh.rotation.z = s * (0.7 + w * 0.2);
        wh.rotation.x = -0.1;
        group.add(wh);
      }
    }

    // Long bald tail (thin tapered)
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xe1bee7, roughness: 0.4 });
    const tailSegs = 8;
    for (let i = 0; i < tailSegs; i++) {
      const t = i / tailSegs;
      const thickness = r * 0.04 * (1 - t * 0.7);
      const sg = new THREE.CylinderGeometry(thickness, thickness * 0.7, r * 0.3, 4);
      const seg = new THREE.Mesh(sg, tailMat);
      seg.position.set(Math.sin(t * 3) * r * 0.1, r * (0.35 + t * 0.15), -r * (0.85 + t * 0.35));
      seg.rotation.x = 0.2 + t * 0.1;
      seg.rotation.z = Math.sin(t * 2.5) * 0.2;
      group.add(seg);
    }

    // Animation limbs
    const limbMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    const armGeo = new THREE.CylinderGeometry(r * 0.06, r * 0.05, r * 0.5, 5);
    const armL = new THREE.Mesh(armGeo, limbMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, limbMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.08, r * 0.09, r * 0.45, 5);
    const legL = new THREE.Mesh(legGeo, limbMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, limbMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;
  }

  // ===============================================================
  //  9. Голубь-бомбер (Pigeon Bomber) — puffed chest, beak, FLYING
  // ===============================================================
  else if (name === 'Голубь-бомбер') {
    const grayMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.6 });
    const darkGrayMat = new THREE.MeshStandardMaterial({ color: darkerHex, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

    // Puffed round chest — main body
    const bodyGeo = new THREE.SphereGeometry(r, 14, 12);
    const body = new THREE.Mesh(bodyGeo, grayMat);
    body.position.y = r;
    body.scale.set(0.9, 1.0, 0.85);
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // White chest patch
    const chestGeo = new THREE.SphereGeometry(r * 0.7, 10, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5);
    const chest = new THREE.Mesh(chestGeo, whiteMat);
    chest.position.set(0, r * 0.9, r * 0.15);
    chest.rotation.x = -0.2;
    group.add(chest);

    // Small head tilted forward
    const headGeo = new THREE.SphereGeometry(r * 0.35, 10, 8);
    const head = new THREE.Mesh(headGeo, darkGrayMat);
    head.position.set(0, r * 1.55, r * 0.4);
    group.add(head);

    // Iridescent neck patch
    const neckGeo = new THREE.SphereGeometry(r * 0.28, 8, 6, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5);
    const neckMat = new THREE.MeshStandardMaterial({ color: 0x4a148c, roughness: 0.3, metalness: 0.5 });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.set(0, r * 1.35, r * 0.35);
    group.add(neck);

    // Orange beak (cone)
    const beakGeo = new THREE.ConeGeometry(r * 0.08, r * 0.3, 5);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffcc80 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, r * 1.5, r * 0.75);
    beak.rotation.x = -Math.PI / 2;
    group.add(beak);

    // Cere (fleshy part above beak)
    const cere = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 5, 5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cere.position.set(0, r * 1.58, r * 0.65);
    group.add(cere);

    // Eyes (orange-red iris)
    const pigEyeMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.2 });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 8), pigEyeMat);
      eye.position.set(s * r * 0.25, r * 1.6, r * 0.6);
      group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      pupil.position.set(s * r * 0.25, r * 1.6, r * 0.68);
      group.add(pupil);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.02, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.25 + r * 0.03, r * 1.64, r * 0.7);
      group.add(hl);
    }

    // Tail feathers (flat planes angled back)
    const tailMat = new THREE.MeshStandardMaterial({ color: darkerHex, side: THREE.DoubleSide });
    for (let i = -1; i <= 1; i++) {
      const tGeo = new THREE.PlaneGeometry(r * 0.3, r * 0.5);
      const t = new THREE.Mesh(tGeo, tailMat);
      t.position.set(i * r * 0.15, r * 0.6, -r * 0.85);
      t.rotation.x = 0.5;
      t.rotation.y = i * 0.15;
      group.add(t);
    }

    // Orange feet tucked under body
    const footMat = new THREE.MeshStandardMaterial({ color: 0xff8a65 });
    for (let s = -1; s <= 1; s += 2) {
      // Leg
      const fLeg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.03, r * 0.25, 4), footMat);
      fLeg.position.set(s * r * 0.2, r * 0.15, r * 0.05);
      group.add(fLeg);
      // Toes (3 small cylinders)
      for (let t = -1; t <= 1; t++) {
        const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, r * 0.15, 3), footMat);
        toe.position.set(s * r * 0.2 + t * r * 0.04, r * 0.02, r * 0.12);
        toe.rotation.x = -Math.PI / 2;
        group.add(toe);
      }
    }

    // Animation limbs (hidden small — pigeon walks with feet)
    const limbMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    const armGeo = new THREE.CylinderGeometry(r * 0.04, r * 0.035, r * 0.4, 5);
    const armL = new THREE.Mesh(armGeo, limbMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, limbMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.05, r * 0.06, r * 0.35, 5);
    const legL = new THREE.Mesh(legGeo, footMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, footMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;

    // Big wide wings
    const wingGeo = new THREE.PlaneGeometry(r * 1.8, r * 0.7);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.set(-r * 0.9, r * 1.6, -r * 0.2); wingL.rotation.z = -0.3; group.add(wingL); group.userData.wingL = wingL;
    const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.position.set(r * 0.9, r * 1.6, -r * 0.2); wingR.rotation.z = 0.3; group.add(wingR); group.userData.wingR = wingR;

    // Wing feather details (dark tips)
    const featherMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, side: THREE.DoubleSide });
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        const fg = new THREE.PlaneGeometry(r * 0.25, r * 0.5);
        const f = new THREE.Mesh(fg, featherMat);
        f.position.set(s * (r * 1.2 + i * r * 0.25), r * 1.5, -r * 0.3);
        f.rotation.z = s * (-0.3 + i * 0.05);
        group.add(f);
      }
    }
  }

  // ===============================================================
  //  10. Светлячок (Firefly) — small head, oval body, glowing abdomen, FLYING
  // ===============================================================
  else if (name === 'Светлячок') {
    const darkBodyMat = new THREE.MeshStandardMaterial({ color: 0x333322, roughness: 0.6, flatShading: true });

    // Small round head
    const headGeo = new THREE.SphereGeometry(r * 0.35, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x444433, roughness: 0.5, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, r * 1.15, r * 0.4);
    group.add(head);

    // Larger oval body — main body for collision
    const bodyGeo = new THREE.SphereGeometry(r * 0.5, 10, 8);
    const body = new THREE.Mesh(bodyGeo, darkBodyMat);
    body.position.y = r;
    body.scale.set(0.8, 0.7, 1.1);
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Eyes (big, glowing green)
    const fEyeMat = new THREE.MeshStandardMaterial({ color: 0xccffcc, roughness: 0.2, emissive: 0x22cc00, emissiveIntensity: 0.5 });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 8, 8), fEyeMat);
      eye.position.set(s * r * 0.22, r * 1.2, r * 0.65);
      group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0x44ff00, emissive: 0x22cc00, emissiveIntensity: 0.8 }));
      pupil.position.set(s * r * 0.22, r * 1.2, r * 0.75);
      group.add(pupil);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.025, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(s * r * 0.22 + r * 0.03, r * 1.24, r * 0.78);
      group.add(hl);
    }

    // Antennae (thin, delicate)
    const antMat = new THREE.MeshStandardMaterial({ color: 0x555544 });
    for (let s = -1; s <= 1; s += 2) {
      const ag = new THREE.CylinderGeometry(r * 0.012, r * 0.008, r * 0.35, 4);
      const a = new THREE.Mesh(ag, antMat);
      a.position.set(s * r * 0.12, r * 1.4, r * 0.55);
      a.rotation.z = s * -0.4;
      a.rotation.x = -0.5;
      group.add(a);
    }

    // BIG glowing abdomen at the back
    const glowGeo = new THREE.SphereGeometry(r * 0.55, 12, 10);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xccff00,
      emissive: 0xaaee00,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.6,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, r * 0.85, -r * 0.65);
    glow.scale.set(0.9, 0.85, 1.1);
    group.add(glow);

    // Bright core inside glow
    const coreGeo = new THREE.SphereGeometry(r * 0.25, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xeeff44 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, r * 0.85, -r * 0.65);
    group.add(core);

    // Secondary glow halo (additive feel)
    const haloGeo = new THREE.SphereGeometry(r * 0.7, 8, 8);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x88ff22, transparent: true, opacity: 0.15 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, r * 0.85, -r * 0.65);
    group.add(halo);

    // Small legs
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x444433, flatShading: true });
    const armGeo = new THREE.CylinderGeometry(r * 0.025, r * 0.02, r * 0.3, 4);
    const armL = new THREE.Mesh(armGeo, limbMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; armL.castShadow = true; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, limbMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; armR.castShadow = true; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.03, r * 0.035, r * 0.3, 4);
    const legL = new THREE.Mesh(legGeo, limbMat); legL.position.set(-r * 0.4, r * 0.15, 0); legL.castShadow = true; group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, limbMat); legR.position.set(r * 0.4, r * 0.15, 0); legR.castShadow = true; group.add(legR); group.userData.legR = legR;

    // Extra middle legs
    for (let s = -1; s <= 1; s += 2) {
      const ml = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.02, r * 0.025, r * 0.25, 4), limbMat);
      ml.position.set(s * r * 0.45, r * 0.2, -r * 0.15);
      ml.rotation.z = s * 0.6;
      group.add(ml);
    }

    // Transparent delicate wings
    const wingGeo = new THREE.PlaneGeometry(r * 0.9, r * 0.45);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xccff88, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
      emissive: 0x66ff00, emissiveIntensity: 0.2,
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.set(-r * 0.9, r * 1.6, -r * 0.2); wingL.rotation.z = -0.3; group.add(wingL); group.userData.wingL = wingL;
    const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.position.set(r * 0.9, r * 1.6, -r * 0.2); wingR.rotation.z = 0.3; group.add(wingR); group.userData.wingR = wingR;

    // Wing vein details
    const veinMat = new THREE.MeshBasicMaterial({ color: 0x88cc44, transparent: true, opacity: 0.4 });
    for (let s = -1; s <= 1; s += 2) {
      const vg = new THREE.CylinderGeometry(0.005, 0.005, r * 0.7, 3);
      const v = new THREE.Mesh(vg, veinMat);
      v.position.set(s * r * 0.9, r * 1.6, -r * 0.2);
      v.rotation.z = s * -0.3;
      group.add(v);
    }
  }

  // ===============================================================
  //  Fallback (should not happen)
  // ===============================================================
  else {
    const bodyGeo = new THREE.SphereGeometry(r, 12, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: type.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;
    const armGeo = new THREE.CylinderGeometry(r * 0.08, r * 0.06, r * 0.7, 5);
    const armMat = new THREE.MeshStandardMaterial({ color: darkerHex });
    const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-r * 0.85, r * 0.9, 0); armL.rotation.z = 0.5; group.add(armL); group.userData.armL = armL;
    const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(r * 0.85, r * 0.9, 0); armR.rotation.z = -0.5; group.add(armR); group.userData.armR = armR;
    const legGeo = new THREE.CylinderGeometry(r * 0.1, r * 0.12, r * 0.5, 5);
    const legL = new THREE.Mesh(legGeo, armMat); legL.position.set(-r * 0.4, r * 0.15, 0); group.add(legL); group.userData.legL = legL;
    const legR = new THREE.Mesh(legGeo, armMat); legR.position.set(r * 0.4, r * 0.15, 0); group.add(legR); group.userData.legR = legR;
  }

  // --- Shadow (always) ---
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
