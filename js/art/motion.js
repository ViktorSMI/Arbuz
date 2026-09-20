import * as THREE from 'three';
import { simulateCape } from './cloth-physics.js';

/** Exact critically-damped spring: stable even after a slow browser frame. */
export function spring(state, target, dt, frequency = 12) {
  if (!(dt > 0) || !Number.isFinite(target)) return state.value;
  const step = Math.min(dt, .1), offset = state.value - target;
  const c = state.velocity + frequency * offset, decay = Math.exp(-frequency * step);
  state.value = target + (offset + c * step) * decay;
  state.velocity = (state.velocity - frequency * c * step) * decay;
  return state.value;
}

/** Planar two-bone IK; unreachable targets are clamped without stretching bones. */
export function solveLeg(forward, down, upper = .29, lower = .24) {
  if (![forward, down, upper, lower].every(Number.isFinite) || upper <= 0 || lower <= 0) return { hip: 0, knee: 0 };
  const distance = THREE.MathUtils.clamp(Math.hypot(forward, down), Math.abs(upper - lower) + .0001, upper + lower - .0001);
  const acos = value => Math.acos(THREE.MathUtils.clamp(value, -1, 1));
  return {
    hip: Math.atan2(-forward, down) - acos((upper * upper + distance * distance - lower * lower) / (2 * upper * distance)),
    knee: Math.PI - acos((upper * upper + lower * lower - distance * distance) / (2 * upper * lower)),
  };
}

const memories = new WeakMap();
function memory(root) {
  if (!memories.has(root)) memories.set(root, {
    lean: { value: 0, velocity: 0 }, roll: { value: 0, velocity: 0 },
    cape: { value: 0, velocity: 0 }, turn: { value: 0, velocity: 0 },
    previous: root.position.clone(), yaw: root.rotation.y, speed: 0,
    point: new THREE.Vector3(), target: new THREE.Vector3(), time: 0,
  });
  return memories.get(root);
}

/**
 * Legacy deterministic deformation retained for non-simulated previews and tests.
 * Runtime hero cloth uses the Verlet solver in cloth-physics.js.
 */
export function deformCloth(mesh, time, motion = 0, turn = 0) {
  const rest = mesh.userData.clothRest;
  if (!rest) return;
  const p = mesh.geometry.attributes.position, length = mesh.userData.clothLength || 1;
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const weight = Math.max(0, Math.min(1, -y / length));
    const ripple = Math.sin(time * 4.2 + x * 7 - weight * 5.5) * .035 + Math.sin(time * 6.3 - weight * 8) * .016;
    p.setXYZ(i, x + turn * weight * weight * .16, y + Math.abs(ripple) * weight,
      z - weight * weight * motion * .25 + ripple * weight);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

export function secondaryMotion(root, dt, state, speed = 0, time = 0) {
  const j = root.userData.joints, m = memory(root);
  const active = ['walk', 'run', 'swim', 'dodge'].includes(state);
  const yawDelta = Math.atan2(Math.sin(root.rotation.y - m.yaw), Math.cos(root.rotation.y - m.yaw));
  const turn = dt > 0 ? THREE.MathUtils.clamp(yawDelta / dt, -3, 3) : 0;
  m.yaw = root.rotation.y;
  const tilt = spring(m.turn, turn, dt, 7);
  const targetFlow = active ? Math.max(speed, state === 'dodge' ? 1.25 : 0) : 0;
  const flow = spring(m.cape, targetFlow, dt, 6);
  if (j.cape) {
    // The old anchor lived inside the rear ellipsoid. Keep the collar outside
    // the rind and let the particles provide the trailing motion.
    if (!j.cape.userData.physicalAnchor) {
      j.cape.userData.physicalAnchor = {
        x: j.cape.position.x,
        y: Math.max(.43, j.cape.position.y),
        z: Math.min(-.76, j.cape.position.z),
      };
    }
    const anchor = j.cape.userData.physicalAnchor;
    j.cape.position.set(anchor.x, anchor.y, anchor.z);
    j.cape.rotation.x = -.035 + Math.sin(time * 2.1) * .006;
    j.cape.rotation.z = -tilt * .018;
  }
  if (j.stem) { j.stem.rotation.z = Math.sin(time * 2.7) * .035 - tilt * .06; j.stem.rotation.x = -flow * .06; }
  if (j.tail) j.tail.rotation.y = Math.sin(time * 2.8) * .19 - tilt * .08;
  for (const mesh of root.userData.cloth || []) {
    simulateCape(mesh, root, dt, time, { motion: flow, turn: tilt, rolling: state === 'dodge' });
  }
  for (const [i, eye] of (root.userData.eyes || []).entries()) {
    const phase = (time + i * .015) % 4.7;
    const blink = phase < .13 ? Math.sin(phase / .13 * Math.PI) : 0;
    eye.scale.y = eye.userData.openScale * (1 - blink * .94);
  }
}

/** Add ground adaptation to the authored pose, never to the simulation transform. */
export function groundHero(root, dt, player, movement) {
  const m = memory(root), j = root.userData.joints;
  if (!j.hip || dt <= 0) return;
  const distance = root.position.distanceTo(m.previous);
  const speed = distance > 2 ? 0 : Math.min(15, distance / dt);
  m.previous.copy(root.position);
  m.speed = THREE.MathUtils.lerp(m.speed, speed, 1 - Math.exp(-dt * 10));
  root.userData.visualSpeed = m.speed;
  const locomotion = ['idle', 'walk', 'run', 'land'].includes(root.userData.animationState);
  const forwardLean = locomotion && player.grounded ? Math.min(.12, m.speed * .009) : 0;
  j.hip.rotation.x += spring(m.lean, forwardLean, dt, 12);
  if (!locomotion || !player.grounded || typeof movement.getHeight !== 'function') return;
  root.updateMatrixWorld(true);
  let adapted = 0;
  for (const side of ['L', 'R']) {
    const leg = j[`leg${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
    if (!leg || !knee || !ankle) continue;
    ankle.getWorldPosition(m.point);
    const height = movement.getHeight(m.point.x, m.point.z);
    if (!Number.isFinite(height)) continue;
    // Lifted swing feet retain their animation; planted feet follow the slope.
    const error = height + .09 - m.point.y;
    if (error < -.17) continue;
    m.target.copy(m.point); m.target.y += THREE.MathUtils.clamp(error, -.12, .22);
    j.hip.worldToLocal(m.target).sub(leg.position);
    const solved = solveLeg(m.target.z, -m.target.y);
    leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, solved.hip, .85);
    knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, solved.knee, .85);
    const yaw = root.rotation.y, dx = Math.sin(yaw) * .12, dz = Math.cos(yaw) * .12;
    const slope = Math.atan2(movement.getHeight(m.point.x + dx, m.point.z + dz) - movement.getHeight(m.point.x - dx, m.point.z - dz), .24);
    ankle.rotation.x = THREE.MathUtils.clamp(-slope - leg.rotation.x - knee.rotation.x - j.hip.rotation.x, -.9, .9);
    adapted++;
  }
  root.userData.groundAdaptedFeet = adapted;
}
