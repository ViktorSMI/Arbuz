import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { enemies } from './enemies.js';

const projectiles = [];

const FOOD_COLORS = [0xff5722, 0xffeb3b, 0x8bc34a, 0xe91e63, 0xff9800, 0x9c27b0];

function createProjectileMesh(type) {
  switch (type) {
    case 'feather': {
      const geo = new THREE.PlaneGeometry(0.5, 0.3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x9e9e9e, side: THREE.DoubleSide, roughness: 0.6
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    case 'knife': {
      const geo = new THREE.BoxGeometry(0.08, 0.8, 0.15);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xeceff1, metalness: 0.8, roughness: 0.2
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    case 'food': {
      const geo = new THREE.SphereGeometry(0.3, 8, 8);
      const color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    case 'toxic': {
      const geo = new THREE.SphereGeometry(0.4, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.8
      });
      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }
    case 'seed': {
      const geo = new THREE.SphereGeometry(0.15, 6, 6);
      const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    default: {
      const geo = new THREE.SphereGeometry(0.2, 6, 6);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      return new THREE.Mesh(geo, mat);
    }
  }
}

export function spawnProjectile(config) {
  const {
    x = 0, y = 1, z = 0,
    vx = 0, vy = 0, vz = 0,
    damage = 10, lifetime = 5,
    type = 'food', radius = 0.5
  } = config;

  const mesh = createProjectileMesh(type);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const proj = {
    mesh, x, y, z,
    vx, vy, vz,
    damage, lifetime, maxLifetime: lifetime,
    type, radius,
    onHitPlayer: config.onHitPlayer || null,
  };

  projectiles.push(proj);
  return proj;
}

export function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    // Move
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // Apply gravity to food projectiles for arc trajectories
    if (p.type === 'food' || p.type === 'toxic') {
      p.vy -= 9.8 * dt;
    }

    p.mesh.position.set(p.x, p.y, p.z);

    // Rotate mesh for visual effect
    if (p.type === 'feather') {
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.z += dt * 3;
    } else if (p.type === 'knife') {
      p.mesh.rotation.x += dt * 15;
    } else if (p.type === 'food') {
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.y += dt * 6;
    } else if (p.type === 'toxic') {
      p.mesh.rotation.y += dt * 3;
      // Toxic trail particles
      if (Math.random() < 0.3) {
        spawnParticles(new THREE.Vector3(p.x, p.y, p.z), 0x76ff03, 1, 2);
      }
    } else if (p.type === 'seed') {
      p.mesh.rotation.z += dt * 10;
    }

    // Lifetime
    p.lifetime -= dt;
    let remove = false;

    if (p.lifetime <= 0 || p.y < -10) {
      remove = true;
    }

    // Collision: enemy projectiles vs player
    if (p.type !== 'seed' && !remove) {
      const dx = player.pos.x - p.x;
      const dy = (player.pos.y + 1) - p.y;
      const dz = player.pos.z - p.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < p.radius + 0.5) {
        if (player.invuln <= 0 && player.alive) {
          player.hp -= p.damage;
          player.dmgFlash = 0.25;
          spawnParticles(
            new THREE.Vector3(p.x, p.y, p.z),
            0xc62828, 6, 4
          );
          if (p.onHitPlayer) p.onHitPlayer(p);

          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
        remove = true;
      }
    }

    // Collision: seed projectiles vs enemies
    if (p.type === 'seed' && !remove) {
      for (const e of enemies) {
        if (!e.alive || e.dying) continue;
        const dx = e.x - p.x;
        const dy = (e.y + e.type.r) - p.y;
        const dz = e.z - p.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < p.radius + e.type.r) {
          e.hp -= p.damage;
          e.flashTimer = 0.15;
          e.stunTimer = 0.15;
          spawnParticles(
            new THREE.Vector3(e.x, e.y + e.type.r, e.z),
            0x1a1a1a, 4, 3
          );
          if (e.hp <= 0) {
            e.alive = false;
            e.dying = true;
            e.deathTimer = 0.5;
            player.xp += e.type.xp;
            player.kills++;
            spawnParticles(
              new THREE.Vector3(e.x, e.y + e.type.r, e.z),
              e.type.color, 12, 6
            );
          }
          remove = true;
          break;
        }
      }
    }

    if (remove) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

export function clearProjectiles() {
  for (const p of projectiles) {
    scene.remove(p.mesh);
  }
  projectiles.length = 0;
}
