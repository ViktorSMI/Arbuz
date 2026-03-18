import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { enemies } from './enemies.js';
import { bossState } from './boss.js';
import { getTerrainHeight } from './terrain.js';
import { spawnParticles } from './particles.js';
import { WATER_LEVEL } from './constants.js';
import { npcs } from './npc.js';

// ─── State ───────────────────────────────────────────────────────────
export const companions = [];
export const MAX_COMPANIONS = 2;

// ─── Companion definitions (keyed by NPC name) ─────────────────────
const COMPANION_DEFS = {
  'Старый Тыквос':     { hp: 120, dmg: 15, speed: 5,   color: 0xff8f00, attackRange: 3,   ranged: false },
  'Грибочек':          { hp: 80,  dmg: 20, speed: 6,   color: 0xef5350, attackRange: 2.5, ranged: false },
  'Морковка-ведунья':  { hp: 100, dmg: 12, speed: 5.5, color: 0xff6d00, attackRange: 8,   ranged: true  },
  'Баклажан-торговец': { hp: 150, dmg: 10, speed: 4,   color: 0x4a148c, attackRange: 3,   ranged: false },
  'Мудрый Кактус':     { hp: 90,  dmg: 18, speed: 5,   color: 0x2e7d32, attackRange: 3,   ranged: false },
};

// ─── Death messages ─────────────────────────────────────────────────
const DEATH_MESSAGES = {
  'Старый Тыквос':     'Старый Тыквос пал в бою!',
  'Грибочек':          'Грибочек погиб!',
  'Морковка-ведунья':  'Морковка-ведунья пала в бою!',
  'Баклажан-торговец': 'Баклажан-торговец погиб!',
  'Мудрый Кактус':     'Мудрый Кактус пал в бою!',
};

// ─── Mesh creation ──────────────────────────────────────────────────
function createCompanionMesh(name, color) {
  const g = new THREE.Group();

  // Body (slightly smaller than NPC)
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.3, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;

  // Head
  const headGeo = new THREE.SphereGeometry(0.36, 10, 8);
  const headMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.05;
  head.castShadow = true;
  g.add(head);

  // Hat
  const hatGeo = new THREE.ConeGeometry(0.4, 0.55, 8);
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.4 });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 2.55;
  hat.castShadow = true;
  g.add(hat);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let s = -1; s <= 1; s += 2) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
    eye.position.set(s * 0.14, 2.12, 0.3);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), pupilMat);
    pupil.position.set(s * 0.14, 2.12, 0.36);
    g.add(pupil);
  }

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 5);
  const armMat = new THREE.MeshStandardMaterial({ color });
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
  const legMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7).getHex() });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.2, 0);
  g.add(legL);
  g.userData.legL = legL;
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.2, 0);
  g.add(legR);
  g.userData.legR = legR;

  // Green friendly marker floating above
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    emissive: 0x00e676,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.85,
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), markerMat);
  marker.position.y = 3.1;
  g.add(marker);
  g.userData.friendlyMarker = marker;

  // Shadow
  const sh = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 10),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.05;
  g.add(sh);

  return g;
}

// ─── Ranged projectile mesh ─────────────────────────────────────────
function createProjectileMesh(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat);
  g.add(sphere);
  return g;
}

// Active projectiles fired by ranged companions
const projectiles = [];

// ─── Hire a companion ───────────────────────────────────────────────
export function hireCompanion(npcName) {
  if (companions.length >= MAX_COMPANIONS) return false;

  const def = COMPANION_DEFS[npcName];
  if (!def) return false;

  // Remove the NPC from the world
  for (const n of npcs) {
    if (n.def.name === npcName && n.alive) {
      n.alive = false;
      n.mesh.visible = false;
      break;
    }
  }

  const mesh = createCompanionMesh(npcName, def.color);
  // Spawn near player
  const spawnAngle = Math.random() * Math.PI * 2;
  const sx = player.pos.x + Math.cos(spawnAngle) * 3;
  const sz = player.pos.z + Math.sin(spawnAngle) * 3;
  const sy = getTerrainHeight(sx, sz);
  mesh.position.set(sx, sy, sz);
  scene.add(mesh);

  companions.push({
    mesh,
    name: npcName,
    x: sx,
    y: sy,
    z: sz,
    hp: def.hp,
    maxHp: def.hp,
    dmg: def.dmg,
    speed: def.speed,
    alive: true,
    state: 'follow',
    target: null,
    atkCd: 0,
    facing: 0,
    vel: new THREE.Vector3(),
    animT: Math.random() * 6.28,
    color: def.color,
    attackRange: def.attackRange,
    ranged: !!def.ranged,
    flashTimer: 0,
    dying: false,
    deathTimer: 0,
  });

  return true;
}

// ─── Dismiss a companion ────────────────────────────────────────────
export function dismissCompanion(index) {
  if (index < 0 || index >= companions.length) return;
  const c = companions[index];
  if (c.mesh) scene.remove(c.mesh);
  companions.splice(index, 1);
}

// ─── Clear all companions ───────────────────────────────────────────
export function clearCompanions() {
  for (const c of companions) {
    if (c.mesh) scene.remove(c.mesh);
  }
  companions.length = 0;
  // Clear projectiles too
  for (const p of projectiles) {
    if (p.mesh) scene.remove(p.mesh);
  }
  projectiles.length = 0;
}

// ─── Utility ────────────────────────────────────────────────────────
export function companionCount() {
  return companions.length;
}

export function getCompanions() {
  return companions;
}

// ─── Find nearest alive enemy within radius of a point ──────────────
function findNearestEnemy(px, pz, maxRange) {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - px;
    const dz = e.z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < maxRange && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  // Also consider boss
  if (bossState && bossState.alive && bossState.mesh) {
    const bdx = bossState.x - px;
    const bdz = bossState.z - pz;
    const bd = Math.sqrt(bdx * bdx + bdz * bdz);
    if (bd < maxRange && bd < bestD) {
      best = bossState;
    }
  }
  return best;
}

// ─── Show death message ─────────────────────────────────────────────
function showCompanionDeathMessage(name) {
  const msg = DEATH_MESSAGES[name] || (name + ' погиб!');
  // Try to display in the game's notification area if it exists
  const el = document.getElementById('notification');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  } else {
    console.log(msg);
  }
}

// ─── Update all companions ──────────────────────────────────────────
export function updateCompanions(dt) {
  const GRAVITY = 28;
  const FOLLOW_DIST = 5;
  const TELEPORT_DIST = 30;
  const AGGRO_RADIUS = 15;

  for (let i = companions.length - 1; i >= 0; i--) {
    const c = companions[i];

    // ── Death animation ──
    if (c.dying) {
      c.deathTimer -= dt;
      const t = c.deathTimer / 0.6;
      c.mesh.rotation.x += dt * 10;
      c.mesh.position.y += dt * 2;
      c.mesh.scale.setScalar(Math.max(0, t));
      if (c.deathTimer <= 0) {
        c.dying = false;
        scene.remove(c.mesh);
        companions.splice(i, 1);
      }
      continue;
    }

    if (!c.alive) continue;

    c.flashTimer = Math.max(0, c.flashTimer - dt);
    c.atkCd = Math.max(0, c.atkCd - dt);
    c.animT += dt;

    // ── Gravity & velocity ──
    c.vel.y -= GRAVITY * dt;
    c.x += c.vel.x * dt;
    c.z += c.vel.z * dt;
    c.y += c.vel.y * dt;
    const th = getTerrainHeight(c.x, c.z);
    if (c.y < th) {
      c.y = th;
      c.vel.y = 0;
    }
    c.vel.x *= 0.9;
    c.vel.z *= 0.9;

    // ── Distance to player ──
    const dxP = player.pos.x - c.x;
    const dzP = player.pos.z - c.z;
    const distP = Math.sqrt(dxP * dxP + dzP * dzP);

    // ── Teleport if too far ──
    if (distP > TELEPORT_DIST) {
      const angle = Math.random() * Math.PI * 2;
      c.x = player.pos.x + Math.cos(angle) * 3;
      c.z = player.pos.z + Math.sin(angle) * 3;
      c.y = getTerrainHeight(c.x, c.z);
      c.state = 'follow';
      c.target = null;
    }

    // ── State transitions ──
    // Look for enemies near player
    const nearestEnemy = findNearestEnemy(player.pos.x, player.pos.z, AGGRO_RADIUS);

    if (c.state === 'follow' || c.state === 'return') {
      if (nearestEnemy) {
        c.state = 'attack';
        c.target = nearestEnemy;
      }
    }
    if (c.state === 'attack') {
      if (!c.target || !c.target.alive) {
        // Find a new target or go back to follow
        if (nearestEnemy) {
          c.target = nearestEnemy;
        } else {
          c.state = 'follow';
          c.target = null;
        }
      }
    }

    // ── Behavior per state ──
    let moving = false;

    if (c.state === 'follow') {
      if (distP > FOLLOW_DIST) {
        const nx = dxP / distP;
        const nz = dzP / distP;
        let spd = c.speed;
        // Sprint when player is further
        if (distP > FOLLOW_DIST * 2) spd *= 1.5;

        const nextX = c.x + nx * spd * dt;
        const nextZ = c.z + nz * spd * dt;
        // Avoid water
        if (getTerrainHeight(nextX, nextZ) > WATER_LEVEL) {
          c.x = nextX;
          c.z = nextZ;
        }
        c.facing = Math.atan2(nx, nz);
        moving = true;
      }
    } else if (c.state === 'attack' && c.target && c.target.alive) {
      const tgt = c.target;
      const dxT = tgt.x - c.x;
      const dzT = tgt.z - c.z;
      const distT = Math.sqrt(dxT * dxT + dzT * dzT);
      c.facing = Math.atan2(dxT / distT, dzT / distT);

      if (distT > c.attackRange) {
        // Move toward target
        const nx = dxT / distT;
        const nz = dzT / distT;
        const nextX = c.x + nx * c.speed * dt;
        const nextZ = c.z + nz * c.speed * dt;
        if (getTerrainHeight(nextX, nextZ) > WATER_LEVEL) {
          c.x = nextX;
          c.z = nextZ;
        }
        moving = true;
      } else if (c.atkCd <= 0) {
        // Attack!
        if (c.ranged) {
          // Fire projectile
          const projMesh = createProjectileMesh(c.color);
          projMesh.position.set(c.x, c.y + 1.5, c.z);
          scene.add(projMesh);
          const dir = new THREE.Vector3(dxT, 0, dzT).normalize();
          projectiles.push({
            mesh: projMesh,
            x: c.x,
            y: c.y + 1.5,
            z: c.z,
            vx: dir.x * 20,
            vz: dir.z * 20,
            dmg: c.dmg,
            life: 2.0,
            owner: c,
          });
        } else {
          // Melee attack — deal damage directly
          dealDamageToTarget(tgt, c.dmg, c);
          // Lunge animation impulse
          const lx = (dxT / distT) * 1.5;
          const lz = (dzT / distT) * 1.5;
          c.vel.x += lx;
          c.vel.z += lz;
        }
        c.atkCd = 1.0;
      }
    }

    // ── Take damage from nearby enemies ──
    for (const e of enemies) {
      if (!e.alive) continue;
      const edx = e.x - c.x;
      const edz = e.z - c.z;
      const edist = Math.sqrt(edx * edx + edz * edz);
      if (edist < (e.type.r + 0.8) && e.atkCd !== undefined && e.state === 'chase') {
        // Only take damage occasionally (not every frame)
        // We check if the enemy just attacked (atkAnim > 0.3)
        if (edist < 2.0 && e.atkAnim > 0.3) {
          takeDamage(c, e.type.dmg * 0.5, i);
        }
      }
    }

    // ── Animation ──
    if (moving) {
      const legS = Math.sin(c.animT * 8) * 0.5;
      if (c.mesh.userData.legL) c.mesh.userData.legL.rotation.x = legS;
      if (c.mesh.userData.legR) c.mesh.userData.legR.rotation.x = -legS;
      if (c.mesh.userData.armL) c.mesh.userData.armL.rotation.x = -legS * 0.6;
      if (c.mesh.userData.armR) c.mesh.userData.armR.rotation.x = legS * 0.6;
    } else {
      // Idle animation
      const legS = Math.sin(c.animT * 2) * 0.1;
      if (c.mesh.userData.legL) c.mesh.userData.legL.rotation.x = legS;
      if (c.mesh.userData.legR) c.mesh.userData.legR.rotation.x = -legS;
      if (c.mesh.userData.armL) c.mesh.userData.armL.rotation.x = 0;
      if (c.mesh.userData.armR) c.mesh.userData.armR.rotation.x = 0;
    }

    // ── Attack lunge animation ──
    if (c.atkCd > 0.7) {
      const lungeT = (c.atkCd - 0.7) / 0.3;
      if (c.mesh.userData.armR) {
        c.mesh.userData.armR.rotation.x = -lungeT * 1.5;
        c.mesh.userData.armR.rotation.z = -0.3 - lungeT * 0.5;
      }
    }

    // ── Update mesh ──
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.facing;

    // Bob
    const bob = Math.sin(c.animT * 2) * 0.04;
    c.mesh.position.y += bob;

    // Friendly marker float
    if (c.mesh.userData.friendlyMarker) {
      c.mesh.userData.friendlyMarker.position.y = 3.1 + Math.sin(c.animT * 3) * 0.15;
    }

    // Flash on damage
    if (c.flashTimer > 0) {
      c.mesh.userData.body.material.emissive.set(0xff0000);
      c.mesh.userData.body.material.emissiveIntensity = c.flashTimer * 5;
    } else {
      c.mesh.userData.body.material.emissive.set(0x00e676);
      c.mesh.userData.body.material.emissiveIntensity = 0.15;
    }

    // ── Update terrain Y ──
    c.y = Math.max(c.y, getTerrainHeight(c.x, c.z));
  }

  // ── Update projectiles ──
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.mesh.position.set(p.x, p.y, p.z);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    // Check hit against enemies
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < (e.type.r + 0.3)) {
        dealDamageToTarget(e, p.dmg, p.owner);
        hit = true;
        break;
      }
    }
    // Check boss
    if (!hit && bossState && bossState.alive) {
      const bdx = bossState.x - p.x;
      const bdz = bossState.z - p.z;
      if (Math.sqrt(bdx * bdx + bdz * bdz) < 2.5) {
        dealDamageToTarget(bossState, p.dmg, p.owner);
        hit = true;
      }
    }
    if (hit) {
      spawnParticles(new THREE.Vector3(p.x, p.y, p.z), p.owner.color, 5, 3);
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

// ─── Deal damage to an enemy/boss from a companion ──────────────────
function dealDamageToTarget(target, dmg, companion) {
  target.hp -= dmg;
  target.flashTimer = 0.15;

  // Knockback
  const kx = target.x - companion.x;
  const kz = target.z - companion.z;
  const kd = Math.sqrt(kx * kx + kz * kz) || 1;
  if (target.vel) {
    target.vel.x += (kx / kd) * 3;
    target.vel.z += (kz / kd) * 3;
  }

  // Stun
  if (target.stunTimer !== undefined) {
    target.stunTimer = 0.2;
  }

  spawnParticles(
    new THREE.Vector3(target.x, (target.y || 0) + 1.2, target.z),
    companion.color, 5, 4
  );

  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    target.dying = true;
    target.deathTimer = 0.5;
    spawnParticles(
      new THREE.Vector3(target.x, (target.y || 0) + 1, target.z),
      target.type ? target.type.color : 0xff0000, 12, 5
    );
    // Give kill/xp/seeds to player
    if (target.type) {
      player.kills++;
      player.xp += target.type.xp || 10;
      player.seeds += Math.floor(Math.random() * 3) + 1;
    }
  }
}

// ─── Companion takes damage ─────────────────────────────────────────
function takeDamage(companion, dmg, index) {
  companion.hp -= dmg;
  companion.flashTimer = 0.15;

  spawnParticles(
    new THREE.Vector3(companion.x, companion.y + 1.2, companion.z),
    0xc62828, 4, 3
  );

  if (companion.hp <= 0) {
    companion.alive = false;
    companion.dying = true;
    companion.deathTimer = 0.6;
    spawnParticles(
      new THREE.Vector3(companion.x, companion.y + 1, companion.z),
      companion.color, 15, 6
    );
    showCompanionDeathMessage(companion.name);
  }
}

// ─── Public: damage a companion (called from enemy AI if needed) ────
export function damageCompanion(companionIndex, dmg) {
  if (companionIndex < 0 || companionIndex >= companions.length) return;
  takeDamage(companions[companionIndex], dmg, companionIndex);
}
