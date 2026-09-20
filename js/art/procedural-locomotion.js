import * as THREE from 'three';
import { DODGE_DURATION, DODGE_SPEED, PLAYER_SPRINT } from '../constants.js';
import { solveLeg, spring } from './motion.js';

export const PROCEDURAL_LOCOMOTION_VERSION = 'distance-gait-1';
export const PROCEDURAL_HERO_STATES = Object.freeze(['walk', 'run', 'dodge']);

const TAU = Math.PI * 2;
const controllers = new WeakMap();
const clamp = THREE.MathUtils.clamp;
const smoothstep = (a, b, x) => {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (value, target, frequency, dt) => THREE.MathUtils.lerp(value, target, 1 - Math.exp(-frequency * Math.max(0, dt)));
const wrap01 = value => ((value % 1) + 1) % 1;

export function advanceStridePhase(phase, distance, strideDistance) {
  if (!Number.isFinite(phase)) phase = 0;
  if (!(distance > 0) || !(strideDistance > 0)) return wrap01(phase);
  return wrap01(phase + distance / strideDistance);
}

export function rollAngleFromDistance(distance, radius = DODGE_SPEED * DODGE_DURATION / TAU) {
  if (!(distance > 0) || !(radius > 0)) return 0;
  return distance / radius;
}

export function sampleFootCycle(phase, runBlend = 0, sideOffset = 0) {
  const cycle = wrap01(phase + sideOffset);
  const stanceRatio = THREE.MathUtils.lerp(.64, .54, clamp(runBlend, 0, 1));
  const stance = cycle < stanceRatio;
  if (stance) {
    const t = cycle / stanceRatio;
    return { cycle, stance, progress: t, travel: 1 - t * 2, lift: 0, contact: 1 - smoothstep(.86, 1, t) };
  }
  const t = (cycle - stanceRatio) / (1 - stanceRatio);
  const travel = THREE.MathUtils.lerp(-1, 1, smoothstep(0, 1, t));
  const lift = Math.pow(Math.sin(Math.PI * t), 1.25);
  return { cycle, stance, progress: t, travel, lift, contact: 0 };
}

function horizontalLength(vector) {
  return Math.hypot(vector.x, vector.z);
}

function localDirection(root, vector, target) {
  const length = horizontalLength(vector);
  if (length < 1e-5) return target.set(0, 0, 1);
  const yaw = root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
  target.set((c * vector.x - s * vector.z) / length, 0, (s * vector.x + c * vector.z) / length);
  return target;
}

function setAxis(object, axis, target, weight) {
  object.rotation[axis] = THREE.MathUtils.lerp(object.rotation[axis], target, clamp(weight, 0, 1));
}

function worldFromRoot(root, x, y, z, target) {
  const yaw = root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
  target.set(
    root.position.x + c * x + s * z,
    root.position.y + y,
    root.position.z - s * x + c * z,
  );
  return target;
}

function finiteHeight(getHeight, x, z, fallback) {
  if (typeof getHeight !== 'function') return fallback;
  const value = getHeight(x, z);
  return Number.isFinite(value) ? value : fallback;
}

class ProceduralHeroLocomotion {
  constructor(root) {
    this.root = root;
    this.joints = root.userData.joints;
    this.previousPosition = root.position.clone();
    this.previousYaw = root.rotation.y;
    this.phase = 0;
    this.distance = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.acceleration = 0;
    this.previousSpeed = 0;
    this.weight = { value: 0, velocity: 0 };
    this.lean = { value: 0, velocity: 0 };
    this.sideLean = { value: 0, velocity: 0 };
    this.turnLean = { value: 0, velocity: 0 };
    this.direction = new THREE.Vector3(0, 0, 1);
    this.velocity = new THREE.Vector3();
    this.delta = new THREE.Vector3();
    this.temp = new THREE.Vector3();
    this.temp2 = new THREE.Vector3();
    this.rollQuaternion = new THREE.Quaternion();
    this.rollAxis = new THREE.Vector3(1, 0, 0);
    this.roll = { active: false, distance: 0, angle: 0, angularVelocity: 0, radius: DODGE_SPEED * DODGE_DURATION / TAU };
    this.feet = {
      L: { planted: false, wasStance: false, anchor: new THREE.Vector3(), swingStart: new THREE.Vector3(), landing: new THREE.Vector3() },
      R: { planted: false, wasStance: false, anchor: new THREE.Vector3(), swingStart: new THREE.Vector3(), landing: new THREE.Vector3() },
    };
    this.restHipY = this.joints.hip?.position.y || 0;
  }

  measure(dt, player) {
    this.delta.copy(this.root.position).sub(this.previousPosition);
    this.previousPosition.copy(this.root.position);
    let distance = horizontalLength(this.delta);
    if (!Number.isFinite(distance) || distance > 3) {
      distance = 0;
      for (const foot of Object.values(this.feet)) foot.planted = foot.wasStance = false;
    }
    const velocitySpeed = player?.vel ? Math.hypot(player.vel.x || 0, player.vel.z || 0) : 0;
    const measuredSpeed = dt > 0 && distance > 1e-6 ? distance / dt : velocitySpeed;
    const targetSpeed = Math.min(PLAYER_SPRINT * 1.4, Math.max(measuredSpeed, velocitySpeed * .8));
    const oldSpeed = this.speed;
    this.speed = damp(this.speed, targetSpeed, 13, dt);
    this.acceleration = damp(this.acceleration, dt > 0 ? (this.speed - oldSpeed) / dt : 0, 8, dt);
    this.previousSpeed = oldSpeed;

    if (player?.vel && horizontalLength(player.vel) > .01) this.velocity.set(player.vel.x, 0, player.vel.z);
    else if (dt > 0) this.velocity.set(this.delta.x / dt, 0, this.delta.z / dt);
    else this.velocity.set(0, 0, 0);
    localDirection(this.root, this.velocity, this.direction);
    this.forwardSpeed = damp(this.forwardSpeed, this.speed * this.direction.z, 12, dt);
    this.lateralSpeed = damp(this.lateralSpeed, this.speed * this.direction.x, 12, dt);

    const yawDelta = Math.atan2(Math.sin(this.root.rotation.y - this.previousYaw), Math.cos(this.root.rotation.y - this.previousYaw));
    this.previousYaw = this.root.rotation.y;
    this.yawRate = dt > 0 ? clamp(yawDelta / dt, -5, 5) : 0;
    this.distance += distance;
    return distance;
  }

  predictedFoot(side, sample, stepLength, stepHeight, phaseRate, movement, target) {
    const sign = side === 'L' ? -1 : 1;
    const leg = this.joints[`leg${side}`];
    const foot = this.feet[side];
    const moveX = this.direction.x * sample.travel * stepLength * .5;
    const moveZ = this.direction.z * sample.travel * stepLength * .5;
    const sideLead = this.direction.x * sample.lift * stepLength * .08;
    const localX = (leg?.position.x || sign * .29) + moveX + sideLead;
    const localZ = moveZ;
    const ground = finiteHeight(movement.getHeight,
      this.root.position.x + Math.cos(this.root.rotation.y) * localX + Math.sin(this.root.rotation.y) * localZ,
      this.root.position.z - Math.sin(this.root.rotation.y) * localX + Math.cos(this.root.rotation.y) * localZ,
      this.root.position.y);
    worldFromRoot(this.root, localX, ground - this.root.position.y + .075 + sample.lift * stepHeight, localZ, target);

    if (sample.stance) {
      if (!foot.wasStance || !foot.planted) {
        foot.anchor.copy(target);
        foot.anchor.y = ground + .075;
        foot.planted = true;
        this.root.userData.footstepSerial = (this.root.userData.footstepSerial || 0) + 1;
        this.root.userData.lastFootstep = side;
      }
      target.copy(foot.anchor);
      target.y = finiteHeight(movement.getHeight, target.x, target.z, target.y - .075) + .075;
    } else {
      if (foot.wasStance || !foot.swingStart.lengthSq()) foot.swingStart.copy(foot.anchor.lengthSq() ? foot.anchor : target);
      foot.planted = false;
      const remaining = phaseRate > .001 ? (1 - sample.cycle) / phaseRate : 0;
      const futureX = this.root.position.x + this.velocity.x * remaining;
      const futureZ = this.root.position.z + this.velocity.z * remaining;
      const landingLocalX = (leg?.position.x || sign * .29) + this.direction.x * stepLength * .5;
      const landingLocalZ = this.direction.z * stepLength * .5;
      const yaw = this.root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
      foot.landing.set(futureX + c * landingLocalX + s * landingLocalZ, 0, futureZ - s * landingLocalX + c * landingLocalZ);
      foot.landing.y = finiteHeight(movement.getHeight, foot.landing.x, foot.landing.z, this.root.position.y) + .075;
      target.lerpVectors(foot.swingStart, foot.landing, smoothstep(0, 1, sample.progress));
      const baseGround = finiteHeight(movement.getHeight, target.x, target.z, target.y - .075);
      target.y = baseGround + .075 + sample.lift * stepHeight;
    }
    foot.wasStance = sample.stance;
    return target;
  }

  applyLeg(side, targetWorld, sample, movement, weight) {
    const j = this.joints;
    const leg = j[`leg${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
    if (!leg || !knee || !ankle || !j.hip) return;
    this.root.updateMatrixWorld(true);
    this.temp.copy(targetWorld);
    j.hip.worldToLocal(this.temp).sub(leg.position);
    const solved = solveLeg(this.temp.z, -this.temp.y);
    setAxis(leg, 'x', solved.hip, weight);
    setAxis(leg, 'z', clamp(-this.temp.x * 1.45, -.42, .42), weight * .85);
    setAxis(knee, 'x', solved.knee, weight);

    const yaw = this.root.rotation.y;
    const fx = Math.sin(yaw) * .13, fz = Math.cos(yaw) * .13;
    const hForward = finiteHeight(movement.getHeight, targetWorld.x + fx, targetWorld.z + fz, targetWorld.y)
      - finiteHeight(movement.getHeight, targetWorld.x - fx, targetWorld.z - fz, targetWorld.y);
    const slope = Math.atan2(hForward, .26);
    const toeLift = sample.stance ? 0 : sample.lift * .35;
    const ankleTarget = clamp(-slope - leg.rotation.x - knee.rotation.x - j.hip.rotation.x + toeLift, -1.05, 1.05);
    setAxis(ankle, 'x', ankleTarget, weight);
  }

  applyGait(dt, player, movement, state, distance) {
    const j = this.joints;
    if (!j.hip) return { applied: false, speed: this.speed, normalizedSpeed: 0 };
    const active = (state === 'walk' || state === 'run') && player.grounded !== false;
    const weight = spring(this.weight, active ? 1 : 0, dt, active ? 18 : 14);
    if (!active && weight < .002) {
      for (const foot of Object.values(this.feet)) foot.planted = foot.wasStance = false;
      return { applied: false, speed: this.speed, normalizedSpeed: clamp(this.speed / PLAYER_SPRINT, 0, 1) };
    }

    const runBlend = clamp((this.speed - 5.5) / (PLAYER_SPRINT - 5.5), 0, 1);
    const strideDistance = THREE.MathUtils.lerp(2.55, 4.15, runBlend);
    this.phase = advanceStridePhase(this.phase, active ? distance : 0, strideDistance);
    const phaseRate = strideDistance > 0 ? this.speed / strideDistance : 0;
    const stepLength = THREE.MathUtils.lerp(.27, .48, runBlend);
    const stepHeight = THREE.MathUtils.lerp(.085, .19, runBlend);
    const wave = Math.sin(this.phase * TAU);
    const doubleSupport = Math.abs(Math.sin(this.phase * TAU));
    const directionForward = this.direction.z;
    const directionSide = this.direction.x;

    const forwardLean = clamp(this.forwardSpeed / PLAYER_SPRINT * .16 + this.acceleration * .004, -.12, .24);
    const lateralLean = clamp(-this.lateralSpeed / PLAYER_SPRINT * .11 - this.yawRate * .025, -.18, .18);
    const hipTwist = wave * THREE.MathUtils.lerp(.045, .095, runBlend) * directionForward;
    j.hip.position.y = THREE.MathUtils.lerp(j.hip.position.y, this.restHipY - doubleSupport * THREE.MathUtils.lerp(.018, .052, runBlend), weight);
    setAxis(j.hip, 'x', spring(this.lean, forwardLean, dt, 12), weight);
    setAxis(j.hip, 'z', spring(this.sideLean, lateralLean, dt, 11), weight);
    setAxis(j.hip, 'y', hipTwist + directionSide * wave * .04, weight);

    const armAmplitude = THREE.MathUtils.lerp(.38, .82, runBlend);
    for (const [side, sign] of [['L', 1], ['R', -1]]) {
      const arm = j[`arm${side}`], elbow = j[`elbow${side}`];
      if (!arm || !elbow) continue;
      const swing = wave * sign;
      const armX = -swing * armAmplitude * directionForward - Math.abs(directionSide) * .12;
      const armZ = (side === 'L' ? .17 : -.15) - swing * armAmplitude * directionSide * .55;
      const elbowX = -.18 - Math.max(0, swing) * THREE.MathUtils.lerp(.18, .48, runBlend);
      setAxis(arm, 'x', armX, weight);
      setAxis(arm, 'z', armZ, weight);
      setAxis(elbow, 'x', elbowX, weight);
    }

    const left = sampleFootCycle(this.phase, runBlend, 0);
    const right = sampleFootCycle(this.phase, runBlend, .5);
    this.applyLeg('L', this.predictedFoot('L', left, stepLength, stepHeight, phaseRate, movement, this.temp2), left, movement, weight);
    this.applyLeg('R', this.predictedFoot('R', right, stepLength, stepHeight, phaseRate, movement, this.temp2), right, movement, weight);

    this.root.userData.groundAdaptedFeet = 2;
    this.root.userData.visualSpeed = this.speed;
    this.root.userData.gait = {
      version: PROCEDURAL_LOCOMOTION_VERSION,
      phase: this.phase,
      speed: this.speed,
      strideDistance,
      stepLength,
      runBlend,
      contacts: { L: left.stance, R: right.stance },
      direction: { x: this.direction.x, z: this.direction.z },
    };
    return { applied: true, speed: this.speed, normalizedSpeed: clamp(this.speed / PLAYER_SPRINT, 0, 1), phase: this.phase };
  }

  applyRoll(dt, player, state, distance) {
    const j = this.joints;
    if (!j.hip) return false;
    if (state !== 'dodge') {
      this.roll.active = false;
      return false;
    }
    if (!this.roll.active) {
      this.roll.active = true;
      this.roll.distance = 0;
      this.roll.angle = 0;
      this.roll.angularVelocity = 0;
      const direction = player.dodgeDir || this.velocity;
      localDirection(this.root, direction, this.direction);
      this.rollAxis.set(this.direction.z, 0, -this.direction.x).normalize();
      for (const foot of Object.values(this.feet)) foot.planted = foot.wasStance = false;
    }

    let travel = distance;
    if (!(travel > 1e-5) && player?.vel) travel = Math.min(DODGE_SPEED * dt * 1.25, horizontalLength(player.vel) * dt);
    this.roll.distance += Math.max(0, travel);
    const nextAngle = rollAngleFromDistance(this.roll.distance, this.roll.radius);
    const omega = dt > 0 ? (nextAngle - this.roll.angle) / dt : 0;
    this.roll.angularVelocity = damp(this.roll.angularVelocity, omega, 18, dt);
    this.roll.angle = nextAngle;

    const expectedDistance = DODGE_SPEED * DODGE_DURATION;
    const progress = clamp(this.roll.distance / expectedDistance, 0, 1);
    const tuck = smoothstep(0, .16, progress) * (1 - smoothstep(.78, 1, progress));
    const compression = Math.sin(progress * Math.PI) * .085;

    this.rollQuaternion.setFromAxisAngle(this.rollAxis, this.roll.angle);
    j.hip.quaternion.multiply(this.rollQuaternion);
    j.hip.position.y = this.restHipY + compression;

    for (const side of ['L', 'R']) {
      const arm = j[`arm${side}`], elbow = j[`elbow${side}`], leg = j[`leg${side}`], knee = j[`knee${side}`], ankle = j[`ankle${side}`];
      if (arm) { setAxis(arm, 'x', -.65 - tuck * 1.05, 1); setAxis(arm, 'z', side === 'L' ? .26 : -.26, 1); }
      if (elbow) setAxis(elbow, 'x', -.45 - tuck * .72, 1);
      if (leg) { setAxis(leg, 'x', -.55 - tuck * .92, 1); setAxis(leg, 'z', side === 'L' ? -.12 : .12, 1); }
      if (knee) setAxis(knee, 'x', .65 + tuck * 1.22, 1);
      if (ankle) setAxis(ankle, 'x', .18 + tuck * .36, 1);
    }

    this.root.userData.visualSpeed = this.speed;
    this.root.userData.proceduralRoll = {
      version: PROCEDURAL_LOCOMOTION_VERSION,
      distance: this.roll.distance,
      angle: this.roll.angle,
      angularVelocity: this.roll.angularVelocity,
      radius: this.roll.radius,
      progress,
      axis: this.rollAxis.toArray(),
    };
    return true;
  }

  update(dt, player, movement, state) {
    dt = clamp(dt || 0, 0, .05);
    const distance = this.measure(dt, player);
    const rolling = this.applyRoll(dt, player, state, distance);
    if (rolling) return { applied: true, rolling: true, speed: this.speed, normalizedSpeed: clamp(this.speed / PLAYER_SPRINT, 0, 1) };
    return this.applyGait(dt, player, movement || {}, state, distance);
  }
}

export function proceduralLocomotionFor(root) {
  if (!controllers.has(root)) controllers.set(root, new ProceduralHeroLocomotion(root));
  return controllers.get(root);
}

export function updateProceduralHero(root, dt, player, movement, state) {
  return proceduralLocomotionFor(root).update(dt, player, movement, state);
}

export function releaseProceduralLocomotion(root) {
  controllers.delete(root);
}
