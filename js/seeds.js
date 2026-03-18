import * as THREE from 'three';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { player } from './player.js';
import { sfxPickup } from './music.js';

export const seeds = [];

const seedGeo = new THREE.SphereGeometry(0.15, 6, 6);
seedGeo.scale(1, 1.6, 0.6);
const seedMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xfdd835, transparent: true, opacity: 0.3 });
const glowGeo = new THREE.SphereGeometry(0.35, 8, 8);

export function spawnSeed(x, y, z) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(seedGeo, seedMat.clone());
  group.add(mesh);
  const glow = new THREE.Mesh(glowGeo, glowMat.clone());
  group.add(glow);
  group.position.set(x, y + 1, z);
  scene.add(group);
  const angle = Math.random() * Math.PI * 2;
  const spd = 2 + Math.random() * 3;
  seeds.push({
    mesh: group, x, z,
    y: y + 1,
    vy: 4 + Math.random() * 3,
    vx: Math.sin(angle) * spd,
    vz: Math.cos(angle) * spd,
    time: 0,
    landed: false,
  });
}

export function updateSeeds(dt) {
  for (let i = seeds.length - 1; i >= 0; i--) {
    const s = seeds[i];
    s.time += dt;
    if (!s.landed) {
      s.vy -= 28 * dt;
      s.y += s.vy * dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      const th = getTerrainHeight(s.x, s.z) + 0.3;
      if (s.y <= th) {
        s.y = th;
        s.landed = true;
      }
    }
    s.mesh.position.set(s.x, s.y + Math.sin(s.time * 3) * 0.15, s.z);
    s.mesh.rotation.y += dt * 2;

    const dx = player.pos.x - s.x, dz = player.pos.z - s.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2) {
      player.seeds++;
      sfxPickup();
      scene.remove(s.mesh);
      seeds.splice(i, 1);
      continue;
    }
    if (s.time > 30) {
      scene.remove(s.mesh);
      seeds.splice(i, 1);
    }
  }
}

export function clearSeeds() {
  for (const s of seeds) scene.remove(s.mesh);
  seeds.length = 0;
}
