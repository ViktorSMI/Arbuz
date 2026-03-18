import * as THREE from 'three';
import { WORLD_SIZE, TERRAIN_SEG } from './constants.js';
import { scene } from './scene.js';

export function computeHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8;
  h += Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04 + 0.7) * 4;
  h += Math.sin(x * 0.1 + 2.1) * Math.sin(z * 0.08 + 1.5) * 2;
  h += Math.cos(x * 0.03 + z * 0.03) * 6;
  const dc = Math.sqrt(x * x + z * z);
  if (dc < 30) h *= dc / 30;
  return h;
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
  const gx = col;
  const gz = row;
  posAttr.setY(idx, heightData[gx * (TERRAIN_SEG + 1) + gz]);
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x4a7c3f,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: false
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
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
