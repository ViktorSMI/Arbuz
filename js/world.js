import * as THREE from 'three';
import { WORLD_SIZE, TREE_COUNT, ROCK_COUNT, CRATE_COUNT, WATER_LEVEL } from './constants.js';
import { scene, sunLight } from './scene.js';
import { getTerrainHeight } from './terrain.js';

export const obstacles = [];

const grassGeo = new THREE.PlaneGeometry(0.3, 0.8);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x5d8a3c, side: THREE.DoubleSide, alphaTest: 0.5 });
const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, 3000);
const dummy = new THREE.Object3D();
for (let i = 0; i < 3000; i++) {
  const gx = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
  const gz = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
  const gy = getTerrainHeight(gx, gz);
  if (gy < WATER_LEVEL + 0.5) { continue; }
  dummy.position.set(gx, gy + 0.35, gz);
  dummy.rotation.set(0, Math.random() * Math.PI, 0);
  dummy.scale.set(0.8 + Math.random() * 0.6, 0.6 + Math.random() * 0.8, 1);
  dummy.updateMatrix();
  grassMesh.setMatrixAt(i, dummy.matrix);
}
grassMesh.instanceMatrix.needsUpdate = true;
scene.add(grassMesh);

const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
const leafGeo = new THREE.SphereGeometry(2.5, 8, 6);
const trunkMats = [
  new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 }),
];
const leafMats = [
  new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }),
  new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }),
  new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8 }),
];

for (let i = 0; i < TREE_COUNT; i++) {
  const tx = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const tz = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const dc = Math.sqrt(tx * tx + tz * tz);
  if (dc < 15) continue;
  const ty = getTerrainHeight(tx, tz);
  if (ty < WATER_LEVEL + 0.5) continue;
  const scale = 0.7 + Math.random() * 0.8;
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMats[i % 2]);
  trunk.position.y = 2 * scale;
  trunk.scale.set(scale, scale, scale);
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Mesh(leafGeo, leafMats[i % 3]);
  crown.position.y = 5 * scale;
  crown.scale.set(scale, scale * 0.9, scale);
  crown.castShadow = true;
  group.add(crown);
  group.position.set(tx, ty, tz);
  scene.add(group);
  obstacles.push({ x: tx, z: tz, r: 1.5 * scale });
}

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.95, flatShading: true });
for (let i = 0; i < ROCK_COUNT; i++) {
  const rx = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const rz = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const dc = Math.sqrt(rx * rx + rz * rz); if (dc < 12) continue;
  const ry = getTerrainHeight(rx, rz);
  if (ry < WATER_LEVEL + 0.3) continue;
  const s = 0.5 + Math.random() * 1.5;
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.set(rx, ry + s * 0.4, rz);
  rock.scale.set(s, s * 0.6, s);
  rock.rotation.set(Math.random(), Math.random(), 0);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  obstacles.push({ x: rx, z: rz, r: s * 0.8 });
}

const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const crateMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
const crateEdge = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
for (let i = 0; i < CRATE_COUNT; i++) {
  const cx = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
  const cz = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
  const dc = Math.sqrt(cx * cx + cz * cz); if (dc < 10) continue;
  const cy = getTerrainHeight(cx, cz);
  if (cy < WATER_LEVEL + 0.3) continue;
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.set(cx, cy + 0.75, cz);
  crate.rotation.y = Math.random() * Math.PI;
  crate.castShadow = true;
  crate.receiveShadow = true;
  scene.add(crate);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 1.55), crateEdge);
  band.position.copy(crate.position);
  band.position.y += 0.3;
  band.rotation.y = crate.rotation.y;
  scene.add(band);
  obstacles.push({ x: cx, z: cz, r: 1.2 });
}

const skyGeo = new THREE.SphereGeometry(250, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {},
  vertexShader: 'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vPos;void main(){float h=normalize(vPos).y;vec3 top=vec3(.45,.72,.95);vec3 bot=vec3(.85,.92,.98);vec3 hor=vec3(.95,.88,.7);vec3 c=mix(hor,top,smoothstep(0.,.5,h));c=mix(c,bot,smoothstep(0.,-.2,h));gl_FragColor=vec4(c,1.);}'
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const sunGeo = new THREE.SphereGeometry(5, 16, 16);
const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
const sunMesh = new THREE.Mesh(sunGeo, sunDiscMat);
sunMesh.position.copy(sunLight.position).normalize().multiplyScalar(240);
scene.add(sunMesh);

const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.3 });
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -3;
scene.add(water);
