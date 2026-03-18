import * as THREE from 'three';
import { scene, camera } from './scene.js';

const numbers = [];

export function spawnDamageNumber(x, y, z, damage, color = 0xffffff) {
  // Create a canvas with the damage number
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(Math.round(damage), 66, 50);
  const hex = '#' + new THREE.Color(color).getHexString();
  ctx.fillStyle = hex;
  ctx.fillText(Math.round(damage), 64, 48);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y + 1.5, z);
  sprite.scale.set(2, 1, 1);
  scene.add(sprite);

  numbers.push({
    sprite,
    vy: 3 + Math.random() * 2,
    life: 1.0,
    maxLife: 1.0,
  });
}

export function updateDamageNumbers(dt) {
  for (let i = numbers.length - 1; i >= 0; i--) {
    const n = numbers[i];
    n.life -= dt;
    n.sprite.position.y += n.vy * dt;
    n.vy *= 0.95;
    n.sprite.material.opacity = Math.max(0, n.life / n.maxLife);
    // Scale up then shrink
    const t = 1 - n.life / n.maxLife;
    const s = t < 0.2 ? t / 0.2 * 1.3 : 1.3 - (t - 0.2) * 0.5;
    n.sprite.scale.set(2 * s, s, 1);

    if (n.life <= 0) {
      scene.remove(n.sprite);
      n.sprite.material.map.dispose();
      n.sprite.material.dispose();
      numbers.splice(i, 1);
    }
  }
}

export function clearDamageNumbers() {
  for (const n of numbers) {
    scene.remove(n.sprite);
    n.sprite.material.map.dispose();
    n.sprite.material.dispose();
  }
  numbers.length = 0;
}
