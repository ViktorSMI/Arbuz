import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { getTerrainHeight } from './terrain.js';
import { spawnParticles } from './particles.js';
import { WORLD_SIZE, WATER_LEVEL } from './constants.js';

// ─── State ───────────────────────────────────────────────────────────
export const caravans = [];
let playerReputation = 0;

// ─── Goods catalog ──────────────────────────────────────────────────
const GOODS_CATALOG = [
  {
    name: 'Железный меч',
    type: 'sword',
    price: 25,
    description: 'Урон +3',
    apply() { player.equipment.sword = 'iron'; player.upgrades.damage += 3; },
  },
  {
    name: 'Стальной меч',
    type: 'sword',
    price: 50,
    description: 'Урон +5',
    apply() { player.equipment.sword = 'steel'; player.upgrades.damage += 5; },
  },
  {
    name: 'Кожаная броня',
    type: 'armor',
    price: 20,
    description: 'Защита +1',
    apply() { player.equipment.armor = 'leather'; },
  },
  {
    name: 'Кольчуга',
    type: 'armor',
    price: 45,
    description: 'Защита +3',
    apply() { player.equipment.armor = 'chainmail'; },
  },
  {
    name: 'Зелье здоровья',
    type: 'hp_potion',
    price: 10,
    description: 'Восстанавливает 50 HP',
    apply() { player.hp = Math.min(player.hp + 50, player.maxHp); },
  },
  {
    name: 'Зелье стамины',
    type: 'stamina_potion',
    price: 8,
    description: 'Полностью восстанавливает стамину',
    apply() { player.stamina = player.maxStamina; },
  },
  {
    name: 'Мешок семечек',
    type: 'seeds',
    price: 12,
    description: 'Даёт 20 семечек',
    apply() { player.seeds += 20; },
  },
  {
    name: 'Эликсир жизни',
    type: 'hp_potion',
    price: 30,
    description: '+25 макс. HP',
    apply() { player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); },
  },
  {
    name: 'Эликсир силы',
    type: 'stamina_potion',
    price: 35,
    description: '+15 макс. стамина',
    apply() { player.maxStamina += 15; player.stamina = Math.min(player.stamina + 15, player.maxStamina); },
  },
];

// ─── Merchant mesh creation ─────────────────────────────────────────
function createMerchantMesh() {
  const g = new THREE.Group();
  const bodyColor = 0x6d4c41;

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.3, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;

  // Head
  const headGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.5 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.0;
  head.castShadow = true;
  g.add(head);

  // Merchant hat (wide brim)
  const brimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 10);
  const brimMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.4 });
  const brim = new THREE.Mesh(brimGeo, brimMat);
  brim.position.y = 2.35;
  g.add(brim);
  const topGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.35, 8);
  const top = new THREE.Mesh(topGeo, brimMat);
  top.position.y = 2.55;
  g.add(top);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
    eye.position.set(s * 0.13, 2.07, 0.28);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), pupilMat);
    pupil.position.set(s * 0.13, 2.07, 0.33);
    g.add(pupil);
  }

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 5);
  const armMat = new THREE.MeshStandardMaterial({ color: bodyColor });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.55, 1.2, 0);
  armL.rotation.z = 0.3;
  g.add(armL);
  g.userData.armL = armL;
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.55, 1.2, 0);
  armR.rotation.z = -0.3;
  g.add(armR);
  g.userData.armR = armR;

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.2, 0);
  g.add(legL);
  g.userData.legL = legL;
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.2, 0);
  g.add(legR);
  g.userData.legR = legR;

  return g;
}

// ─── Cart mesh creation ─────────────────────────────────────────────
function createCartMesh() {
  const g = new THREE.Group();

  // Cart body (wooden box)
  const cartBodyGeo = new THREE.BoxGeometry(2.0, 1.0, 1.2);
  const cartBodyMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
  const cartBody = new THREE.Mesh(cartBodyGeo, cartBodyMat);
  cartBody.position.y = 1.0;
  cartBody.castShadow = true;
  g.add(cartBody);

  // Cart cloth canopy
  const clothGeo = new THREE.BoxGeometry(2.2, 0.1, 1.4);
  const clothColors = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825];
  const clothColor = clothColors[Math.floor(Math.random() * clothColors.length)];
  const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.9 });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.y = 1.55;
  g.add(cloth);

  // Support poles for canopy
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4),
        poleMat
      );
      pole.position.set(sx * 0.85, 1.8, sz * 0.5);
      g.add(pole);
    }
  }

  // Canopy top (arched)
  const canopyGeo = new THREE.BoxGeometry(2.2, 0.05, 1.4);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: clothColor,
    roughness: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 2.1;
  g.add(canopy);

  // Wheels (4 cylinders)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
  const wheelPositions = [
    [-0.7, 0.35, 0.65],
    [0.7, 0.35, 0.65],
    [-0.7, 0.35, -0.65],
    [0.7, 0.35, -0.65],
  ];
  const wheels = [];
  for (const wp of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wp[0], wp[1], wp[2]);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  g.userData.wheels = wheels;

  // Spoke detail on wheels
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  for (const wheel of wheels) {
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.6, 3),
        spokeMat
      );
      spoke.rotation.z = (i * Math.PI) / 4;
      spoke.position.copy(wheel.position);
      g.add(spoke);
    }
  }

  // Shadow
  const shGeo = new THREE.PlaneGeometry(2.5, 1.5);
  const shMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.2,
  });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  g.add(shadow);

  return g;
}

// ─── Random goods generation ────────────────────────────────────────
function generateGoods() {
  const count = 2 + Math.floor(Math.random() * 2); // 2-3 items
  const available = [...GOODS_CATALOG];
  const goods = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    const item = available.splice(idx, 1)[0];
    goods.push({
      name: item.name,
      type: item.type,
      price: item.price,
      description: item.description,
      apply: item.apply,
      sold: false,
    });
  }
  return goods;
}

// ─── Random valid position on land ──────────────────────────────────
function randomLandPosition() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y > WATER_LEVEL + 1.0 && Math.sqrt(x * x + z * z) > 30) {
      return { x, z, y };
    }
  }
  // Fallback
  return { x: 30, z: 30, y: getTerrainHeight(30, 30) };
}

// ─── Pick a new waypoint ────────────────────────────────────────────
function pickWaypoint(cx, cz) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 40;
    const tx = cx + Math.cos(angle) * dist;
    const tz = cz + Math.sin(angle) * dist;
    // Clamp to world bounds
    const clampedX = Math.max(-WORLD_SIZE * 0.4, Math.min(WORLD_SIZE * 0.4, tx));
    const clampedZ = Math.max(-WORLD_SIZE * 0.4, Math.min(WORLD_SIZE * 0.4, tz));
    const ty = getTerrainHeight(clampedX, clampedZ);
    if (ty > WATER_LEVEL + 1.0) {
      return { x: clampedX, z: clampedZ };
    }
  }
  return { x: cx + 10, z: cz + 10 };
}

// ─── Spawn caravans for a biome ─────────────────────────────────────
export function spawnCaravans(biomeIndex) {
  const count = 1 + Math.floor(Math.random() * 2); // 1-2 caravans
  for (let i = 0; i < count; i++) {
    const pos = randomLandPosition();
    const waypoint = pickWaypoint(pos.x, pos.z);

    // Create main group
    const group = new THREE.Group();

    // Create cart
    const cart = createCartMesh();
    group.add(cart);

    // Create 1-2 merchants walking beside the cart
    const merchantCount = 1 + Math.floor(Math.random() * 2);
    const merchants = [];
    for (let m = 0; m < merchantCount; m++) {
      const mMesh = createMerchantMesh();
      const offsetX = (m === 0) ? -1.5 : 1.5;
      mMesh.position.set(offsetX, 0, 0);
      group.add(mMesh);
      merchants.push({
        hp: 100,
        maxHp: 100,
        alive: true,
        mesh: mMesh,
        offsetX,
        animT: Math.random() * 6.28,
        flashTimer: 0,
        atkCd: 0,
      });
    }

    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);

    caravans.push({
      mesh: group,
      cart,
      x: pos.x,
      z: pos.z,
      y: pos.y,
      targetX: waypoint.x,
      targetZ: waypoint.z,
      speed: 2,
      state: 'moving',
      stopTimer: 0,
      merchants,
      goods: generateGoods(),
      raided: false,
      facing: 0,
      animT: 0,
    });
  }
}

// ─── Get nearest caravan within interaction range ───────────────────
export function getNearestCaravan() {
  let best = null;
  let bestD = Infinity;
  for (const c of caravans) {
    if (c.raided) continue;
    const allDead = c.merchants.every(m => !m.alive);
    if (allDead) continue;
    const dx = c.x - player.pos.x;
    const dz = c.z - player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 5 && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// ─── Raid a caravan (make merchants hostile) ────────────────────────
export function raidCaravan(caravan) {
  if (caravan.raided) return;
  caravan.raided = true;
  caravan.state = 'raided';
  playerReputation -= 20;

  // Make merchants hostile (indicated by red emissive)
  for (const m of caravan.merchants) {
    if (m.alive && m.mesh.userData.body) {
      m.mesh.userData.body.material.emissive.set(0xff1744);
      m.mesh.userData.body.material.emissiveIntensity = 0.4;
    }
  }
}

// ─── Get caravan goods for shop UI ──────────────────────────────────
export function getCaravanGoods(caravan) {
  return caravan.goods.filter(g => !g.sold);
}

// ─── Buy an item from a caravan ─────────────────────────────────────
export function buyFromCaravan(caravan, goodIndex) {
  const available = caravan.goods.filter(g => !g.sold);
  if (goodIndex < 0 || goodIndex >= available.length) return { success: false, reason: 'Товар не найден' };

  const item = available[goodIndex];
  if (player.seeds < item.price) {
    return { success: false, reason: 'Не хватает семечек! (' + player.seeds + '/' + item.price + ')' };
  }

  player.seeds -= item.price;
  item.apply();
  item.sold = true;

  spawnParticles(player.pos.clone().setY(player.pos.y + 1.5), 0xfdd835, 8, 3);

  return { success: true, name: item.name, description: item.description };
}

// ─── Hit a merchant (called from combat system) ─────────────────────
export function hitMerchant(caravan, merchantIndex, dmg) {
  const m = caravan.merchants[merchantIndex];
  if (!m || !m.alive) return;

  m.hp -= dmg;
  m.flashTimer = 0.15;

  // Knockback
  const kd = new THREE.Vector3(
    caravan.x - player.pos.x, 0, caravan.z - player.pos.z
  ).normalize();
  spawnParticles(
    new THREE.Vector3(
      caravan.x + m.offsetX,
      caravan.y + 1.5,
      caravan.z
    ),
    0xff9800, 5, 4
  );

  if (m.hp <= 0) {
    m.alive = false;
    m.mesh.visible = false;
    spawnParticles(
      new THREE.Vector3(caravan.x + m.offsetX, caravan.y + 1, caravan.z),
      0x6d4c41, 12, 5
    );

    // Check if all merchants dead — drop all goods
    const allDead = caravan.merchants.every(mr => !mr.alive);
    if (allDead) {
      // Player loots everything
      for (const g of caravan.goods) {
        if (!g.sold) {
          g.apply();
          g.sold = true;
        }
      }
      spawnParticles(
        new THREE.Vector3(caravan.x, caravan.y + 1.5, caravan.z),
        0xfdd835, 20, 5
      );
      // Bonus seeds from raiding
      player.seeds += 10 + Math.floor(Math.random() * 10);

      // Show loot message
      const el = document.getElementById('notification');
      if (el) {
        el.textContent = 'Караван разграблен! Все товары получены.';
        el.style.display = 'block';
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 2500);
        setTimeout(() => { el.style.display = 'none'; }, 3000);
      }
    }
  }

  // Auto-raid if not already
  if (!caravan.raided) {
    raidCaravan(caravan);
  }
}

// ─── Get reputation ─────────────────────────────────────────────────
export function getReputation() {
  return playerReputation;
}

// ─── Update all caravans ────────────────────────────────────────────
export function updateCaravans(dt) {
  for (const c of caravans) {
    c.animT += dt;

    // Check if all merchants dead
    const allDead = c.merchants.every(m => !m.alive);

    // ── Fleeing behavior (low reputation) ──
    if (!allDead && !c.raided && playerReputation < -30) {
      const dxP = player.pos.x - c.x;
      const dzP = player.pos.z - c.z;
      const distP = Math.sqrt(dxP * dxP + dzP * dzP);
      if (distP < 20) {
        c.state = 'fleeing';
      }
    }

    // ── State machine ──
    if (c.state === 'moving') {
      const dxT = c.targetX - c.x;
      const dzT = c.targetZ - c.z;
      const distT = Math.sqrt(dxT * dxT + dzT * dzT);

      if (distT < 2) {
        // Arrived at waypoint, stop
        c.state = 'stopped';
        c.stopTimer = 10 + Math.random() * 5;
      } else {
        // Move toward waypoint
        const nx = dxT / distT;
        const nz = dzT / distT;
        const nextX = c.x + nx * c.speed * dt;
        const nextZ = c.z + nz * c.speed * dt;
        const nextY = getTerrainHeight(nextX, nextZ);

        // Avoid water
        if (nextY > WATER_LEVEL + 0.5) {
          c.x = nextX;
          c.z = nextZ;
          c.y = nextY;
        } else {
          // Pick new waypoint
          const wp = pickWaypoint(c.x, c.z);
          c.targetX = wp.x;
          c.targetZ = wp.z;
        }

        c.facing = Math.atan2(nx, nz);
      }

      // Animate merchants walking
      animateMerchants(c, dt, true);
      animateWheels(c, dt);

    } else if (c.state === 'stopped') {
      c.stopTimer -= dt;
      if (c.stopTimer <= 0) {
        // Pick new waypoint and resume
        const wp = pickWaypoint(c.x, c.z);
        c.targetX = wp.x;
        c.targetZ = wp.z;
        c.state = 'moving';
      }
      // Idle animation
      animateMerchants(c, dt, false);

    } else if (c.state === 'fleeing') {
      const dxP = player.pos.x - c.x;
      const dzP = player.pos.z - c.z;
      const distP = Math.sqrt(dxP * dxP + dzP * dzP);

      if (distP > 30) {
        // Far enough, resume normal
        c.state = 'moving';
        const wp = pickWaypoint(c.x, c.z);
        c.targetX = wp.x;
        c.targetZ = wp.z;
      } else {
        // Flee away from player
        const nx = -dxP / (distP || 1);
        const nz = -dzP / (distP || 1);
        const fleeSpeed = c.speed * 2;
        const nextX = c.x + nx * fleeSpeed * dt;
        const nextZ = c.z + nz * fleeSpeed * dt;
        const nextY = getTerrainHeight(nextX, nextZ);

        if (nextY > WATER_LEVEL + 0.5) {
          c.x = nextX;
          c.z = nextZ;
          c.y = nextY;
        }
        c.facing = Math.atan2(nx, nz);
      }

      animateMerchants(c, dt, true);
      animateWheels(c, dt);

    } else if (c.state === 'raided') {
      // Hostile merchants chase and attack player
      for (const m of c.merchants) {
        if (!m.alive) continue;

        m.flashTimer = Math.max(0, m.flashTimer - dt);
        m.atkCd = Math.max(0, m.atkCd - dt);
        m.animT += dt;

        const mx = c.x + m.offsetX;
        const mz = c.z;
        const dxP = player.pos.x - mx;
        const dzP = player.pos.z - mz;
        const distP = Math.sqrt(dxP * dxP + dzP * dzP);

        if (distP > 2) {
          // Move toward player
          const nx = dxP / distP;
          const nz = dzP / distP;
          m.offsetX += nx * 4 * dt;
          c.z += nz * 4 * dt;
          c.y = getTerrainHeight(c.x, c.z);
        }

        // Attack player
        if (distP < 2.5 && m.atkCd <= 0) {
          if (player.invuln <= 0) {
            player.hp -= 10;
            player.dmgFlash = 0.2;
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 5, 3);
            if (player.hp <= 0) {
              player.alive = false;
              const deathEl = document.getElementById('death-screen');
              if (deathEl) deathEl.style.display = 'flex';
              document.exitPointerLock();
            }
          }
          m.atkCd = 1.2;
        }

        // Walking animation
        const legS = Math.sin(m.animT * 8) * 0.5;
        if (m.mesh.userData.legL) m.mesh.userData.legL.rotation.x = legS;
        if (m.mesh.userData.legR) m.mesh.userData.legR.rotation.x = -legS;
        if (m.mesh.userData.armL) m.mesh.userData.armL.rotation.x = -legS * 0.6;
        if (m.mesh.userData.armR) m.mesh.userData.armR.rotation.x = legS * 0.6;

        // Flash on damage
        if (m.flashTimer > 0 && m.mesh.userData.body) {
          m.mesh.userData.body.material.emissive.set(0xff0000);
          m.mesh.userData.body.material.emissiveIntensity = m.flashTimer * 5;
        } else if (m.mesh.userData.body) {
          m.mesh.userData.body.material.emissive.set(0xff1744);
          m.mesh.userData.body.material.emissiveIntensity = 0.3;
        }

        // Update merchant mesh position relative to cart
        m.mesh.position.set(m.offsetX, 0, 0);
      }
    }

    // ── Update group position ──
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.facing;
  }
}

// ─── Animate merchant walking/idle ──────────────────────────────────
function animateMerchants(caravan, dt, walking) {
  for (const m of caravan.merchants) {
    if (!m.alive) continue;
    m.animT += dt;

    if (walking) {
      const legS = Math.sin(m.animT * 6) * 0.4;
      if (m.mesh.userData.legL) m.mesh.userData.legL.rotation.x = legS;
      if (m.mesh.userData.legR) m.mesh.userData.legR.rotation.x = -legS;
      if (m.mesh.userData.armL) m.mesh.userData.armL.rotation.x = -legS * 0.5;
      if (m.mesh.userData.armR) m.mesh.userData.armR.rotation.x = legS * 0.5;
    } else {
      const legS = Math.sin(m.animT * 2) * 0.08;
      if (m.mesh.userData.legL) m.mesh.userData.legL.rotation.x = legS;
      if (m.mesh.userData.legR) m.mesh.userData.legR.rotation.x = -legS;
      if (m.mesh.userData.armL) m.mesh.userData.armL.rotation.x = 0;
      if (m.mesh.userData.armR) m.mesh.userData.armR.rotation.x = 0;
    }
  }
}

// ─── Animate cart wheels ────────────────────────────────────────────
function animateWheels(caravan, dt) {
  if (!caravan.cart.userData.wheels) return;
  for (const wheel of caravan.cart.userData.wheels) {
    wheel.rotation.z += caravan.speed * dt * 2;
  }
}

// ─── Clear all caravans ─────────────────────────────────────────────
export function clearCaravans() {
  for (const c of caravans) {
    if (c.mesh) scene.remove(c.mesh);
  }
  caravans.length = 0;
}

// ─── Reset reputation (on game restart) ─────────────────────────────
export function resetReputation() {
  playerReputation = 0;
}
