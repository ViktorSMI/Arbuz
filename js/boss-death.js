import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { setBloomIntensity } from './postprocessing.js';

let cinematicActive = false;
let cinematicTime = 0;
let cinematicDuration = 4.0;
let savedCameraPos = new THREE.Vector3();
let savedCameraQuat = new THREE.Quaternion();
let onCompleteCallback = null;
let targetBoss = null;
let animFrameId = null;
let lastTimestamp = 0;

export function startBossDeathSequence(bossObj, onComplete) {
  if (cinematicActive) return;

  cinematicActive = true;
  cinematicTime = 0;
  targetBoss = bossObj;
  onCompleteCallback = onComplete || null;

  // Store original camera state
  savedCameraPos.copy(camera.position);
  savedCameraQuat.copy(camera.quaternion);

  // Make player invulnerable during cinematic
  player.invuln = 999;

  // Make boss visible again for the death animation
  if (targetBoss.mesh) {
    targetBoss.mesh.visible = true;
    targetBoss.mesh.scale.set(1, 1, 1);
    targetBoss.mesh.rotation.set(0, targetBoss.facing || 0, 0);
  }

  // Get or create screen flash element
  let flashEl = document.getElementById('screen-flash');
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.id = 'screen-flash';
    flashEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;opacity:0;pointer-events:none;z-index:9998;transition:none;';
    document.body.appendChild(flashEl);
  }
  flashEl.style.opacity = '0';
  flashEl.style.display = 'block';

  // Get or create boss defeated text
  let defeatEl = document.getElementById('boss-defeated-text');
  if (!defeatEl) {
    defeatEl = document.createElement('div');
    defeatEl.id = 'boss-defeated-text';
    defeatEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:64px;font-weight:bold;color:#fdd835;text-shadow:0 0 20px #ff6f00,0 0 40px #ff6f00,2px 2px 4px #000;z-index:9999;pointer-events:none;font-family:serif;letter-spacing:4px;display:none;';
    defeatEl.textContent = 'BOSS DEFEATED';
    document.body.appendChild(defeatEl);
  }
  defeatEl.style.display = 'none';

  // Start the animation loop
  lastTimestamp = performance.now();
  animFrameId = requestAnimationFrame(animateCinematic);
}

function animateCinematic(timestamp) {
  const rawDt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  const dt = Math.min(rawDt, 0.05); // Cap to avoid jumps

  cinematicTime += dt;

  const flashEl = document.getElementById('screen-flash');
  const defeatEl = document.getElementById('boss-defeated-text');
  const bossPos = targetBoss
    ? new THREE.Vector3(targetBoss.x, (targetBoss.y || 0) + 3, targetBoss.z)
    : new THREE.Vector3();

  // ─── Phase 1: 0-1s - Camera zoom, boss shakes, bloom ramp ───
  if (cinematicTime < 1.0) {
    const t = cinematicTime / 1.0;

    // Camera moves toward boss
    const camTarget = bossPos.clone().add(new THREE.Vector3(5, 4, 5));
    camera.position.lerpVectors(savedCameraPos, camTarget, t * 0.7);
    camera.lookAt(bossPos);

    // Boss mesh shakes
    if (targetBoss && targetBoss.mesh) {
      targetBoss.mesh.position.x = targetBoss.x + (Math.random() - 0.5) * 0.6;
      targetBoss.mesh.position.z = targetBoss.z + (Math.random() - 0.5) * 0.6;
      targetBoss.mesh.position.y = (targetBoss.y || 0) + (Math.random() - 0.5) * 0.3;
    }

    // Ramp bloom
    setBloomIntensity(0.3 + t * 0.7);

    // Shake particles
    if (Math.random() < 0.3) {
      spawnParticles(bossPos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3
      )), 0xffd700, 2, 3);
    }
  }

  // ─── Phase 2: 1-2s - Boss spins, scales up, particle burst, screen flash ───
  else if (cinematicTime < 2.0) {
    const t = (cinematicTime - 1.0) / 1.0;

    camera.lookAt(bossPos);

    if (targetBoss && targetBoss.mesh) {
      // Spin and scale up
      targetBoss.mesh.rotation.y += dt * 12;
      const scale = 1 + t * 0.3;
      targetBoss.mesh.scale.set(scale, scale, scale);

      // Position back to center (no more shake)
      targetBoss.mesh.position.set(targetBoss.x, (targetBoss.y || 0), targetBoss.z);

      // Intense particle bursts
      if (Math.random() < 0.5) {
        spawnParticles(bossPos, 0xfdd835, 5, 8);
        spawnParticles(bossPos, 0xff6f00, 3, 6);
      }
    }

    // Screen flash builds
    if (flashEl) {
      flashEl.style.opacity = String(t * 0.8);
    }

    setBloomIntensity(1.0);

    // Big burst at the peak
    if (t > 0.8 && t < 0.85) {
      spawnParticles(bossPos, 0xfdd835, 50, 12);
      spawnParticles(bossPos, 0xff6f00, 25, 10);
      spawnParticles(bossPos, 0xffffff, 15, 8);
    }
  }

  // ─── Phase 3: 2-3s - Boss shrinks to 0, flash fades, bloom returns ───
  else if (cinematicTime < 3.0) {
    const t = (cinematicTime - 2.0) / 1.0;

    camera.lookAt(bossPos);

    if (targetBoss && targetBoss.mesh) {
      // Shrink to nothing
      const scale = Math.max(0.01, 1.3 * (1 - t));
      targetBoss.mesh.scale.set(scale, scale, scale);
      targetBoss.mesh.rotation.y += dt * 20;

      // Dissolve particles
      if (Math.random() < 0.4) {
        spawnParticles(bossPos, 0xfdd835, 3, 5);
      }

      // Make invisible at the end
      if (t > 0.9) {
        targetBoss.mesh.visible = false;
      }
    }

    // Fade flash
    if (flashEl) {
      flashEl.style.opacity = String(0.8 * (1 - t));
    }

    // Return bloom
    setBloomIntensity(1.0 - t * 0.7);
  }

  // ─── Phase 4: 3-4s - Show defeat text, camera returns ───
  else if (cinematicTime < 4.0) {
    const t = (cinematicTime - 3.0) / 1.0;

    // Show defeat text
    if (defeatEl) {
      defeatEl.style.display = 'block';
      defeatEl.style.opacity = String(Math.min(1, t * 3));
    }

    // Camera returns to original position
    camera.position.lerpVectors(camera.position, savedCameraPos, t * 2 * dt);
    camera.quaternion.slerp(savedCameraQuat, t * 2 * dt);

    // Flash fully gone
    if (flashEl) {
      flashEl.style.opacity = '0';
    }

    setBloomIntensity(0.3);

    // Make sure boss is hidden
    if (targetBoss && targetBoss.mesh) {
      targetBoss.mesh.visible = false;
    }
  }

  // ─── Phase 5: 4s+ - Cleanup and complete ───
  else {
    // Fade out defeat text
    if (defeatEl) {
      const fadeT = cinematicTime - 4.0;
      if (fadeT < 1.5) {
        defeatEl.style.opacity = String(Math.max(0, 1 - fadeT / 1.5));
      } else {
        defeatEl.style.display = 'none';
      }
    }

    if (flashEl) {
      flashEl.style.display = 'none';
    }

    // Restore camera
    camera.position.copy(savedCameraPos);
    camera.quaternion.copy(savedCameraQuat);

    // Clean up
    cinematicActive = false;
    setBloomIntensity(0.3);

    // Restore player invuln to a brief post-cinematic grace period
    player.invuln = 2.0;

    // Make sure boss mesh is gone
    if (targetBoss && targetBoss.mesh) {
      targetBoss.mesh.visible = false;
      targetBoss.mesh.scale.set(1, 1, 1);
    }

    // Call completion callback
    if (onCompleteCallback) {
      onCompleteCallback();
    }

    targetBoss = null;
    onCompleteCallback = null;
    return; // Don't request another frame
  }

  animFrameId = requestAnimationFrame(animateCinematic);
}

export function isCinematicActive() {
  return cinematicActive;
}

export function getCinematicDtMultiplier() {
  if (!cinematicActive) return 1.0;
  // Slow-mo during the first 2 seconds of the cinematic
  if (cinematicTime < 2.0) return 0.3;
  return 1.0;
}
