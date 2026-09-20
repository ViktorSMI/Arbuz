import * as THREE from 'three';

export const CLOTH_PHYSICS_VERSION = 'cape-verlet-2';

const STEP = 1 / 60;
const MAX_STEPS = 4;
const ITERATIONS = 5;
const states = new WeakMap();
const clamp = THREE.MathUtils.clamp;

function axisValues(attribute, getter, descending = false) {
  const values = new Map();
  for (let i = 0; i < attribute.count; i++) {
    const value = getter(attribute, i);
    values.set(Math.round(value * 100000), value);
  }
  return [...values.values()].sort((a, b) => descending ? b - a : a - b);
}

function nearest(values, value) {
  let result = 0;
  let distance = Infinity;
  for (let i = 0; i < values.length; i++) {
    const next = Math.abs(values[i] - value);
    if (next < distance) {
      distance = next;
      result = i;
    }
  }
  return result;
}

function pointDistance(array, a, b) {
  a *= 3;
  b *= 3;
  return Math.hypot(array[b] - array[a], array[b + 1] - array[a + 1], array[b + 2] - array[a + 2]);
}

function addConstraint(state, a, b, stiffness) {
  if (a === undefined || b === undefined) return;
  state.constraints.push({ a, b, length: pointDistance(state.rest, a, b), stiffness });
}

function topologyFromUv(position, uv) {
  if (!uv || position.count !== uv.count) return null;
  const us = axisValues(uv, (attribute, i) => attribute.getX(i));
  const vs = axisValues(uv, (attribute, i) => attribute.getY(i), true);
  const columns = us.length;
  const rows = vs.length;
  if (columns * rows !== position.count || columns < 2 || rows < 2) return null;
  const grid = new Array(position.count);
  for (let i = 0; i < uv.count; i++) {
    grid[nearest(vs, uv.getY(i)) * columns + nearest(us, uv.getX(i))] = i;
  }
  if (grid.some(index => index === undefined)) return null;
  return { columns, rows, grid, source: 'uv-grid' };
}

function topologyFromRows(position) {
  const ys = axisValues(position, (attribute, i) => attribute.getY(i), true);
  if (ys.length < 2) return null;
  const rowLists = Array.from({ length: ys.length }, () => []);
  for (let i = 0; i < position.count; i++) rowLists[nearest(ys, position.getY(i))].push(i);
  const columns = rowLists[0]?.length || 0;
  if (columns < 2 || rowLists.some(row => row.length !== columns)) return null;
  for (const row of rowLists) row.sort((a, b) => position.getX(a) - position.getX(b));
  return { columns, rows: rowLists.length, grid: rowLists.flat(), source: 'position-rows' };
}

function createState(mesh) {
  const position = mesh.geometry.attributes.position;
  if (!position) return null;
  const topology = topologyFromUv(position, mesh.geometry.attributes.uv) || topologyFromRows(position);
  if (!topology || topology.columns * topology.rows !== position.count) return null;
  const { columns, rows, grid } = topology;
  const rest = new Float32Array(position.array);
  const state = {
    mesh,
    columns,
    rows,
    grid,
    topology: topology.source,
    rest,
    current: new Float32Array(rest),
    previous: new Float32Array(rest),
    pinned: new Uint8Array(position.count),
    constraints: [],
    accumulator: 0,
    initialized: false,
    collarSeparated: false,
    lastRootPosition: new THREE.Vector3(),
    rootPosition: new THREE.Vector3(),
    rootVelocity: new THREE.Vector3(),
    lastRootVelocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    localAcceleration: new THREE.Vector3(),
    wind: new THREE.Vector3(),
    parentQuaternion: new THREE.Quaternion(),
    inverseQuaternion: new THREE.Quaternion(),
    bodyBox: new THREE.Box3(),
    bodyCenter: new THREE.Vector3(),
    bodyLocalCenter: new THREE.Vector3(),
    bodyRadii: new THREE.Vector3(.76, .86, .72),
    bodySize: new THREE.Vector3(),
    bodyScale: new THREE.Vector3(),
    clothScale: new THREE.Vector3(1, 1, 1),
    maxStretch: 1,
    collisionCorrections: 0,
  };

  for (let column = 0; column < columns; column++) state.pinned[grid[column]] = 1;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = grid[row * columns + column];
      if (column + 1 < columns) addConstraint(state, index, grid[row * columns + column + 1], .92);
      if (row + 1 < rows) addConstraint(state, index, grid[(row + 1) * columns + column], .96);
      if (row + 1 < rows && column + 1 < columns) {
        addConstraint(state, index, grid[(row + 1) * columns + column + 1], .62);
        addConstraint(state, grid[row * columns + column + 1], grid[(row + 1) * columns + column], .62);
      }
      if (column + 2 < columns) addConstraint(state, index, grid[row * columns + column + 2], .24);
      if (row + 2 < rows) addConstraint(state, index, grid[(row + 2) * columns + column], .32);
    }
  }
  mesh.userData.clothPhysics = state;
  states.set(mesh, state);
  return state;
}

function updateCollider(state, root) {
  const body = root?.userData?.body;
  if (!body?.geometry || !state.mesh.parent) return;
  body.geometry.computeBoundingBox();
  state.bodyBox.copy(body.geometry.boundingBox);
  state.bodyBox.getCenter(state.bodyLocalCenter);
  state.bodyBox.getSize(state.bodySize).multiplyScalar(.5);
  root.updateMatrixWorld(true);
  body.localToWorld(state.bodyLocalCenter);
  state.mesh.worldToLocal(state.bodyCenter.copy(state.bodyLocalCenter));
  body.getWorldScale(state.bodyScale);
  state.mesh.getWorldScale(state.clothScale);
  state.bodyRadii.set(
    state.bodySize.x * state.bodyScale.x / Math.max(.0001, state.clothScale.x) + .065,
    state.bodySize.y * state.bodyScale.y / Math.max(.0001, state.clothScale.y) + .055,
    state.bodySize.z * state.bodyScale.z / Math.max(.0001, state.clothScale.z) + .075,
  );
}

function rearSurface(state, x, y) {
  const dx = (x - state.bodyCenter.x) / state.bodyRadii.x;
  const dy = (y - state.bodyCenter.y) / state.bodyRadii.y;
  const cross = 1 - dx * dx - dy * dy;
  return cross > 0 ? state.bodyCenter.z - state.bodyRadii.z * Math.sqrt(cross) : Infinity;
}

function separateCollar(state) {
  for (let i = 0; i < state.pinned.length; i++) {
    if (!state.pinned[i]) continue;
    const offset = i * 3;
    const surface = rearSurface(state, state.rest[offset], state.rest[offset + 1]);
    if (Number.isFinite(surface)) state.rest[offset + 2] = Math.min(state.rest[offset + 2], surface - .018);
    for (let axis = 0; axis < 3; axis++) {
      state.current[offset + axis] = state.previous[offset + axis] = state.rest[offset + axis];
    }
  }
}

function reset(state) {
  state.current.set(state.rest);
  state.previous.set(state.rest);
  state.accumulator = 0;
  state.rootVelocity.set(0, 0, 0);
  state.lastRootVelocity.set(0, 0, 0);
}

function rootDynamics(state, root, dt) {
  root.getWorldPosition(state.rootPosition);
  if (!state.initialized) {
    state.lastRootPosition.copy(state.rootPosition);
    state.initialized = true;
  }
  if (!(dt > 0) || state.rootPosition.distanceTo(state.lastRootPosition) > 2.5) {
    state.lastRootPosition.copy(state.rootPosition);
    reset(state);
    return;
  }
  state.rootVelocity.copy(state.rootPosition).sub(state.lastRootPosition).multiplyScalar(1 / dt);
  state.acceleration.copy(state.rootVelocity).sub(state.lastRootVelocity).multiplyScalar(1 / dt);
  if (state.acceleration.lengthSq() > 1225) state.acceleration.setLength(35);
  state.lastRootPosition.copy(state.rootPosition);
  state.lastRootVelocity.lerp(state.rootVelocity, 1 - Math.exp(-dt * 12));
}

function integrate(state, dt, time, motion, turn, rolling) {
  state.mesh.parent.getWorldQuaternion(state.parentQuaternion);
  state.inverseQuaternion.copy(state.parentQuaternion).invert();
  state.localAcceleration.set(0, -9.81, 0).applyQuaternion(state.inverseQuaternion);
  state.acceleration.multiplyScalar(-.055).applyQuaternion(state.inverseQuaternion);
  state.localAcceleration.add(state.acceleration);
  state.wind.set(
    Math.sin(time * 1.7) * .42 + turn * 1.15,
    .14 + Math.sin(time * 2.3) * .08,
    -1.15 - motion * 3.35 - (rolling ? 2.2 : 0),
  );
  state.localAcceleration.add(state.wind);
  const damping = rolling ? .965 : .978;
  for (let i = 0; i < state.pinned.length; i++) {
    const offset = i * 3;
    if (state.pinned[i]) {
      for (let axis = 0; axis < 3; axis++) {
        state.current[offset + axis] = state.previous[offset + axis] = state.rest[offset + axis];
      }
      continue;
    }
    for (let axis = 0; axis < 3; axis++) {
      const position = state.current[offset + axis];
      const velocity = clamp((position - state.previous[offset + axis]) * damping, -.14, .14);
      state.previous[offset + axis] = position;
      state.current[offset + axis] = position + velocity + state.localAcceleration.getComponent(axis) * dt * dt;
    }
  }
}

function solveConstraint(state, constraint) {
  const a = constraint.a * 3;
  const b = constraint.b * 3;
  const dx = state.current[b] - state.current[a];
  const dy = state.current[b + 1] - state.current[a + 1];
  const dz = state.current[b + 2] - state.current[a + 2];
  const length = Math.hypot(dx, dy, dz);
  if (!(length > 1e-7)) return;
  state.maxStretch = Math.max(state.maxStretch, length / Math.max(1e-7, constraint.length));
  const factor = (length - constraint.length) / length * constraint.stiffness;
  const freeA = state.pinned[constraint.a] ? 0 : 1;
  const freeB = state.pinned[constraint.b] ? 0 : 1;
  const total = freeA + freeB;
  if (!total) return;
  if (freeA) {
    state.current[a] += dx * factor * freeA / total;
    state.current[a + 1] += dy * factor * freeA / total;
    state.current[a + 2] += dz * factor * freeA / total;
  }
  if (freeB) {
    state.current[b] -= dx * factor * freeB / total;
    state.current[b + 1] -= dy * factor * freeB / total;
    state.current[b + 2] -= dz * factor * freeB / total;
  }
}

function collide(state) {
  for (let i = 0; i < state.pinned.length; i++) {
    if (state.pinned[i]) continue;
    const offset = i * 3;
    const surface = rearSurface(state, state.current[offset], state.current[offset + 1]);
    if (Number.isFinite(surface) && state.current[offset + 2] > surface - .012) {
      state.current[offset + 2] = surface - .012;
      state.previous[offset + 2] = Math.max(state.previous[offset + 2], state.current[offset + 2]);
      state.collisionCorrections++;
    }
  }
}

function solve(state) {
  state.maxStretch = 1;
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    for (const constraint of state.constraints) solveConstraint(state, constraint);
    collide(state);
    for (let i = 0; i < state.pinned.length; i++) {
      if (!state.pinned[i]) continue;
      const offset = i * 3;
      for (let axis = 0; axis < 3; axis++) state.current[offset + axis] = state.rest[offset + axis];
    }
  }
}

function write(state) {
  const position = state.mesh.geometry.attributes.position;
  position.array.set(state.current);
  position.needsUpdate = true;
  state.mesh.geometry.computeVertexNormals();
  state.mesh.geometry.computeBoundingSphere();
}

export function simulateCape(mesh, root, dt, time = 0, options = {}) {
  const state = states.get(mesh) || createState(mesh);
  if (!state || !(dt > 0)) return null;
  state.collisionCorrections = 0;
  rootDynamics(state, root, Math.min(dt, .05));
  updateCollider(state, root);
  if (!state.collarSeparated) {
    separateCollar(state);
    state.collarSeparated = true;
  }
  state.accumulator = Math.min(state.accumulator + Math.min(dt, .05), STEP * MAX_STEPS);
  let steps = 0;
  while (state.accumulator >= STEP && steps < MAX_STEPS) {
    integrate(state, STEP, time + steps * STEP, options.motion || 0, options.turn || 0, options.rolling === true);
    solve(state);
    state.accumulator -= STEP;
    steps++;
  }
  write(state);
  root.userData.capePhysics = {
    version: CLOTH_PHYSICS_VERSION,
    particles: state.pinned.length,
    constraints: state.constraints.length,
    pinned: state.pinned.reduce((sum, value) => sum + value, 0),
    maxStretch: state.maxStretch,
    collisionCorrections: state.collisionCorrections,
    topology: state.topology,
    anchorZ: mesh.parent?.position.z ?? 0,
  };
  return state;
}

export function capePenetration(mesh) {
  const state = states.get(mesh) || mesh.userData.clothPhysics;
  if (!state) return 0;
  let result = 0;
  for (let i = 0; i < state.pinned.length; i++) {
    const offset = i * 3;
    const surface = rearSurface(state, state.current[offset], state.current[offset + 1]);
    if (Number.isFinite(surface)) result = Math.max(result, state.current[offset + 2] - surface);
  }
  return Math.max(0, result);
}

export function resetCape(mesh) {
  const state = states.get(mesh);
  if (!state) return;
  reset(state);
  write(state);
}

export function releaseCape(mesh) {
  states.delete(mesh);
  delete mesh.userData.clothPhysics;
}
