import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';

const hazards = [];

function createHazardMesh(type, radius) {
  let mesh;
  switch (type) {
    case 'poison': {
      const geo = new THREE.RingGeometry(0, radius, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x76ff03, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      break;
    }
    case 'fire': {
      const geo = new THREE.RingGeometry(0, radius, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6d00, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      break;
    }
    case 'shockwave': {
      const inner = Math.max(0.01, radius - 0.3);
      const geo = new THREE.RingGeometry(inner, radius + 0.3, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      break;
    }
    default: {
      const geo = new THREE.RingGeometry(0, radius, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff0000, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
    }
  }
  mesh.renderOrder = 998;
  return mesh;
}

export function spawnHazard(config) {
  const {
    x = 0, z = 0, y = 0,
    type = 'poison',
    damage = 5,
    duration = 8,
    maxRadius = 5,
    expandSpeed = 0
  } = config;

  const startRadius = type === 'shockwave' ? 1 : maxRadius;
  const mesh = createHazardMesh(type, startRadius);
  mesh.position.set(x, y + 0.15, z);
  scene.add(mesh);

  const hazard = {
    mesh, x, z, y,
    radius: type === 'shockwave' ? 1 : maxRadius,
    maxRadius,
    expandSpeed: type === 'shockwave' ? (expandSpeed || 15) : (expandSpeed || 0),
    damage,
    duration,
    lifetime: 0,
    type,
    hitPlayer: false,
    dmgCooldown: 0,
  };

  hazards.push(hazard);
  return hazard;
}

export function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.lifetime += dt;
    h.dmgCooldown = Math.max(0, h.dmgCooldown - dt);

    let remove = false;

    if (h.type === 'shockwave') {
      // Expand outward
      h.radius += h.expandSpeed * dt;

      // Update mesh geometry by scaling
      const scale = h.radius / 1; // initial radius was 1
      h.mesh.scale.set(scale, scale, 1);

      // Fade out as it expands
      const progress = h.radius / h.maxRadius;
      h.mesh.material.opacity = 0.7 * (1 - progress * 0.7);

      // Check player collision - ring hit detection
      const dx = player.pos.x - h.x;
      const dz = player.pos.z - h.z;
      const playerDist = Math.sqrt(dx * dx + dz * dz);
      const ringWidth = 1.5; // generous hit detection for the ring

      if (!h.hitPlayer && Math.abs(playerDist - h.radius) < ringWidth) {
        // Player can jump over shockwaves
        if (player.pos.y <= h.y + 1.5) {
          if (player.invuln <= 0 && player.alive) {
            player.hp -= h.damage;
            player.dmgFlash = 0.3;
            player.vel.y = 8;
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xffffff, 8, 5);
            h.hitPlayer = true;

            if (player.hp <= 0) {
              player.alive = false;
              document.getElementById('death-screen').style.display = 'flex';
              document.exitPointerLock();
            }
          }
        }
      }

      // Remove when exceeds max radius
      if (h.radius >= h.maxRadius) {
        remove = true;
      }
    } else if (h.type === 'fire') {
      // Fire expands then contracts
      const halfDuration = h.duration / 2;
      if (h.lifetime < halfDuration) {
        // Expanding phase
        const progress = h.lifetime / halfDuration;
        const scale = progress;
        h.mesh.scale.set(scale, scale, 1);
        h.radius = h.maxRadius * progress;
      } else {
        // Contracting phase
        const progress = (h.lifetime - halfDuration) / halfDuration;
        const scale = 1 - progress;
        h.mesh.scale.set(Math.max(0.01, scale), Math.max(0.01, scale), 1);
        h.radius = h.maxRadius * Math.max(0, scale);
      }

      // Flicker opacity
      h.mesh.material.opacity = 0.4 + Math.sin(h.lifetime * 10) * 0.15;

      // Spawn fire particles occasionally
      if (Math.random() < 0.15 && h.radius > 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * h.radius;
        spawnParticles(
          new THREE.Vector3(h.x + Math.cos(angle) * r, h.y + 0.5, h.z + Math.sin(angle) * r),
          Math.random() > 0.5 ? 0xff6d00 : 0xff1744, 1, 3
        );
      }

      // Continuous damage to player standing in it
      const dx = player.pos.x - h.x;
      const dz = player.pos.z - h.z;
      const playerDist = Math.sqrt(dx * dx + dz * dz);
      if (playerDist < h.radius && h.dmgCooldown <= 0) {
        if (player.invuln <= 0 && player.alive) {
          player.hp -= h.damage * dt;
          player.dmgFlash = 0.1;

          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
      }

      if (h.lifetime >= h.duration) {
        remove = true;
      }
    } else if (h.type === 'poison') {
      // Poison pulse
      h.mesh.material.opacity = 0.3 + Math.sin(h.lifetime * 4) * 0.1;

      // Poison particles
      if (Math.random() < 0.08 && h.radius > 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * h.radius;
        spawnParticles(
          new THREE.Vector3(h.x + Math.cos(angle) * r, h.y + 0.3, h.z + Math.sin(angle) * r),
          0x76ff03, 1, 2
        );
      }

      // Continuous damage
      const dx = player.pos.x - h.x;
      const dz = player.pos.z - h.z;
      const playerDist = Math.sqrt(dx * dx + dz * dz);
      if (playerDist < h.radius) {
        if (player.invuln <= 0 && player.alive) {
          player.hp -= h.damage * dt;
          player.dmgFlash = 0.1;

          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
      }

      if (h.lifetime >= h.duration) {
        remove = true;
      }
    }

    if (remove) {
      scene.remove(h.mesh);
      hazards.splice(i, 1);
    }
  }
}

export function clearHazards() {
  for (const h of hazards) {
    scene.remove(h.mesh);
  }
  hazards.length = 0;
}
