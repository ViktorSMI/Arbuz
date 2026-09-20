import * as THREE from 'three';
import { randomSeed } from './palette.js';

const surfaces = new Map();
const materials = new Map();
const DEFAULT_SIZE = 256;
const rgb = hex => new THREE.Color(hex).convertLinearToSRGB().toArray().map(v => v * 255);
const mix = (a, b, t) => a + (b - a) * t;

// Periodic value noise avoids directional striping on soil and stone.
function noise(u, v, size) {
  const x=u*size,y=v*size,ix=Math.floor(x),iy=Math.floor(y);
  let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const sample=(a,b)=>{let h=Math.imul((a%size)+17,374761393)^Math.imul((b%size)+31,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  return mix(mix(sample(ix,iy),sample(ix+1,iy),fx),mix(sample(ix,iy+1),sample(ix+1,iy+1),fx),fy);
}
function grain(u,v){return noise(u,v,5)*.52+noise(u,v,19)*.30+noise(u,v,73)*.18;}

export function surface(kind = 'stone') {
  if (surfaces.has(kind)) return surfaces.get(kind);
  const SIZE = kind === 'rind' ? 512 : DEFAULT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(SIZE, SIZE);
  const heights = new Float32Array(SIZE * SIZE);
  const rand = randomSeed(9137);
  const colors = {
    rind: ['#163f28', '#8faa50'], chitin: ['#111f22', '#64836d'],
    bark: ['#242a26', '#827363'], stone: ['#3d4849', '#b3b0a1'],
    cloth: ['#392326', '#945448'], iron: ['#283333', '#8c9284'],
    fur: ['#393436', '#a19381'], feather: ['#1e3035', '#7d8f8d'],
    soil: ['#535447', '#c5b495'], leaf: ['#254d31', '#bfd77e'],
    canopy: ['#354f36', '#95a774'],
    bone: ['#66604b', '#d9cba0'], gold: ['#483a29', '#c0a36d'],
    pumpkin: ['#693321', '#ec9c4e'], cactus: ['#1b3f3c', '#81b08b'],
    aubergine: ['#251f34', '#826785'], mushroom: ['#883b38', '#de896b'],
    carrot: ['#8b3824', '#eba550'], moss: ['#1d3a2d', '#789357'],
  };
  const [dark, light] = (colors[kind] || colors.stone).map(rgb);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const n = grain(u, v), p = y * SIZE + x;
    let value = n, h = n * .45;
    if (kind === 'rind') {
      const stripe = Math.sin(u * Math.PI * 20 + Math.sin(v * Math.PI * 6) * .36 + Math.sin(v * Math.PI * 26) * .12);
      value = stripe > -.1 + n * .24 ? .63 + n * .3 : .08 + n * .26;
      // Fine pebbled wax, pale lenticels and imperfect stripe edges.
      const pores = noise(u, v, 113);
      value += (pores > .75 ? .09 : 0) - .035 * Math.sin(u * 6.283 * 57 + n * 6);
      h = pores * .19 + n * .1;
    } else if (['pumpkin', 'cactus', 'aubergine', 'carrot'].includes(kind)) {
      const ribs = Math.pow(.5 + .5 * Math.cos(u * Math.PI * (kind === 'pumpkin' ? 20 : 16)), .4);
      value = .24 + n * .32 + ribs * .38;
      h = ribs * .11 + n * .17;
    } else if (kind === 'mushroom') {
      const spots = noise(u, v, 23);
      value = spots > .71 ? .92 : .15 + n * .58;
      h = spots * .1;
    } else if (kind === 'chitin') {
      const plates = .5 + .5 * Math.cos(v * Math.PI * 16 + Math.sin(u * 6.283) * 2);
      value = n * .42 + plates * .18 + .14;
      h = plates * .1 + noise(u, v, 79) * .09;
    } else if (kind === 'soil' || kind === 'stone') {
      const pebbles = noise(u, v, 43), cracks = noise(u, v, 13);
      const seam = Math.max(0, 1 - Math.abs(cracks - .46) * 70);
      value = .24 + n * .52 + (pebbles > .68 ? .18 : 0) - seam * .24;
      h = pebbles * .22 + n * .12 - seam * .18;
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
    heights[p] = h + speck * (kind === 'soil' ? .3 : 1);
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
    const strength = kind === 'rind' ? 2.0 : 2.4;
    const z = 1 / Math.sqrt(dx * dx * strength * strength + dy * dy * strength * strength + 1);
    normalData.set([128 - dx * strength * z * 127, 128 - dy * strength * z * 127, z * 127 + 128, 255], p * 4);
    const metal = ['iron', 'gold', 'chitin', 'rind', 'aubergine'].includes(kind);
    const rough = (metal ? 120 : 185) + heights[p] * 45;
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
