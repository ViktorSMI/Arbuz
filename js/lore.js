import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { getTerrainHeight } from './terrain.js';
import { WORLD_SIZE } from './constants.js';

// ─── Initialize player lore tracking ───
if (!player.foundLore) player.foundLore = [];

// ─── Lore Entries ───
export const LORE_ENTRIES = [
  // Biome 0 — Green Hills
  { id: 'origin', biome: 0, title: 'Начало', text: 'Когда-то фруктовый народ жил в мире. Арбузы были хранителями семян жизни. Но великая засуха привлекла полчища насекомых...' },
  { id: 'seed_power', biome: 0, title: 'Сила Семечек', text: 'Семечки — не просто валюта. Они содержат эссенцию жизни. Древние арбузы могли взращивать леса одним семечком. Это знание утеряно... или нет?' },
  { id: 'first_fall', biome: 0, title: 'Первое Падение', text: 'Хрущ не всегда был злым. Он охранял границу между мирами фруктов и насекомых. Предательство изменило его навсегда.' },
  // Biome 1 — Rat Dungeon
  { id: 'rat_queen', biome: 1, title: 'Королева Крыс', text: 'Шарлотта была принцессой подземного города. Её изгнали за эксперименты с ядами. Теперь она строит собственное королевство из отбросов.' },
  { id: 'tunnels', biome: 1, title: 'Туннели', text: 'Под этими землями — километры туннелей. Крысы вырыли их за столетия. Говорят, в самом глубоком туннеле спрятан артефакт древних.' },
  { id: 'plague', biome: 1, title: 'Чума', text: 'Яд Шарлотты не просто убивает — он превращает. Мутанты, которых ты видишь, когда-то были обычными крысами.' },
  // Biome 2 — Crow Cliffs
  { id: 'crow_army', biome: 2, title: 'Воронья Армия', text: 'Карлуша собирает армию уже десять лет. Каждый ворон — солдат. Каждый камень — крепость. Он готовится к войне, которую никто не ожидает.' },
  { id: 'sky_fortress', biome: 2, title: 'Небесная Крепость', text: 'На вершине скал — руины древней крепости. Вороны перестроили её под казармы. Отсюда видно весь мир. И весь мир видно отсюда.' },
  { id: 'feather_code', biome: 2, title: 'Код Перьев', text: 'Вороны общаются кодом из перьев. Белое перо — атака. Чёрное — отступление. Красное... красное означает смерть.' },
  // Biome 3 — Toxic Dump
  { id: 'toxic_origin', biome: 3, title: 'Источник Яда', text: 'Свалка когда-то была садом. Самым красивым садом в мире. Потом сюда начали сбрасывать отходы. Червь появился из самого ядовитого места.' },
  { id: 'mutation', biome: 3, title: 'Мутация', text: 'Токсины меняют всё. Растения светятся. Вода горит. А насекомые... насекомые становятся чем-то иным. Чем-то хуже.' },
  { id: 'cure', biome: 3, title: 'Лекарство', text: 'Где-то здесь растёт цветок, который может очистить яд. Но Червь охраняет его. Он знает, что без яда — он ничто.' },
  // Biome 4 — Military Base
  { id: 'colonel', biome: 4, title: 'Полковник', text: 'Ножов был лучшим солдатом фруктового королевства. Он защищал нас. Потом ему приказали сделать невозможное. Он отказался. И был изгнан.' },
  { id: 'weapons', biome: 4, title: 'Оружие', text: 'На базе хранится оружие, которое может уничтожить любого босса одним ударом. Но ключ к хранилищу — у самого Полковника.' },
  { id: 'betrayal', biome: 4, title: 'Предательство', text: 'Ножов не враг. Он думает, что защищает свой народ от нас. Может, если поговорить... Нет. Слишком поздно для слов.' },
  // Biome 5 — Kitchen of Hell
  { id: 'chef', biome: 5, title: 'Шеф-Повар', text: 'Жан-Пьер Дюваль — величайший повар, который когда-либо жил. Его блюда могли исцелять, давать силу, даже воскрешать. Но он сошёл с ума от совершенства.' },
  { id: 'recipe', biome: 5, title: 'Последний Рецепт', text: 'Дюваль ищет ингредиент для идеального блюда. Этот ингредиент — семечка арбуза. ТВОЯ семечка. Вот почему он хочет тебя поймать.' },
  { id: 'ending', biome: 5, title: 'Пророчество', text: 'Древние тексты говорят: когда последний арбуз победит шесть стражей, мир возродится. Семена прорастут. Сады вернутся. Ты — последний арбуз.' },
];

// ─── Active lore items in the scene ───
const activeLoreItems = [];

// Biome color themes for lore stones
const BIOME_COLORS = [
  0xfdd835, // Green Hills — gold
  0xce93d8, // Rat Dungeon — purple
  0x90caf9, // Crow Cliffs — sky blue
  0x69f0ae, // Toxic Dump — toxic green
  0xff8a65, // Military Base — orange
  0xef5350, // Kitchen of Hell — red
];

function createLoreStone(entry, biomeIndex) {
  const group = new THREE.Group();

  // Main stone — icosahedron
  const stoneGeo = new THREE.IcosahedronGeometry(0.4, 0);
  const color = BIOME_COLORS[biomeIndex] || 0xfdd835;
  const stoneMat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.y = 1.0;
  stone.castShadow = true;
  group.add(stone);

  // Base pedestal
  const baseGeo = new THREE.CylinderGeometry(0.3, 0.5, 0.3, 6);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.8,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.15;
  group.add(base);

  // Glow particles (small spheres orbiting the stone)
  const particleGroup = new THREE.Group();
  const particleGeo = new THREE.SphereGeometry(0.06, 4, 4);
  const particleMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(particleGeo, particleMat.clone());
    const angle = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(angle) * 0.7, 1.0 + Math.sin(angle * 2) * 0.3, Math.sin(angle) * 0.7);
    p.userData.orbitAngle = angle;
    p.userData.orbitSpeed = 0.8 + Math.random() * 0.4;
    p.userData.orbitRadius = 0.6 + Math.random() * 0.3;
    p.userData.yOffset = Math.random() * 0.4;
    particleGroup.add(p);
  }
  group.add(particleGroup);

  // Point light for glow effect
  const light = new THREE.PointLight(color, 0.8, 6);
  light.position.y = 1.0;
  group.add(light);

  group.userData.stone = stone;
  group.userData.particles = particleGroup;
  group.userData.light = light;
  group.userData.stoneMat = stoneMat;

  return group;
}

export function spawnLoreItems(biomeIndex) {
  clearLoreItems();

  const biomeLore = LORE_ENTRIES.filter(e => e.biome === biomeIndex);
  if (biomeLore.length === 0) return;

  for (const entry of biomeLore) {
    // Skip already found lore
    if (player.foundLore.includes(entry.id)) continue;

    // Find a valid position
    let x, z, y;
    let placed = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
      y = getTerrainHeight(x, z);
      // Must be above water and not too close to center spawn
      if (y > -2 && Math.sqrt(x * x + z * z) > 20) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      x = 30 + Math.random() * 40;
      z = 30 + Math.random() * 40;
      y = getTerrainHeight(x, z);
    }

    const mesh = createLoreStone(entry, biomeIndex);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    activeLoreItems.push({
      entry: entry,
      mesh: mesh,
      x: x,
      z: z,
      baseY: y,
      animT: Math.random() * Math.PI * 2,
      found: false,
      showTimer: 0,
    });
  }
}

export function updateLoreItems(dt) {
  for (const item of activeLoreItems) {
    if (item.found) continue;

    item.animT += dt;

    // Bob up and down
    const bobY = Math.sin(item.animT * 2) * 0.15;
    item.mesh.position.y = item.baseY + bobY;

    // Rotate stone slowly
    const stone = item.mesh.userData.stone;
    if (stone) {
      stone.rotation.y += dt * 0.5;
      stone.rotation.x = Math.sin(item.animT * 0.7) * 0.1;
    }

    // Animate particles
    const particles = item.mesh.userData.particles;
    if (particles) {
      for (const p of particles.children) {
        p.userData.orbitAngle += p.userData.orbitSpeed * dt;
        const a = p.userData.orbitAngle;
        const r = p.userData.orbitRadius;
        p.position.set(
          Math.cos(a) * r,
          1.0 + Math.sin(a * 2 + p.userData.yOffset) * 0.3,
          Math.sin(a) * r
        );
        p.material.opacity = 0.4 + Math.sin(item.animT * 3 + p.userData.orbitAngle) * 0.3;
      }
    }

    // Pulse emissive
    const mat = item.mesh.userData.stoneMat;
    if (mat) {
      mat.emissiveIntensity = 0.4 + Math.sin(item.animT * 2.5) * 0.3;
    }

    // Pulse light
    const light = item.mesh.userData.light;
    if (light) {
      light.intensity = 0.5 + Math.sin(item.animT * 2.5) * 0.3;
    }

    // Check player proximity
    const dx = item.x - player.pos.x;
    const dz = item.z - player.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 3) {
      item.found = true;
      player.foundLore.push(item.entry.id);

      // Show lore popup
      showLorePopup(item.entry);

      // Fade out the stone (make it collected)
      fadeOutLoreItem(item);
    }
  }
}

function showLorePopup(entry) {
  let popup = document.getElementById('lore-popup');
  if (!popup) {
    // Create popup element if it doesn't exist
    popup = document.createElement('div');
    popup.id = 'lore-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(0,0,0,0.92);border:2px solid #fdd835;border-radius:12px;' +
      'padding:28px 36px;max-width:500px;color:#fff;font-family:sans-serif;' +
      'z-index:1000;display:none;text-align:center;pointer-events:none;' +
      'box-shadow:0 0 30px rgba(253,216,53,0.3);';

    const title = document.createElement('div');
    title.id = 'lore-popup-title';
    title.style.cssText = 'font-size:20px;font-weight:bold;color:#fdd835;margin-bottom:12px;';
    popup.appendChild(title);

    const text = document.createElement('div');
    text.id = 'lore-popup-text';
    text.style.cssText = 'font-size:14px;line-height:1.6;color:#ddd;';
    popup.appendChild(text);

    const counter = document.createElement('div');
    counter.id = 'lore-popup-counter';
    counter.style.cssText = 'font-size:12px;color:#888;margin-top:14px;';
    popup.appendChild(counter);

    document.body.appendChild(popup);
  }

  const titleEl = document.getElementById('lore-popup-title');
  const textEl = document.getElementById('lore-popup-text');
  const counterEl = document.getElementById('lore-popup-counter');

  if (titleEl) titleEl.textContent = entry.title;
  if (textEl) textEl.textContent = entry.text;
  if (counterEl) counterEl.textContent = 'Записи: ' + player.foundLore.length + ' / ' + LORE_ENTRIES.length;

  popup.style.display = 'block';
  popup.style.opacity = '0';
  popup.style.transition = 'opacity 0.5s';
  // Force reflow then fade in
  popup.offsetHeight;
  popup.style.opacity = '1';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    popup.style.opacity = '0';
    setTimeout(() => {
      popup.style.display = 'none';
    }, 500);
  }, 5000);
}

function fadeOutLoreItem(item) {
  const mesh = item.mesh;
  let fadeTimer = 1.0;

  function doFade() {
    fadeTimer -= 0.016;
    if (fadeTimer <= 0) {
      scene.remove(mesh);
      return;
    }
    const scale = Math.max(0, fadeTimer);
    mesh.scale.setScalar(scale);
    mesh.position.y += 0.03;
    if (mesh.userData.stoneMat) {
      mesh.userData.stoneMat.emissiveIntensity = fadeTimer * 2;
    }
    if (mesh.userData.light) {
      mesh.userData.light.intensity = fadeTimer * 2;
    }
    requestAnimationFrame(doFade);
  }
  doFade();
}

export function clearLoreItems() {
  for (const item of activeLoreItems) {
    if (item.mesh) scene.remove(item.mesh);
  }
  activeLoreItems.length = 0;
}

export function getFoundLoreCount() {
  return player.foundLore.length;
}
