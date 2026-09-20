import * as THREE from 'three';
import { WORLD_SIZE, TERRAIN_SEG, BOSS_ARENA_POS, BOSS_ARENA_R } from './constants.js';
import { surface } from './art/materials.js';
import { scene } from './scene.js';
import { terrainShader } from './art/landscape.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hash2(x, z) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = mix(hash2(ix, iz), hash2(ix + 1, iz), sx);
  const b = mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), sx);
  return mix(a, b, sz);
}
function fbm(x, z, octaves = 5) {
  let value = 0, amplitude = .5, frequency = 1, normalizer = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * frequency, z * frequency) * amplitude;
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= .5;
  }
  return value / normalizer;
}
function rawHeight(x, z) {
  const warpX = (fbm(x * .006 + 17.2, z * .006 - 8.1, 4) - .5) * 34;
  const warpZ = (fbm(x * .006 - 22.4, z * .006 + 13.7, 4) - .5) * 34;
  const wx = x + warpX, wz = z + warpZ;
  const broad = (fbm(wx * .008, wz * .008, 6) - .5) * 34;
  const rolling = (fbm(wx * .023 + 41, wz * .023 - 19, 5) - .5) * 11;
  const ridgeNoise = Math.abs(fbm(wx * .015 - 77, wz * .015 + 31, 5) * 2 - 1);
  const ridges = Math.pow(1 - ridgeNoise, 2.6) * 8.5;
  const erosion = (fbm(wx * .07, wz * .07, 3) - .5) * 2.4;
  return broad + rolling + ridges + erosion - 4.2;
}

export function pathCenter(z) {
  return z * .88 + Math.sin(z * .022) * 10;
}
export function pathDistance(x, z) {
  return Math.abs(x - pathCenter(z)) / 1.33;
}

export function computeHeight(x, z) {
  let h = rawHeight(x, z);
  // A compacted pilgrimage road follows the old orchard route without becoming a flat ribbon.
  const road = pathDistance(x, z);
  const roadWeight = 1 - smoothstep(1.5, 5.8, road);
  const roadBed = (fbm(z * .018 + 8, z * .006 - 2, 3) - .5) * 1.25;
  h = mix(h, roadBed, roadWeight * .86);

  // The opening clearing is intentionally readable, but its edge still blends into the hills.
  const spawnDistance = Math.hypot(x, z);
  h = mix(h, 0, 1 - smoothstep(8, 28, spawnDistance));

  // Preserve a traversable boss arena while keeping a raised natural rim around it.
  const arenaDistance = Math.hypot(x - BOSS_ARENA_POS.x, z - BOSS_ARENA_POS.z);
  const arenaBase = 2.4 + (fbm(x * .025 + 4, z * .025 - 3, 3) - .5) * .8;
  h = mix(h, arenaBase, 1 - smoothstep(BOSS_ARENA_R - 4, BOSS_ARENA_R + 5, arenaDistance));
  const rim = Math.exp(-((arenaDistance - (BOSS_ARENA_R + 7)) ** 2) / 42) * 3.2;
  return h + rim;
}

export const heightData = new Float32Array((TERRAIN_SEG + 1) * (TERRAIN_SEG + 1));
for (let gx = 0; gx <= TERRAIN_SEG; gx++) {
  for (let gz = 0; gz <= TERRAIN_SEG; gz++) {
    const wx = (gx / TERRAIN_SEG - 0.5) * WORLD_SIZE;
    const wz = (gz / TERRAIN_SEG - 0.5) * WORLD_SIZE;
    heightData[gx * (TERRAIN_SEG + 1) + gz] = computeHeight(wx, wz);
  }
}

const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEG, TERRAIN_SEG);
terrainGeo.rotateX(-Math.PI / 2);
const posAttr = terrainGeo.attributes.position;
for (let idx = 0; idx < posAttr.count; idx++) {
  const row = Math.floor(idx / (TERRAIN_SEG + 1));
  const col = idx % (TERRAIN_SEG + 1);
  posAttr.setY(idx, heightData[col * (TERRAIN_SEG + 1) + row]);
}
terrainGeo.computeVertexNormals();
terrainGeo.computeBoundingSphere();

const normals = terrainGeo.attributes.normal;
const colors = new Float32Array(posAttr.count * 3);
const c = new THREE.Color(), soil = new THREE.Color('#a58f70'), moss = new THREE.Color('#6f8553');
const cliff = new THREE.Color('#8b9087'), wet = new THREE.Color('#536f60'), dust = new THREE.Color('#c0aa84');
for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i), z = posAttr.getZ(i), y = posAttr.getY(i);
  const slope = 1 - Math.max(0, normals.getY(i));
  const patch = fbm(x * .09 + 11, z * .09 - 9, 4);
  const verge = smoothstep(1.7, 5.2 + patch * 1.5, pathDistance(x, z));
  c.copy(soil).lerp(moss, verge * (.42 + patch * .5));
  c.lerp(dust, (1 - verge) * (.22 + patch * .16));
  c.lerp(cliff, smoothstep(.12, .48, slope));
  c.lerp(wet, (1 - smoothstep(-3, .5, y)) * (.35 + patch * .25));
  c.multiplyScalar(.82 + patch * .28);
  c.toArray(colors, i * 3);
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const maps = surface('soil');
export const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
  normalScale: new THREE.Vector2(.42, .42),
  map: maps.map.clone(),
  normalMap: maps.normalMap.clone(),
  roughnessMap: maps.roughnessMap.clone(),
});
terrainShader(terrainMat);
for (const tex of [terrainMat.map, terrainMat.normalMap, terrainMat.roughnessMap]) {
  tex.repeat.set(85, 85);
  tex.needsUpdate = true;
}
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.name = 'orchard-terrain';
terrain.receiveShadow = true;
scene.add(terrain);

export function getTerrainHeight(x, z) {
  const halfW = WORLD_SIZE / 2;
  const gxf = (x + halfW) / WORLD_SIZE * TERRAIN_SEG;
  const gzf = (z + halfW) / WORLD_SIZE * TERRAIN_SEG;
  const ix = Math.floor(gxf), iz = Math.floor(gzf);
  const fx = gxf - ix, fz = gzf - iz;
  if (ix < 0 || ix >= TERRAIN_SEG || iz < 0 || iz >= TERRAIN_SEG) return 0;
  const s = TERRAIN_SEG + 1;
  const h00 = heightData[ix * s + iz];
  const h10 = heightData[Math.min(ix + 1, TERRAIN_SEG) * s + iz];
  const h01 = heightData[ix * s + Math.min(iz + 1, TERRAIN_SEG)];
  const h11 = heightData[Math.min(ix + 1, TERRAIN_SEG) * s + Math.min(iz + 1, TERRAIN_SEG)];
  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  return h0 * (1 - fz) + h1 * fz;
}
