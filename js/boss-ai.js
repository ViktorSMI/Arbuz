import * as THREE from 'three';
import { player } from './player.js';
import { spawnParticles } from './particles.js';
import { spawnProjectile } from './projectiles.js';
import { spawnHazard } from './hazards.js';
import { getTerrainHeight } from './terrain.js';
import { scene } from './scene.js';

// ─────────────────────────────────────────────────
// BOSS 0: HRUSCH (beetle) - Charge + Ground Pound
// ─────────────────────────────────────────────────
const bossAiHrusch = {
  init(b) {
    b.state = 'idle';
    b.stateTimer = 2;
    b.gpJumpProgress = 0;
    b.gpJumpHeight = 12;
    b.gpShockwaveCount = 0;
    b.gpShockwaveDelay = 0;
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0) return;

    switch (b.state) {
      case 'idle': {
        b.stateTimer -= dt;
        // Walk toward player slowly
        if (dist > 3) {
          const spd = b.phase === 2 ? 5 : 3;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }
        if (b.stateTimer <= 0) {
          if (dist > 8) {
            // Set up charge
            b.state = 'charge';
            b.stateTimer = 0.8;
            b.chargeDir = new THREE.Vector3(dx, 0, dz).normalize();
            b.spinAngle = 0;
          } else {
            // Ground pound
            b.state = 'groundpound';
            b.stateTimer = 0.8;
            b.gpJumpProgress = 0;
            b.gpJumpHeight = b.phase === 2 ? 16 : 12;
          }
        }
        break;
      }

      case 'charge': {
        b.stateTimer -= dt;
        const chargeSpeed = b.phase === 2 ? 30 : 25;
        b.x += b.chargeDir.x * chargeSpeed * dt;
        b.z += b.chargeDir.z * chargeSpeed * dt;
        b.spinAngle += dt * 18;
        b.mesh.rotation.x = b.spinAngle;
        // Charge particles
        spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0x8d6e63, 2, 4);

        // Hit player
        if (dist < 4 && player.invuln <= 0 && player.alive) {
          const chargeDmg = b.phase === 2 ? 35 : 25;
          player.hp -= chargeDmg;
          player.dmgFlash = 0.3;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(12);
          player.vel.copy(kd);
          player.vel.y = 6;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 10, 5);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }

        if (b.stateTimer <= 0) {
          b.mesh.rotation.x = 0;
          b.spinAngle = 0;
          b.state = 'recover';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'groundpound': {
        b.stateTimer -= dt;
        // Jump up
        b.gpJumpProgress = 1 - (b.stateTimer / 0.8);
        b.mesh.position.y = b.y + b.gpJumpHeight * Math.sin(b.gpJumpProgress * Math.PI * 0.5);

        if (b.stateTimer <= 0) {
          // Slam down
          b.mesh.position.y = b.y;
          spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0x8d6e63, 25, 12);
          spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0xff6f00, 15, 8);

          // Spawn shockwaves with delays
          const numWaves = b.phase === 2 ? 4 : 3;
          const radii = b.phase === 2 ? [3, 6, 9, 12] : [3, 6, 9];
          for (let w = 0; w < numWaves; w++) {
            setTimeout(() => {
              spawnHazard({
                x: b.x, z: b.z, y: b.y,
                type: 'shockwave',
                damage: 20,
                duration: 3,
                maxRadius: radii[w],
                expandSpeed: 15
              });
            }, w * 300);
          }

          // Direct slam damage
          if (dist < 5 && player.invuln <= 0 && player.alive) {
            player.hp -= b.phase === 2 ? 30 : 22;
            player.dmgFlash = 0.3;
            player.vel.y = 10;
            const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(8);
            player.vel.x = kd.x;
            player.vel.z = kd.z;
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 10, 5);
            if (player.hp <= 0) {
              player.alive = false;
              document.getElementById('death-screen').style.display = 'flex';
              document.exitPointerLock();
            }
          }

          b.state = 'recover';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'recover': {
        b.stateTimer -= dt;
        if (b.stateTimer <= 0) {
          b.state = 'idle';
          b.stateTimer = 2;
        }
        break;
      }
    }
  },

  onHit(b, dmg) {
    // Standard reaction
  },

  cleanup(b) {
    b.mesh.rotation.x = 0;
    b.spinAngle = 0;
  }
};

// ─────────────────────────────────────────────────
// BOSS 1: SHARLOTTA (rat queen) - Summon + Poison + Swipe
// ─────────────────────────────────────────────────
const bossAiSharlotta = {
  init(b) {
    b.state = 'idle';
    b.stateTimer = 1.5;
    b.minions = [];
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0) return;

    // Update minions
    this._updateMinions(dt, b);

    switch (b.state) {
      case 'idle': {
        b.stateTimer -= dt;
        // Walk toward player
        if (dist > 4) {
          const spd = b.phase === 2 ? 4.5 : 3.5;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }
        if (b.stateTimer <= 0) {
          const aliveMinions = b.minions.filter(m => m.alive).length;
          const maxMinions = b.phase === 2 ? 3 : 3;
          if (aliveMinions < maxMinions) {
            b.state = 'summon';
            b.stateTimer = 1.2;
          } else if (dist < 5) {
            b.state = 'swipe';
            b.stateTimer = 0.5;
          } else {
            b.state = 'poison';
            b.stateTimer = 0.8;
          }
        }
        break;
      }

      case 'summon': {
        b.stateTimer -= dt;
        // Summon animation - boss shakes
        b.mesh.rotation.z = Math.sin(b.stateTimer * 20) * 0.15;

        if (b.stateTimer <= 0) {
          b.mesh.rotation.z = 0;
          const count = b.phase === 2 ? (6 + Math.floor(Math.random() * 3)) : (3 + Math.floor(Math.random() * 3));
          for (let i = 0; i < count; i++) {
            this._spawnMinion(b);
          }
          spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0x9e9e9e, 15, 6);
          b.state = 'idle';
          b.stateTimer = 2;
        }
        break;
      }

      case 'poison': {
        b.stateTimer -= dt;
        // Spit animation
        b.mesh.rotation.x = -0.3 * (b.stateTimer / 0.8);

        if (b.stateTimer <= 0) {
          b.mesh.rotation.x = 0;
          // Create poison puddle at player position
          const pudRadius = b.phase === 2 ? 5 : 3.5;
          spawnHazard({
            x: player.pos.x, z: player.pos.z, y: getTerrainHeight(player.pos.x, player.pos.z),
            type: 'poison',
            damage: 5,
            duration: 8,
            maxRadius: pudRadius
          });
          spawnParticles(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0x76ff03, 8, 4);
          b.state = 'idle';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'swipe': {
        b.stateTimer -= dt;
        // Lunge + spin toward player
        const lungeSpeed = 12;
        if (dist > 1) {
          b.x += (dx / dist) * lungeSpeed * dt;
          b.z += (dz / dist) * lungeSpeed * dt;
        }
        b.mesh.rotation.z += dt * 15;

        // Damage on contact
        if (dist < 4 && player.invuln <= 0 && player.alive) {
          const swipeDmg = b.phase === 2 ? 22 : 15;
          player.hp -= swipeDmg;
          player.dmgFlash = 0.2;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(8);
          player.vel.copy(kd);
          player.vel.y = 4;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 8, 4);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
          b.stateTimer = 0; // End swipe after hit
        }

        if (b.stateTimer <= 0) {
          b.mesh.rotation.z = 0;
          b.state = 'recover';
          b.stateTimer = 1;
        }
        break;
      }

      case 'recover': {
        b.stateTimer -= dt;
        if (b.stateTimer <= 0) {
          b.state = 'idle';
          b.stateTimer = 1.5;
        }
        break;
      }
    }
  },

  _spawnMinion(b) {
    const angle = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 2;
    const mx = b.x + Math.cos(angle) * r;
    const mz = b.z + Math.sin(angle) * r;
    const my = getTerrainHeight(mx, mz);

    const geo = new THREE.SphereGeometry(0.5, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(mx, my + 0.5, mz);
    mesh.castShadow = true;
    scene.add(mesh);

    // Add eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0.5 });
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
      eye.position.set(s * 0.15, 0.2, 0.4);
      mesh.add(eye);
    }

    b.minions.push({
      mesh, x: mx, z: mz, y: my,
      hp: 30, alive: true,
      vel: new THREE.Vector3(),
      atkCd: 0, flashTimer: 0
    });
  },

  _updateMinions(dt, b) {
    for (let i = b.minions.length - 1; i >= 0; i--) {
      const m = b.minions[i];
      if (!m.alive) {
        if (m.deathTimer !== undefined) {
          m.deathTimer -= dt;
          m.mesh.scale.setScalar(Math.max(0, m.deathTimer / 0.4));
          m.mesh.rotation.x += dt * 12;
          if (m.deathTimer <= 0) {
            scene.remove(m.mesh);
            b.minions.splice(i, 1);
          }
        }
        continue;
      }

      m.atkCd = Math.max(0, m.atkCd - dt);
      m.flashTimer = Math.max(0, m.flashTimer - dt);

      // Chase player
      const mdx = player.pos.x - m.x;
      const mdz = player.pos.z - m.z;
      const mdist = Math.sqrt(mdx * mdx + mdz * mdz);

      if (mdist > 1) {
        const mspd = 4;
        m.x += (mdx / mdist) * mspd * dt;
        m.z += (mdz / mdist) * mspd * dt;
      }

      m.y = getTerrainHeight(m.x, m.z);
      m.mesh.position.set(m.x, m.y + 0.5, m.z);
      m.mesh.rotation.y = Math.atan2(mdx, mdz);

      // Attack player
      if (mdist < 1.5 && m.atkCd <= 0 && player.invuln <= 0 && player.alive) {
        player.hp -= 8;
        player.dmgFlash = 0.15;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0x9e9e9e, 4, 3);
        m.atkCd = 1.5;
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }

      // Flash on damage
      if (m.flashTimer > 0) {
        m.mesh.material.emissive = new THREE.Color(0xff0000);
        m.mesh.material.emissiveIntensity = m.flashTimer * 5;
      } else {
        m.mesh.material.emissiveIntensity = 0;
      }
    }
  },

  onHit(b, dmg) {
    // Boss takes normal damage
  },

  cleanup(b) {
    // Remove all minions
    if (b.minions) {
      for (const m of b.minions) {
        scene.remove(m.mesh);
      }
      b.minions.length = 0;
    }
    b.mesh.rotation.z = 0;
    b.mesh.rotation.x = 0;
  }
};

// ─────────────────────────────────────────────────
// BOSS 2: KARLUSHA (crow general) - Flight + Feathers + Dive Bomb
// ─────────────────────────────────────────────────
const bossAiKarlusha = {
  init(b) {
    b.state = 'ground';
    b.stateTimer = 8;
    b.flightY = 0;
    b.orbitAngle = 0;
    b.featherSalvo = 0;
    b.diveBombTarget = new THREE.Vector3();
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0) return;

    switch (b.state) {
      case 'ground': {
        b.stateTimer -= dt;
        // Standard melee pursuit
        if (dist > 3) {
          const spd = b.phase === 2 ? 5 : 4;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }

        // Melee attack
        if (dist < 4 && b.atkCd <= 0 && player.invuln <= 0 && player.alive) {
          const meleeDmg = b.phase === 2 ? 20 : 15;
          player.hp -= meleeDmg;
          player.dmgFlash = 0.2;
          b.atkCd = 1.2;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(6);
          player.vel.copy(kd);
          player.vel.y = 3;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0x212121, 6, 4);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }

        if (b.stateTimer <= 0) {
          b.state = 'takeoff';
          b.stateTimer = 1.0;
          b.flightY = 0;
        }
        break;
      }

      case 'takeoff': {
        b.stateTimer -= dt;
        const progress = 1 - (b.stateTimer / 1.0);
        b.flightY = progress * 10;
        b.mesh.position.y = b.y + b.flightY;

        // Wing flap particles
        if (Math.random() < 0.3) {
          spawnParticles(new THREE.Vector3(b.x, b.y + b.flightY, b.z), 0x424242, 2, 3);
        }

        if (b.stateTimer <= 0) {
          b.state = 'airborne';
          b.stateTimer = 0; // Controlled by salvo count
          b.featherSalvo = 0;
          b.orbitAngle = Math.atan2(b.z - player.pos.z, b.x - player.pos.x);
          b.flightY = 10;
        }
        break;
      }

      case 'airborne': {
        // Orbit around player
        b.orbitAngle += dt * 1.5;
        const orbitR = 12;
        const targetX = player.pos.x + Math.cos(b.orbitAngle) * orbitR;
        const targetZ = player.pos.z + Math.sin(b.orbitAngle) * orbitR;

        b.x += (targetX - b.x) * 3 * dt;
        b.z += (targetZ - b.z) * 3 * dt;
        b.mesh.position.y = b.y + b.flightY + Math.sin(b.orbitAngle * 3) * 1.5;

        // Fire feather salvos
        b.stateTimer -= dt;
        if (b.stateTimer <= 0 && b.featherSalvo < 2) {
          this._fireFeathers(b, dx, dz, dist);
          b.featherSalvo++;
          b.stateTimer = 1.5;
        }

        if (b.featherSalvo >= 2 && b.stateTimer <= 0) {
          b.state = 'divebomb';
          b.stateTimer = 0.6;
          b.diveBombTarget.set(player.pos.x, player.pos.y, player.pos.z);
        }
        break;
      }

      case 'divebomb': {
        b.stateTimer -= dt;
        const progress = 1 - (b.stateTimer / 0.6);
        const diveSpeed = b.phase === 2 ? 35 : 30;

        // Swoop toward saved target
        const tDx = b.diveBombTarget.x - b.x;
        const tDz = b.diveBombTarget.z - b.z;
        const tDist = Math.sqrt(tDx * tDx + tDz * tDz);

        if (tDist > 1) {
          b.x += (tDx / tDist) * diveSpeed * dt;
          b.z += (tDz / tDist) * diveSpeed * dt;
        }

        // Descend
        b.flightY = 10 * (1 - progress);
        b.mesh.position.y = b.y + b.flightY;

        // Trail particles
        spawnParticles(new THREE.Vector3(b.x, b.y + b.flightY, b.z), 0x212121, 3, 5);

        // Hit player
        if (dist < 4 && player.invuln <= 0 && player.alive) {
          const diveDmg = b.phase === 2 ? 35 : 30;
          player.hp -= diveDmg;
          player.dmgFlash = 0.3;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(14);
          player.vel.copy(kd);
          player.vel.y = 8;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 12, 6);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
          b.stateTimer = 0; // End dive early
        }

        if (b.stateTimer <= 0) {
          b.state = 'landing';
          b.stateTimer = 0.5;
          // Impact dust
          spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0x8d6e63, 20, 8);
        }
        break;
      }

      case 'landing': {
        b.stateTimer -= dt;
        b.flightY = Math.max(0, b.flightY - 20 * dt);
        b.mesh.position.y = b.y + b.flightY;

        if (b.stateTimer <= 0) {
          b.flightY = 0;
          b.state = 'ground';
          b.stateTimer = b.phase === 2 ? 6 : 8;
        }
        break;
      }
    }
  },

  _fireFeathers(b, dx, dz, dist) {
    const count = b.phase === 2 ? 5 : 3;
    const baseDx = player.pos.x - b.x;
    const baseDz = player.pos.z - b.z;
    const baseDist = Math.sqrt(baseDx * baseDx + baseDz * baseDz);
    const baseAngle = Math.atan2(baseDz, baseDx);

    const spreadAngle = b.phase === 2 ? 0.4 : 0.3;

    for (let i = 0; i < count; i++) {
      const offset = ((i - (count - 1) / 2) / Math.max(1, (count - 1) / 2)) * spreadAngle;
      const angle = baseAngle + offset;
      const speed = 18;

      spawnProjectile({
        x: b.x, y: b.y + 8, z: b.z,
        vx: Math.cos(angle) * speed,
        vy: -3,
        vz: Math.sin(angle) * speed,
        damage: 15,
        lifetime: 3,
        type: 'feather',
        radius: 0.6
      });
    }

    spawnParticles(new THREE.Vector3(b.x, b.y + 8, b.z), 0x9e9e9e, 8, 4);
  },

  onHit(b, dmg) {
    // If airborne, stun can bring boss down
    if (b.state === 'airborne' && b.stunTimer > 0.5) {
      b.state = 'landing';
      b.stateTimer = 0.8;
    }
  },

  cleanup(b) {
    b.flightY = 0;
  }
};

// ─────────────────────────────────────────────────
// BOSS 3: MUSORNY CHERV (garbage worm) - Burrow + Emerge + Toxic Spit
// ─────────────────────────────────────────────────
const bossAiCherv = {
  init(b) {
    b.state = 'surface';
    b.stateTimer = 8;
    b.burrowX = b.x;
    b.burrowZ = b.z;
    b.burrowTrailTimer = 0;
    b.emergeChain = 0;
    b.originalScale = 1;
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0 && b.state === 'surface') return;

    switch (b.state) {
      case 'surface': {
        b.stateTimer -= dt;
        b.mesh.visible = true;

        // Pursue player
        if (dist > 4) {
          const spd = b.phase === 2 ? 5 : 3.5;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }

        // Melee
        if (dist < 5 && b.atkCd <= 0 && player.invuln <= 0 && player.alive) {
          const meleeDmg = b.phase === 2 ? 20 : 15;
          player.hp -= meleeDmg;
          player.dmgFlash = 0.2;
          b.atkCd = 1.5;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(5);
          player.vel.copy(kd);
          player.vel.y = 3;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0x558b2f, 8, 4);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }

        if (b.stateTimer <= 0) {
          b.state = 'burrowing';
          b.stateTimer = 0.5;
          b.originalScale = 1;
        }
        break;
      }

      case 'burrowing': {
        b.stateTimer -= dt;
        // Shrink into ground
        const progress = 1 - (b.stateTimer / 0.5);
        const scale = Math.max(0.01, 1 - progress);
        b.mesh.scale.setScalar(scale);
        b.mesh.position.y = b.y - progress * 3;

        // Dust at burrow point
        if (Math.random() < 0.4) {
          spawnParticles(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0x8d6e63, 3, 4);
        }

        if (b.stateTimer <= 0) {
          b.mesh.visible = false;
          b.mesh.scale.setScalar(1);
          b.state = 'underground';
          b.stateTimer = 2;
          b.burrowX = b.x;
          b.burrowZ = b.z;
          b.burrowTrailTimer = 0;
        }
        break;
      }

      case 'underground': {
        b.stateTimer -= dt;
        b.burrowTrailTimer -= dt;

        // Move underground toward player
        const ugSpeed = 10;
        const ugDx = player.pos.x - b.burrowX;
        const ugDz = player.pos.z - b.burrowZ;
        const ugDist = Math.sqrt(ugDx * ugDx + ugDz * ugDz);

        if (ugDist > 1) {
          b.burrowX += (ugDx / ugDist) * ugSpeed * dt;
          b.burrowZ += (ugDz / ugDist) * ugSpeed * dt;
        }

        // Dust trail
        if (b.burrowTrailTimer <= 0) {
          const trailY = getTerrainHeight(b.burrowX, b.burrowZ);
          spawnParticles(new THREE.Vector3(b.burrowX, trailY + 0.3, b.burrowZ), 0x8d6e63, 3, 3);
          spawnParticles(new THREE.Vector3(b.burrowX, trailY + 0.2, b.burrowZ), 0x4e342e, 2, 2);
          b.burrowTrailTimer = 0.1;
        }

        if (b.stateTimer <= 0) {
          // Emerge at current burrow position (near player)
          b.x = b.burrowX;
          b.z = b.burrowZ;
          b.y = getTerrainHeight(b.x, b.z);
          b.state = 'emerging';
          b.stateTimer = 0.6;
        }
        break;
      }

      case 'emerging': {
        b.stateTimer -= dt;
        b.mesh.visible = true;

        const progress = 1 - (b.stateTimer / 0.6);
        const scale = Math.min(1, progress);
        b.mesh.scale.setScalar(scale);
        b.mesh.position.y = b.y + progress * 3 - 1;

        // Emergence particles
        if (Math.random() < 0.5) {
          spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0x8d6e63, 4, 6);
          spawnParticles(new THREE.Vector3(b.x, b.y + 2, b.z), 0x558b2f, 2, 4);
        }

        if (b.stateTimer <= 0) {
          b.mesh.scale.setScalar(1);
          b.mesh.position.y = b.y;

          // AoE damage on emerge
          const emDx = player.pos.x - b.x;
          const emDz = player.pos.z - b.z;
          const emDist = Math.sqrt(emDx * emDx + emDz * emDz);
          if (emDist < 6 && player.invuln <= 0 && player.alive) {
            player.hp -= 25;
            player.dmgFlash = 0.3;
            player.vel.y = 10;
            const kd = new THREE.Vector3(emDx, 0, emDz).normalize().multiplyScalar(10);
            player.vel.x = kd.x;
            player.vel.z = kd.z;
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 12, 6);
            if (player.hp <= 0) {
              player.alive = false;
              document.getElementById('death-screen').style.display = 'flex';
              document.exitPointerLock();
            }
          }

          // Big particle burst
          spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0x8d6e63, 20, 10);
          spawnParticles(new THREE.Vector3(b.x, b.y + 2, b.z), 0x558b2f, 10, 6);

          // Phase 2: chain burrow
          if (b.phase === 2 && b.emergeChain < 1) {
            b.emergeChain++;
            b.state = 'burrowing';
            b.stateTimer = 0.5;
          } else {
            b.emergeChain = 0;
            b.state = 'toxicspit';
            b.stateTimer = 1.0;
          }
        }
        break;
      }

      case 'toxicspit': {
        b.stateTimer -= dt;

        // Spit animation
        b.mesh.rotation.x = Math.sin((1 - b.stateTimer / 1.0) * Math.PI) * -0.4;

        if (b.stateTimer <= 0.5 && b.stateTimer > 0.45) {
          // Fire toxic projectiles
          const count = b.phase === 2 ? 3 : 1;
          for (let i = 0; i < count; i++) {
            const angle = Math.atan2(player.pos.z - b.z, player.pos.x - b.x);
            const spread = count > 1 ? ((i - (count - 1) / 2) * 0.4) : 0;
            const speed = 14;
            spawnProjectile({
              x: b.x, y: b.y + 5, z: b.z,
              vx: Math.cos(angle + spread) * speed,
              vy: 6,
              vz: Math.sin(angle + spread) * speed,
              damage: 12,
              lifetime: 4,
              type: 'toxic',
              radius: 0.6,
              onHitPlayer: (p) => {
                // Create poison puddle where it lands
                spawnHazard({
                  x: p.x, z: p.z, y: getTerrainHeight(p.x, p.z),
                  type: 'poison',
                  damage: 5,
                  duration: 6,
                  maxRadius: 3
                });
              }
            });
          }
          spawnParticles(new THREE.Vector3(b.x, b.y + 5, b.z), 0x76ff03, 8, 5);
        }

        if (b.stateTimer <= 0) {
          b.mesh.rotation.x = 0;
          b.state = 'surface';
          b.stateTimer = 8;
        }
        break;
      }
    }
  },

  onHit(b, dmg) {
    // If underground, immune
    if (b.state === 'underground') {
      // No damage while underground (handled by visibility/hitbox check in boss.js)
    }
  },

  cleanup(b) {
    b.mesh.visible = true;
    b.mesh.scale.setScalar(1);
    b.mesh.rotation.x = 0;
  }
};

// ─────────────────────────────────────────────────
// BOSS 4: POLKOVNIK NOZHOV (colonel knives) - Knives + Dash Combo + Counter
// ─────────────────────────────────────────────────
const bossAiNozhov = {
  init(b) {
    b.state = 'idle';
    b.stateTimer = 1.5;
    b.countering = false;
    b.dashCount = 0;
    b.dashDir = new THREE.Vector3();
    b.dashPause = 0;
    b.counterGlowMat = null;
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0) {
      b.countering = false;
      return;
    }

    switch (b.state) {
      case 'idle': {
        b.stateTimer -= dt;
        b.countering = false;

        // Pursue player
        if (dist > 5) {
          const spd = b.phase === 2 ? 6 : 4;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }

        if (b.stateTimer <= 0) {
          if (dist > 6) {
            b.state = 'knifethrow';
            b.stateTimer = 0.8;
          } else {
            b.state = 'dashcombo';
            b.stateTimer = 0.3;
            b.dashCount = 0;
            b.dashPause = 0;
          }
        }
        break;
      }

      case 'knifethrow': {
        b.stateTimer -= dt;

        // Wind up animation
        b.mesh.rotation.z = Math.sin(b.stateTimer * 12) * 0.15;

        if (b.stateTimer <= 0.3 && b.stateTimer > 0.25) {
          // Throw knives
          const count = b.phase === 2 ? 5 : 3;
          const baseAngle = Math.atan2(player.pos.z - b.z, player.pos.x - b.x);
          const spread = b.phase === 2 ? 0.25 : 0.2;

          for (let i = 0; i < count; i++) {
            const offset = ((i - (count - 1) / 2) / Math.max(1, (count - 1) / 2)) * spread;
            const angle = baseAngle + offset;
            const speed = 20;

            spawnProjectile({
              x: b.x, y: b.y + 4, z: b.z,
              vx: Math.cos(angle) * speed,
              vy: 0,
              vz: Math.sin(angle) * speed,
              damage: 18,
              lifetime: 3,
              type: 'knife',
              radius: 0.4
            });
          }

          spawnParticles(new THREE.Vector3(b.x, b.y + 4, b.z), 0xeceff1, 6, 4);
        }

        if (b.stateTimer <= 0) {
          b.mesh.rotation.z = 0;
          b.state = 'dashcombo';
          b.stateTimer = 0.3;
          b.dashCount = 0;
          b.dashPause = 0;
        }
        break;
      }

      case 'dashcombo': {
        const maxDashes = b.phase === 2 ? 5 : 3;

        if (b.dashPause > 0) {
          // Pause between dashes
          b.dashPause -= dt;
          if (b.dashPause <= 0 && b.dashCount < maxDashes) {
            // Start next dash with zigzag
            const zigzag = (b.dashCount % 2 === 0) ? 1 : -1;
            const baseAngle = Math.atan2(dz, dx);
            const perpAngle = baseAngle + (Math.PI / 2) * zigzag * 0.5;
            b.dashDir.set(
              Math.cos(perpAngle) * 0.4 + dx / Math.max(1, dist) * 0.6,
              0,
              Math.sin(perpAngle) * 0.4 + dz / Math.max(1, dist) * 0.6
            ).normalize();
            b.stateTimer = 0.3;
          }
        } else {
          b.stateTimer -= dt;
          const dashSpeed = 20;
          b.x += b.dashDir.x * dashSpeed * dt;
          b.z += b.dashDir.z * dashSpeed * dt;
          b.mesh.rotation.z += dt * 20;

          // Dash trail
          spawnParticles(new THREE.Vector3(b.x, b.y + 2, b.z), 0x455a64, 2, 3);

          // Hit player during dash
          if (dist < 3.5 && player.invuln <= 0 && player.alive) {
            player.hp -= 20;
            player.dmgFlash = 0.25;
            const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(10);
            player.vel.copy(kd);
            player.vel.y = 5;
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc62828, 8, 5);
            if (player.hp <= 0) {
              player.alive = false;
              document.getElementById('death-screen').style.display = 'flex';
              document.exitPointerLock();
            }
          }

          if (b.stateTimer <= 0) {
            b.dashCount++;
            b.mesh.rotation.z = 0;
            if (b.dashCount >= maxDashes) {
              b.state = 'counter';
              b.stateTimer = b.phase === 2 ? 1.5 : 2.0;
              b.countering = true;
            } else {
              b.dashPause = 0.2;
              // Set up next dash direction
              b.dashDir.set(dx, 0, dz).normalize();
            }
          }
        }
        break;
      }

      case 'counter': {
        b.stateTimer -= dt;
        b.countering = true;

        // Yellow glow taunt animation
        if (b.mesh.userData.body) {
          b.mesh.userData.body.material.emissive.set(0xffd700);
          b.mesh.userData.body.material.emissiveIntensity = 0.5 + Math.sin(b.stateTimer * 8) * 0.3;
        }

        // Taunt pose - arms up
        b.mesh.rotation.z = Math.sin(b.stateTimer * 6) * 0.1;

        if (b.stateTimer <= 0) {
          b.countering = false;
          b.mesh.rotation.z = 0;
          // Exhausted - stunned
          b.stunTimer = 1.5;
          if (b.mesh.userData.body) {
            b.mesh.userData.body.material.emissiveIntensity = 0;
          }
          b.state = 'recover';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'recover': {
        b.stateTimer -= dt;
        b.countering = false;
        if (b.stateTimer <= 0) {
          b.state = 'idle';
          b.stateTimer = 1.5;
        }
        break;
      }
    }
  },

  onHit(b, dmg) {
    if (b.countering) {
      // Parry! Counter damage to player
      b.hp += dmg; // Negate the damage that was already applied
      if (player.invuln <= 0 && player.alive) {
        player.hp -= 35;
        player.dmgFlash = 0.4;
        const dx = player.pos.x - b.x;
        const dz = player.pos.z - b.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(15);
        player.vel.copy(kd);
        player.vel.y = 8;
        spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xffd700, 15, 8);
        spawnParticles(new THREE.Vector3(b.x, b.y + 3, b.z), 0xffd700, 10, 6);
        if (player.hp <= 0) {
          player.alive = false;
          document.getElementById('death-screen').style.display = 'flex';
          document.exitPointerLock();
        }
      }
      // End counter stance
      b.countering = false;
      b.state = 'idle';
      b.stateTimer = 1.0;
      if (b.mesh.userData.body) {
        b.mesh.userData.body.material.emissiveIntensity = 0;
      }
    }
  },

  cleanup(b) {
    b.countering = false;
    b.mesh.rotation.z = 0;
    if (b.mesh.userData.body) {
      b.mesh.userData.body.material.emissiveIntensity = 0;
    }
  }
};

// ─────────────────────────────────────────────────
// BOSS 5: JEAN-PIERRE DUVAL (chef) - Food + Fire + Healing
// ─────────────────────────────────────────────────
const bossAiDuval = {
  init(b) {
    b.state = 'idle';
    b.stateTimer = 1.5;
    b.healingDone = false;
    b.healingDmgAccum = 0;
    b.healingInterrupted = false;
  },

  update(dt, b, dist, dx, dz) {
    if (b.stunTimer > 0) return;

    switch (b.state) {
      case 'idle': {
        b.stateTimer -= dt;

        // Pursue
        if (dist > 5) {
          const spd = b.phase === 2 ? 5 : 3.5;
          b.x += (dx / dist) * spd * dt;
          b.z += (dz / dist) * spd * dt;
        }

        // Melee if close
        if (dist < 4 && b.atkCd <= 0 && player.invuln <= 0 && player.alive) {
          const meleeDmg = b.phase === 2 ? 18 : 12;
          player.hp -= meleeDmg;
          player.dmgFlash = 0.2;
          b.atkCd = 1.0;
          const kd = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(5);
          player.vel.copy(kd);
          player.vel.y = 3;
          spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xfafafa, 6, 4);
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }

        if (b.stateTimer <= 0) {
          // Check for healing phase
          if (b.hp < b.maxHp * 0.3 && !b.healingDone) {
            b.state = 'healing';
            b.stateTimer = 5;
            b.healingDmgAccum = 0;
            b.healingInterrupted = false;
          } else {
            b.state = 'foodthrow';
            b.stateTimer = 1.2;
          }
        }
        break;
      }

      case 'foodthrow': {
        b.stateTimer -= dt;

        // Chef toss animation
        b.mesh.rotation.z = Math.sin((1 - b.stateTimer / 1.2) * Math.PI) * 0.3;

        if (b.stateTimer <= 0.6 && b.stateTimer > 0.55) {
          // Throw food projectiles
          const count = b.phase === 2 ? 5 : 3;
          const baseAngle = Math.atan2(player.pos.z - b.z, player.pos.x - b.x);

          for (let i = 0; i < count; i++) {
            const spread = ((i - (count - 1) / 2) / Math.max(1, (count - 1) / 2)) * 0.5;
            const angle = baseAngle + spread;
            const speed = 12 + Math.random() * 4;
            const launchAngle = 0.5 + Math.random() * 0.3; // Arc height

            spawnProjectile({
              x: b.x, y: b.y + 6, z: b.z,
              vx: Math.cos(angle) * speed,
              vy: speed * Math.sin(launchAngle),
              vz: Math.sin(angle) * speed,
              damage: 12,
              lifetime: 4,
              type: 'food',
              radius: 0.5
            });
          }

          spawnParticles(new THREE.Vector3(b.x, b.y + 6, b.z), 0xff9800, 8, 5);
        }

        if (b.stateTimer <= 0) {
          b.mesh.rotation.z = 0;
          b.state = 'fireaoe';
          b.stateTimer = 1.0;
        }
        break;
      }

      case 'fireaoe': {
        b.stateTimer -= dt;

        // Stomp animation
        b.mesh.position.y = b.y + Math.abs(Math.sin(b.stateTimer * 8)) * 1;

        if (b.stateTimer <= 0.5 && b.stateTimer > 0.45) {
          // Spawn fire AoE
          const fireDuration = b.phase === 2 ? 6 : 4;
          const fireRadius = b.phase === 2 ? 12 : 10;
          spawnHazard({
            x: b.x, z: b.z, y: b.y,
            type: 'fire',
            damage: 8,
            duration: fireDuration,
            maxRadius: fireRadius
          });

          spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0xff6d00, 15, 8);
          spawnParticles(new THREE.Vector3(b.x, b.y + 1, b.z), 0xff1744, 10, 6);
        }

        if (b.stateTimer <= 0) {
          b.state = 'recover';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'healing': {
        b.stateTimer -= dt;

        // Healing bob animation
        b.mesh.position.y = b.y + Math.sin(b.stateTimer * 5) * 0.5 + 1;

        // Green healing glow
        if (b.mesh.userData.body) {
          b.mesh.userData.body.material.emissive.set(0x76ff03);
          b.mesh.userData.body.material.emissiveIntensity = 0.3 + Math.sin(b.stateTimer * 8) * 0.2;
        }

        // Heal
        const healRate = b.phase === 2 ? 0.04 : 0.03;
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * healRate * dt);

        // Healing particles
        if (Math.random() < 0.3) {
          const angle = Math.random() * Math.PI * 2;
          spawnParticles(
            new THREE.Vector3(b.x + Math.cos(angle) * 2, b.y + 2 + Math.random() * 3, b.z + Math.sin(angle) * 2),
            0x76ff03, 1, 2
          );
        }

        // Check for interruption
        if (b.healingDmgAccum >= 50) {
          b.healingInterrupted = true;
          b.healingDone = true;
          spawnParticles(new THREE.Vector3(b.x, b.y + 4, b.z), 0xff1744, 15, 8);
          if (b.mesh.userData.body) {
            b.mesh.userData.body.material.emissiveIntensity = 0;
          }
          b.state = 'recover';
          b.stateTimer = 2;
        }

        if (b.stateTimer <= 0) {
          b.healingDone = true;
          if (b.mesh.userData.body) {
            b.mesh.userData.body.material.emissiveIntensity = 0;
          }
          b.state = 'recover';
          b.stateTimer = 1.5;
        }
        break;
      }

      case 'recover': {
        b.stateTimer -= dt;
        if (b.stateTimer <= 0) {
          b.state = 'idle';
          b.stateTimer = 1.5;
        }
        break;
      }
    }
  },

  onHit(b, dmg) {
    if (b.state === 'healing') {
      b.healingDmgAccum += dmg;
    }
  },

  cleanup(b) {
    b.mesh.rotation.z = 0;
    if (b.mesh.userData.body) {
      b.mesh.userData.body.material.emissiveIntensity = 0;
    }
  }
};

// ─────────────────────────────────────────────────
// Export all boss AIs indexed by boss number
// ─────────────────────────────────────────────────
export const BOSS_AIS = [
  bossAiHrusch,
  bossAiSharlotta,
  bossAiKarlusha,
  bossAiCherv,
  bossAiNozhov,
  bossAiDuval
];
