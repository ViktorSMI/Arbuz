import * as THREE from 'three';
import { randomSeed } from './palette.js';

const surfaces = new Map();
const materials = new Map();
const SIZE = 256;
const rgb = hex => new THREE.Color(hex).convertLinearToSRGB().toArray().map(v => v * 255);
const mix = (a, b, t) => a + (b - a) * t;

// Tileable Fourier noise: deterministic, seamless, independent of browser RNG.
function grain(u, v) {
  return .5 + .12 * Math.sin(u * 6.283 * 3 + Math.cos(v * 6.283 * 2))
    + .10 * Math.sin(v * 6.283 * 7 + Math.sin(u * 6.283 * 5))
    + .06 * Math.sin((u * 31 + v * 17) * 6.283)
    + .035 * Math.sin((u * 83 - v * 67) * 6.283);
}

export function surface(kind = 'stone') {
  if (surfaces.has(kind)) return surfaces.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(SIZE, SIZE);
  const heights = new Float32Array(SIZE * SIZE);
  const rand = randomSeed(9137);
  const colors = {
    rind: ['#173b2c', '#92a94d'], chitin: ['#172c2b', '#677849'],
    bark: ['#302a23', '#817258'], stone: ['#4b504b', '#aaa58c'],
    cloth: ['#392326', '#945448'], iron: ['#283333', '#8c9284'],
    fur: ['#393436', '#a19381'], feather: ['#1e3035', '#7d8f8d'],
    soil: ['#30382c', '#868260'], leaf: ['#243e30', '#93a36a'],
    bone: ['#66604b', '#d9cba0'], gold: ['#645335', '#d2ba7c'],
  };
  const [dark, light] = (colors[kind] || colors.stone).map(rgb);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const n = grain(u, v), p = y * SIZE + x;
    let value = n, h = n * .45;
    if (kind === 'rind') {
      const stripe = Math.sin(u * Math.PI * 20 + Math.sin(v * Math.PI * 6) * .36 + Math.sin(v * Math.PI * 26) * .12);
      value = stripe > -.1 + n * .24 ? .63 + n * .3 : .08 + n * .26;
      h = n * .6 + .02 * Math.sin(u * 6.283 * 70);
    } else if (kind === 'bark' || kind === 'fur' || kind === 'feather') {
      const line = Math.sin(u * 6.283 * 35 + Math.sin(v * 6.283 * 4) * 1.8);
      value = n * .65 + (line * .5 + .5) * .25;
      h = line * .25 + n * .35;
    } else if (kind === 'cloth') {
      const weave = (x % 4 < 2 ? .12 : -.10) + (y % 4 < 2 ? .10 : -.08);
      value = n + weave; h = .4 + weave;
    } else if (kind === 'leaf') {
      const vein = Math.abs(Math.sin((v + Math.abs(u - .5) * .6) * Math.PI * 14));
      value = n * .7 + .25 * vein; h = vein * .22 + .3 * n;
    } else if (kind === 'iron' || kind === 'gold') {
      const scratch = Math.sin((u * 105 + v * 9) * 6.283);
      value = n * .7 + .15 * scratch; h = n * .15 + scratch * .05;
    }
    const speck = (rand() - .5) * .08;
    value = Math.max(0, Math.min(1, value + speck));
    heights[p] = h + speck;
    for (let c = 0; c < 3; c++) image.data[p * 4 + c] = mix(dark[c], light[c], value);
    image.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const normalData = new Uint8Array(SIZE * SIZE * 4);
  const roughData = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const p = y * SIZE + x;
    const dx = heights[y * SIZE + (x + 1) % SIZE] - heights[y * SIZE + (x + SIZE - 1) % SIZE];
    const dy = heights[((y + 1) % SIZE) * SIZE + x] - heights[((y + SIZE - 1) % SIZE) * SIZE + x];
    const z = 1 / Math.sqrt(dx * dx * 3 + dy * dy * 3 + 1);
    normalData.set([128 - dx * z * 180, 128 - dy * z * 180, z * 127 + 128, 255], p * 4);
    const metal = kind === 'iron' || kind === 'gold' || kind === 'chitin';
    const rough = (metal ? 100 : 185) + heights[p] * 45;
    roughData.set([rough, rough, rough, 255], p * 4);
  }
  const normalMap = new THREE.DataTexture(normalData, SIZE, SIZE, THREE.RGBAFormat);
  const roughnessMap = new THREE.DataTexture(roughData, SIZE, SIZE, THREE.RGBAFormat);
  for (const tex of [normalMap, roughnessMap]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.needsUpdate = true;
  }
  const result = { map, normalMap, roughnessMap };
  surfaces.set(kind, result);
  return result;
}

export function material(kind, color = '#ffffff', options = {}) {
  const key = `${kind}:${color}:${JSON.stringify(options)}`;
  if (materials.has(key)) return materials.get(key);
  const mat = new THREE.MeshStandardMaterial({
    ...surface(kind), color,
    roughness: 1,
    metalness: ['iron', 'gold'].includes(kind) ? .68 : kind === 'chitin' ? .27 : 0,
    normalScale: new THREE.Vector2(.5, .5), ...options,
  });
  mat.name = `orchard/${kind}`;
  mat.userData.sharedArtMaterial = true;
  materials.set(key, mat);
  return mat;
}

export function glow(color = '#e1bd69', intensity = .8) {
  return material('gold', color, { emissive: color, emissiveIntensity: intensity, metalness: .35 });
}

export function materialStats() { return { surfaces: surfaces.size, materials: materials.size }; }
