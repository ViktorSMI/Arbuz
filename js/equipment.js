import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { getTerrainHeight } from './terrain.js';
import { spawnParticles } from './particles.js';

export const SWORDS = [
  { id: 'basic', name: 'Обычный меч', dmgMult: 1.0, element: null, color: 0x1a1a1a, rarity: 'common' },
  { id: 'fire', name: 'Огненный клинок', dmgMult: 1.25, element: 'fire', color: 0xff5722, rarity: 'rare', effect: 'burn' },
  { id: 'ice', name: 'Ледяной клинок', dmgMult: 1.15, element: 'ice', color: 0x29b6f6, rarity: 'rare', effect: 'slow' },
  { id: 'poison', name: 'Ядовитый клинок', dmgMult: 1.2, element: 'poison', color: 0x76ff03, rarity: 'rare', effect: 'dot' },
  { id: 'crystal', name: 'Кристальный клинок', dmgMult: 1.4, element: null, color: 0xe040fb, rarity: 'epic' },
  { id: 'boss', name: 'Клинок Арбузиллы', dmgMult: 1.6, element: 'all', color: 0xfdd835, rarity: 'legendary' },
];

export const ARMORS = [
  { id: 'none', name: 'Без брони', defMult: 1.0, color: null, rarity: 'common' },
  { id: 'leather', name: 'Кожаная броня', defMult: 0.85, color: 0x8d6e63, rarity: 'common' },
  { id: 'iron', name: 'Железная броня', defMult: 0.7, color: 0x9e9e9e, rarity: 'rare' },
  { id: 'crystal', name: 'Кристальная броня', defMult: 0.55, color: 0xe040fb, rarity: 'epic' },
];

const RARITY_GLOW = {
  common: 0.1,
  rare: 0.3,
  epic: 0.5,
  legendary: 0.8
};

const lootDrops = [];

function createLootMesh(itemType, itemDef) {
  let geo, mat;
  const color = itemDef.color || 0xaaaaaa;
  const glow = RARITY_GLOW[itemDef.rarity] || 0.1;

  if (itemType === 'sword') {
    geo = new THREE.BoxGeometry(0.1, 1.5, 0.3);
  } else {
    geo = new THREE.SphereGeometry(0.5, 12, 12);
  }

  mat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: glow,
    metalness: 0.6,
    roughness: 0.3
  });

  return new THREE.Mesh(geo, mat);
}

function findItemDef(itemType, itemId) {
  const list = itemType === 'sword' ? SWORDS : ARMORS;
  return list.find(it => it.id === itemId) || list[0];
}

export function spawnLootDrop(x, y, z, itemType, itemId) {
  const itemDef = findItemDef(itemType, itemId);
  const mesh = createLootMesh(itemType, itemDef);
  const terrainY = getTerrainHeight(x, z);
  mesh.position.set(x, terrainY + 1.5, z);
  scene.add(mesh);

  const drop = {
    mesh,
    itemType,
    itemId,
    itemDef,
    baseY: terrainY + 1.5,
    time: 0
  };
  lootDrops.push(drop);
}

export function updateLootDrops(dt) {
  const playerPos = player.pos;

  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const drop = lootDrops[i];
    drop.time += dt;

    drop.mesh.position.y = drop.baseY + Math.sin(drop.time * 2) * 0.3;
    drop.mesh.rotation.y += dt * 1.5;

    const dx = playerPos.x - drop.mesh.position.x;
    const dz = playerPos.z - drop.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.5) {
      equipItem(drop.itemType, drop.itemId);

      spawnParticles(
        drop.mesh.position.clone(),
        drop.itemDef.color || 0xffffff,
        15, 5
      );

      scene.remove(drop.mesh);
      drop.mesh.geometry.dispose();
      drop.mesh.material.dispose();
      lootDrops.splice(i, 1);
    }
  }
}

export function clearLootDrops() {
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const drop = lootDrops[i];
    scene.remove(drop.mesh);
    drop.mesh.geometry.dispose();
    drop.mesh.material.dispose();
  }
  lootDrops.length = 0;
}

export function rollLootDrop(x, y, z) {
  if (Math.random() > 0.15) return;

  const isSword = Math.random() < 0.5;
  const itemType = isSword ? 'sword' : 'armor';
  const list = isSword ? SWORDS : ARMORS;

  const droppable = list.filter(it => it.id !== 'basic' && it.id !== 'none' && it.id !== 'boss');
  if (droppable.length === 0) return;

  const weights = droppable.map(it => {
    switch (it.rarity) {
      case 'common': return 40;
      case 'rare': return 30;
      case 'epic': return 10;
      case 'legendary': return 2;
      default: return 20;
    }
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let chosen = droppable[0];

  for (let i = 0; i < droppable.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = droppable[i];
      break;
    }
  }

  spawnLootDrop(x, y, z, itemType, chosen.id);
}

export function getEquippedSword() {
  const id = (player.equipment && player.equipment.sword) || 'basic';
  return SWORDS.find(s => s.id === id) || SWORDS[0];
}

export function getEquippedArmor() {
  const id = (player.equipment && player.equipment.armor) || 'none';
  return ARMORS.find(a => a.id === id) || ARMORS[0];
}

export function getDmgMultiplier() {
  return getEquippedSword().dmgMult;
}

export function getDefMultiplier() {
  return getEquippedArmor().defMult;
}

export function equipItem(type, id) {
  if (!player.equipment) {
    player.equipment = { sword: 'basic', armor: 'none' };
  }
  if (!player.inventory) {
    player.inventory = [];
  }

  const oldId = player.equipment[type];

  if (oldId && oldId !== 'basic' && oldId !== 'none') {
    player.inventory.push({ type, id: oldId });
  }

  player.equipment[type] = id;
}
