import * as THREE from 'three';
import { scene } from './scene.js';
import { getTerrainHeight } from './terrain.js';
import { BOSS_ARENA_POS } from './constants.js';

export const portalState = { spawned: false, mesh: null, time: 0 };

let torusMat = null;
let innerMat = null;

export function spawnPortal() {
  if (portalState.spawned) return;

  const y = getTerrainHeight(BOSS_ARENA_POS.x, BOSS_ARENA_POS.z);
  const group = new THREE.Group();

  const torusGeo = new THREE.TorusGeometry(3, 0.3, 16, 32);
  torusMat = new THREE.MeshStandardMaterial({
    color: 0x4caf50,
    emissive: 0x4caf50,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.8,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI / 2;
  group.add(torus);

  const innerGeo = new THREE.CircleGeometry(2.7, 32);
  innerMat = new THREE.MeshBasicMaterial({
    color: 0x81c784,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  group.add(inner);

  const glowGeo = new THREE.PointLight(0x4caf50, 3, 15);
  group.add(glowGeo);

  group.position.set(BOSS_ARENA_POS.x, y + 3.5, BOSS_ARENA_POS.z);
  scene.add(group);

  portalState.mesh = group;
  portalState.spawned = true;
  portalState.time = 0;
}

export function updatePortal(dt) {
  if (!portalState.spawned || !portalState.mesh) return;
  portalState.time += dt;
  portalState.mesh.rotation.y += dt * 0.5;
  if (torusMat) torusMat.emissiveIntensity = 1.5 + Math.sin(portalState.time * 3) * 0.5;
  if (innerMat) innerMat.opacity = 0.2 + Math.sin(portalState.time * 2) * 0.1;
}

export function removePortal() {
  if (portalState.mesh) {
    scene.remove(portalState.mesh);
    portalState.mesh = null;
  }
  portalState.spawned = false;
  portalState.time = 0;
}
