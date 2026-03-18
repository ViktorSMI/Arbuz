import { player } from './player.js';
import { spawnParticles } from './particles.js';
import * as THREE from 'three';

// Система воровства — подкрадываешься сзади к НПС и воруешь
// Шанс успеха зависит от: расстояния, угла подхода (сзади лучше), репутации

export function canSteal(npc) {
  if (!npc || !npc.alive || npc.hostile) return false;
  const dx = npc.x - player.pos.x;
  const dz = npc.z - player.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist < 3;
}

export function getStealChance(npc) {
  const dx = npc.x - player.pos.x;
  const dz = npc.z - player.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Базовый шанс
  let chance = 0.4;

  // Бонус за подход сзади
  const approachAngle = Math.atan2(dx, dz);
  const npcFacing = npc.facing || 0;
  let angleDiff = Math.abs(approachAngle - npcFacing);
  if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
  // Если сзади (angleDiff близко к PI) — бонус
  const behindBonus = angleDiff / Math.PI; // 0 = спереди, 1 = сзади
  chance += behindBonus * 0.3;

  // Бонус от уровня
  chance += (player.level - 1) * 0.02;

  // Штраф от низкой репутации (все настороже)
  if (player.reputation < -20) chance -= 0.15;

  // Бонус от высокого убийств (запугивание)
  if (player.kills > 50) chance += 0.05;

  return Math.max(0.05, Math.min(0.85, chance));
}

export function attemptSteal(npc) {
  const chance = getStealChance(npc);
  const success = Math.random() < chance;

  const result = {
    success,
    chance: Math.round(chance * 100),
    loot: null,
    message: '',
  };

  if (success) {
    // Случайный лут
    const roll = Math.random();
    if (roll < 0.4) {
      // Семечки
      const amount = 3 + Math.floor(Math.random() * 10);
      player.seeds += amount;
      result.loot = { type: 'seeds', amount };
      result.message = `Украдено ${amount} семечек!`;
    } else if (roll < 0.7) {
      // Лечение
      const heal = 15 + Math.floor(Math.random() * 20);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      result.loot = { type: 'heal', amount: heal };
      result.message = `Украдена еда (+${heal} HP)!`;
    } else if (roll < 0.9) {
      // XP
      const xp = 10 + Math.floor(Math.random() * 15);
      player.xp += xp;
      result.loot = { type: 'xp', amount: xp };
      result.message = `Украден свиток опыта (+${xp} XP)!`;
    } else {
      // Редкий предмет
      result.loot = { type: 'item', id: 'seeds_big' };
      player.seeds += 25;
      result.message = 'Украден мешок семечек (+25)!';
    }

    // Небольшая потеря репутации даже при успехе
    player.reputation -= 3;

    // Зелёные частицы успеха
    spawnParticles(
      new THREE.Vector3(npc.x, npc.y + 1.5, npc.z),
      0x4caf50, 8, 4
    );
  } else {
    // Провал!
    result.message = 'Вас поймали за руку!';

    // НПС становится враждебным
    npc.hostile = true;
    npc.hitCount = 10; // чтобы не сбросилось

    // Большая потеря репутации
    player.reputation -= 10;

    // Красные частицы провала
    spawnParticles(
      new THREE.Vector3(npc.x, npc.y + 2, npc.z),
      0xff1744, 12, 6
    );
  }

  return result;
}

// Показать результат воровства как уведомление
export function showStealResult(result) {
  const el = document.getElementById('steal-notification');
  if (!el) {
    // Создаём элемент на лету
    const div = document.createElement('div');
    div.id = 'steal-notification';
    div.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);z-index:200;pointer-events:none;font-size:1.3rem;font-weight:bold;text-shadow:0 2px 8px #000;transition:opacity 0.5s;text-align:center';
    document.body.appendChild(div);
  }
  const notif = document.getElementById('steal-notification');
  notif.style.color = result.success ? '#4caf50' : '#ff1744';
  notif.textContent = result.message;
  notif.style.opacity = '1';
  setTimeout(() => { notif.style.opacity = '0'; }, 2000);
}
