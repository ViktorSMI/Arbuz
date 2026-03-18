import * as THREE from 'three';
import { scene } from './scene.js';
import { GRAVITY } from './constants.js';

const particles = [];

export function spawnParticles(pos, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const p = {
      mesh: new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color })
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.7,
        (Math.random() - 0.5) * speed
      ),
      life: 0.5 + Math.random() * 0.5,
    };
    p.mesh.position.copy(pos);
    scene.add(p.mesh);
    particles.push(p);
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= GRAVITY * 0.5 * dt;
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.mesh.material.opacity = p.life * 2;
    p.mesh.material.transparent = true;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}
