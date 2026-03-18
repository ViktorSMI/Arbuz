import * as THREE from 'three';
import { WORLD_SIZE, WATER_LEVEL } from './constants.js';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { sfxHit, sfxNpcAttack } from './music.js';

const NPC_DEFS = [
  {
    name: 'Мудрый Кактус',
    color: 0x2e7d32, hatColor: 0x8d6e63,
    dialogue: [
      'Привет, путник! Я Мудрый Кактус.',
      'Эти земли кишат врагами... Убей 10 из них, и я помогу тебе.',
    ],
    questDialogue: 'Убей 10 врагов в этой локации. Я верю в тебя!',
    progressDialogue: 'Ещё не всех убил? Продолжай!',
    completeDialogue: 'Отлично! Ты настоящий воин! Вот, возьми награду.',
    angryDialogue: 'Зачем ты меня бьёшь?! Ну ладно, сам напросился!',
    quest: { type: 'kill', target: 10, progress: 0, done: false, reward: 'hp' },
  },
  {
    name: 'Старый Тыквос',
    color: 0xff8f00, hatColor: 0x5d4037,
    dialogue: [
      'Ох-хо-хо... Я Тыквос, старый тыквенный мудрец.',
      'Мне нужны семечки. Принеси мне 15 семечек, и я поделюсь мудростью.',
    ],
    questDialogue: 'Принеси мне 15 семечек. У тебя есть?',
    progressDialogue: 'Маловато семечек... Собери побольше!',
    completeDialogue: 'Великолепно! Вот тебе стамина, юный арбуз!',
    angryDialogue: 'Старого Тыквоса бить вздумал?! Узнаешь силу тыквы!',
    quest: { type: 'give', target: 15, progress: 0, done: false, reward: 'stamina' },
  },
  {
    name: 'Грибочек',
    color: 0xef5350, hatColor: 0xfafafa,
    dialogue: [
      'Пи-пи-пи! Я Грибочек!',
      'Большой страшный босс пугает меня... Победи его!',
    ],
    questDialogue: 'Пожалуйста, победи босса этой локации!',
    progressDialogue: 'Босс всё ещё жив... Мне стррррашно!',
    completeDialogue: 'Ура! Ты победил его! Вот тебе подарок!',
    angryDialogue: 'Ай! Зачем?! Грибочек будет драться!',
    quest: { type: 'boss', target: 1, progress: 0, done: false, reward: 'damage' },
  },
  {
    name: 'Морковка-ведунья',
    color: 0xff6d00, hatColor: 0x4a148c,
    dialogue: [
      'Хм-м-м... Я вижу твоё будущее, Арбузилла.',
      'Убей 20 врагов, и я раскрою тебе секрет силы.',
    ],
    questDialogue: 'Мне нужно, чтобы ты уничтожил 20 врагов.',
    progressDialogue: 'Судьба ещё не довольна. Убивай дальше.',
    completeDialogue: 'Звёзды говорят — ты достоин! Прими дар!',
    angryDialogue: 'Ты нарушил баланс! Получай!',
    quest: { type: 'kill', target: 20, progress: 0, done: false, reward: 'speed' },
  },
  {
    name: 'Баклажан-торговец',
    color: 0x4a148c, hatColor: 0xfdd835,
    dialogue: [
      'Добро пожаловать в мою лавку! Я Баклажан.',
      'Дай мне 30 семечек — и получишь лучший товар!',
    ],
    questDialogue: 'За 30 семечек я дам тебе усиление здоровья!',
    progressDialogue: 'Не хватает семечек. Возвращайся!',
    completeDialogue: 'Сделка! Забирай своё здоровье!',
    angryDialogue: 'Ты ограбить меня решил?! Не на того напал!',
    quest: { type: 'give', target: 30, progress: 0, done: false, reward: 'hp' },
  },
];

export const npcs = [];

function createNpcMesh(def) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.6, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.3; body.castShadow = true;
  g.add(body); g.userData.body = body;

  const headGeo = new THREE.SphereGeometry(0.45, 10, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.5; head.castShadow = true;
  g.add(head);

  const hatGeo = new THREE.ConeGeometry(0.5, 0.7, 8);
  const hatMat = new THREE.MeshStandardMaterial({ color: def.hatColor, roughness: 0.4 });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 3.1; hat.castShadow = true;
  g.add(hat);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), eyeMat);
    eye.position.set(s * 0.18, 2.6, 0.38);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 5), pupilMat);
    pupil.position.set(s * 0.18, 2.6, 0.45);
    g.add(pupil);
  }

  const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 5);
  const armMat = new THREE.MeshStandardMaterial({ color: def.color });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.65, 1.5, 0); armL.rotation.z = 0.3;
  g.add(armL); g.userData.armL = armL;
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.65, 1.5, 0); armR.rotation.z = -0.3;
  g.add(armR); g.userData.armR = armR;

  const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.7).getHex() });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.2, 0.25, 0);
  g.add(legL); g.userData.legL = legL;
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.2, 0.25, 0);
  g.add(legR); g.userData.legR = legR;

  const excMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, emissive: 0xfdd835, emissiveIntensity: 0.5 });
  const exclamation = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), excMat);
  exclamation.position.y = 3.8;
  g.add(exclamation);
  g.userData.questMarker = exclamation;

  const sh = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 10),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05;
  g.add(sh);

  return g;
}

export function spawnNpcs() {
  clearNpcs();
  const count = Math.min(3, NPC_DEFS.length);
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * NPC_DEFS.length); } while (used.has(idx));
    used.add(idx);
    const def = NPC_DEFS[idx];
    let x, z, y;
    for (let attempt = 0; attempt < 50; attempt++) {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
      y = getTerrainHeight(x, z);
      if (y > WATER_LEVEL + 0.5 && Math.sqrt(x * x + z * z) > 25) break;
    }
    const mesh = createNpcMesh(def);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    npcs.push({
      def, mesh, x, z, y,
      hp: 150, maxHp: 150,
      alive: true,
      hostile: false,
      hitCount: 0,
      facing: Math.random() * Math.PI * 2,
      animT: Math.random() * 6.28,
      flashTimer: 0,
      vel: new THREE.Vector3(),
      atkCd: 0,
      questAccepted: false,
      questComplete: false,
      dialogueIndex: 0,
      dying: false, deathTimer: 0,
    });
  }
}

export function clearNpcs() {
  for (const n of npcs) {
    if (n.mesh) scene.remove(n.mesh);
  }
  npcs.length = 0;
}

export function getNearestNpc() {
  let best = null, bestD = Infinity;
  for (const n of npcs) {
    if (!n.alive || n.hostile) continue;
    const dx = n.x - player.pos.x, dz = n.z - player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 4 && d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function interactNpc(npc, bossDefeated, killsBefore) {
  const q = npc.def.quest;
  if (npc.questComplete) return { text: npc.def.completeDialogue, done: true };

  if (!npc.questAccepted) {
    if (npc.dialogueIndex < npc.def.dialogue.length) {
      const text = npc.def.dialogue[npc.dialogueIndex];
      npc.dialogueIndex++;
      return { text, done: false };
    }
    npc.questAccepted = true;
    return { text: npc.def.questDialogue, done: false };
  }

  if (q.type === 'kill') {
    q.progress = player.kills - (npc._killsAtAccept || 0);
    if (q.progress >= q.target) {
      npc.questComplete = true;
      q.done = true;
      applyReward(q.reward);
      return { text: npc.def.completeDialogue, done: true, reward: REWARD_LABELS[q.reward] };
    }
    return { text: npc.def.progressDialogue + ' (' + q.progress + '/' + q.target + ')', done: false };
  }
  if (q.type === 'give') {
    if (player.seeds >= q.target) {
      player.seeds -= q.target;
      npc.questComplete = true;
      q.done = true;
      applyReward(q.reward);
      return { text: npc.def.completeDialogue, done: true, reward: REWARD_LABELS[q.reward] };
    }
    return { text: npc.def.progressDialogue + ' (' + player.seeds + '/' + q.target + ')', done: false };
  }
  if (q.type === 'boss') {
    if (bossDefeated) {
      npc.questComplete = true;
      q.done = true;
      applyReward(q.reward);
      return { text: npc.def.completeDialogue, done: true, reward: REWARD_LABELS[q.reward] };
    }
    return { text: npc.def.progressDialogue, done: false };
  }
  return { text: '...', done: false };
}

const REWARD_LABELS = {
  hp: '❤️ +25 Макс. здоровье, +50 HP',
  stamina: '💪 +20 Макс. стамина, +40 стамины',
  damage: '⚔️ +1 Уровень урона',
  speed: '👟 +0.5 Скорость',
};

function applyReward(reward) {
  if (reward === 'hp') {
    player.maxHp += 25;
    player.hp = Math.min(player.hp + 50, player.maxHp);
  } else if (reward === 'stamina') {
    player.maxStamina += 20;
    player.stamina = Math.min(player.stamina + 40, player.maxStamina);
  } else if (reward === 'damage') {
    player.upgrades.damage++;
  } else if (reward === 'speed') {
    player.speed += 0.5;
  }
}

export function hitNpc(npc, dmg) {
  if (!npc.alive) return;
  npc.hp -= dmg;
  npc.flashTimer = 0.15;
  npc.hitCount++;
  const kd = new THREE.Vector3(npc.x - player.pos.x, 0, npc.z - player.pos.z).normalize();
  npc.vel.copy(kd.multiplyScalar(5));
  npc.vel.y = 2;
  spawnParticles(new THREE.Vector3(npc.x, npc.y + 1.5, npc.z), 0xff9800, 6, 4);

  if (npc.hitCount >= 3 && !npc.hostile) {
    npc.hostile = true;
  }

  if (npc.hp <= 0) {
    npc.alive = false;
    npc.dying = true;
    npc.deathTimer = 0.6;
    spawnParticles(new THREE.Vector3(npc.x, npc.y + 1.5, npc.z), npc.def.color, 15, 6);
    player.xp += 15;
  }
}

export function updateNpcs(dt) {
  for (const n of npcs) {
    if (n.dying) {
      n.deathTimer -= dt;
      const t = n.deathTimer / 0.6;
      n.mesh.rotation.x += dt * 10;
      n.mesh.position.y += dt * 2;
      n.mesh.scale.setScalar(Math.max(0, t));
      if (n.deathTimer <= 0) {
        n.dying = false;
        n.mesh.visible = false;
      }
      continue;
    }
    if (!n.alive) continue;

    n.flashTimer = Math.max(0, n.flashTimer - dt);
    n.atkCd = Math.max(0, n.atkCd - dt);
    n.animT += dt;

    n.vel.y -= 28 * dt;
    n.x += n.vel.x * dt; n.z += n.vel.z * dt; n.y += n.vel.y * dt;
    const th = getTerrainHeight(n.x, n.z);
    if (n.y < th) { n.y = th; n.vel.y = 0; }
    n.vel.x *= 0.9; n.vel.z *= 0.9;

    const dx = player.pos.x - n.x, dz = player.pos.z - n.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (n.hostile) {
      n.facing = Math.atan2(dx, dz);
      if (dist > 2) {
        n.x += (dx / dist) * 5 * dt;
        n.z += (dz / dist) * 5 * dt;
      }
      if (dist < 2.5 && n.atkCd <= 0) {
        sfxNpcAttack();
        if (player.invuln <= 0) {
          sfxHit();
          player.hp -= 12;
          player.dmgFlash = 0.2;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 5, 3);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
        n.atkCd = 1.0;
      }
      const legS = Math.sin(n.animT * 8) * 0.5;
      if (n.mesh.userData.legL) n.mesh.userData.legL.rotation.x = legS;
      if (n.mesh.userData.legR) n.mesh.userData.legR.rotation.x = -legS;
      if (n.mesh.userData.armL) n.mesh.userData.armL.rotation.x = -legS * 0.6;
      if (n.mesh.userData.armR) n.mesh.userData.armR.rotation.x = legS * 0.6;
    } else {
      if (dist < 10) n.facing = Math.atan2(dx, dz);
      const legS = Math.sin(n.animT * 2) * 0.1;
      if (n.mesh.userData.legL) n.mesh.userData.legL.rotation.x = legS;
      if (n.mesh.userData.legR) n.mesh.userData.legR.rotation.x = -legS;
    }

    n.mesh.position.set(n.x, n.y, n.z);
    n.mesh.rotation.y = n.facing;

    const bob = Math.sin(n.animT * 2) * 0.05;
    n.mesh.position.y += bob;

    if (n.mesh.userData.questMarker) {
      n.mesh.userData.questMarker.visible = !n.questComplete && !n.hostile;
      n.mesh.userData.questMarker.position.y = 3.8 + Math.sin(n.animT * 3) * 0.2;
    }

    if (n.flashTimer > 0) {
      n.mesh.userData.body.material.emissive.set(0xff0000);
      n.mesh.userData.body.material.emissiveIntensity = n.flashTimer * 5;
    } else if (n.hostile) {
      n.mesh.userData.body.material.emissive.set(0xff1744);
      n.mesh.userData.body.material.emissiveIntensity = 0.3;
    } else {
      n.mesh.userData.body.material.emissiveIntensity = 0;
    }
  }
}
