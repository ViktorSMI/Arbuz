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

// ── Процедурный шум для текстурной раскраски ──
// Многооктавный шум на sin/cos — создаёт органичные пятна
function fbm(x, z) {
  let v = 0, amp = 1, freq = 1;
  for (let i = 0; i < 5; i++) {
    v += amp * (Math.sin(x * freq * 0.37 + z * freq * 0.53 + i * 1.7) *
                Math.cos(z * freq * 0.41 - x * freq * 0.29 + i * 2.3) * 0.5 + 0.5);
    amp *= 0.5;
    freq *= 2.1;
  }
  return v;
}

// Шум для конкретных слоёв
function grassNoise(x, z)  { return fbm(x * 0.08, z * 0.08); }
function dirtNoise(x, z)   { return fbm(x * 0.12 + 100, z * 0.12 + 100); }
function patchNoise(x, z)  { return fbm(x * 0.04 + 50, z * 0.04 - 50); }
function microNoise(x, z)  { return fbm(x * 0.25 + 200, z * 0.25 + 200); }

// Палитра
const colors = new Float32Array(posAttr.count * 3);
const colGrassLush  = new THREE.Color(0x2d6a1e); // сочная тёмная зелень
const colGrassLight = new THREE.Color(0x5da030); // яркая светлая трава
const colGrassDry   = new THREE.Color(0x9a9830); // сухая жёлто-зелёная
const colDirtWet    = new THREE.Color(0x2a1808); // мокрая тёмная земля
const colDirtDry    = new THREE.Color(0x7d5c2a); // сухая рыжая земля
const colMud        = new THREE.Color(0x1e1008); // тёмная грязь
const colSand       = new THREE.Color(0xb8a060); // яркий песок
const colRock       = new THREE.Color(0x808078); // светлый камень
const colRockDark   = new THREE.Color(0x3a3a34); // тёмный камень
const colMoss       = new THREE.Color(0x2a5018); // тёмный мох

const normalAttr = terrainGeo.attributes.normal;
const tmpColor = new THREE.Color();

for (let idx = 0; idx < posAttr.count; idx++) {
  const row = Math.floor(idx / (TERRAIN_SEG + 1));
  const col = idx % (TERRAIN_SEG + 1);
  const wx = (col / TERRAIN_SEG - 0.5) * WORLD_SIZE;
  const wz = (row / TERRAIN_SEG - 0.5) * WORLD_SIZE;
  const h = posAttr.getY(idx);

  // Крутизна склона (0 = плоско, 1 = вертикально)
  const ny = normalAttr.getY(idx);
  const slope = 1 - Math.abs(ny); // 0=flat, ~1=cliff

  // Шумовые слои
  const gN  = grassNoise(wx, wz);   // 0-2ish — пятна травы
  const dN  = dirtNoise(wx, wz);    // пятна грязи
  const pN  = patchNoise(wx, wz);   // крупные зоны
  const mN  = microNoise(wx, wz);   // мелкая вариация

  // Базовый цвет по высоте
  let baseColor;
  if (h < -1.5) {
    // Низины у воды — песок/грязь
    const t = Math.min(1, dN * 0.6);
    baseColor = tmpColor.copy(colSand).lerp(colMud, t);
  } else if (h < 4) {
    // Основная зона — трава/земля
    // Крупные пятна определяют: трава или проплешина
    const isGrassy = pN > 0.7;
    const isDirty = pN < 0.4;

    if (isGrassy) {
      // Зона травы — вариация от сочной до сухой
      const grassT = gN * 0.5;
      baseColor = tmpColor.copy(colGrassLush).lerp(colGrassLight, grassT);
      // Мелкие пятна сухой травы
      if (mN > 1.2) baseColor.lerp(colGrassDry, 0.5);
    } else if (isDirty) {
      // Грязь/земля
      const dirtT = dN * 0.5;
      baseColor = tmpColor.copy(colDirtDry).lerp(colDirtWet, dirtT);
      // Мелкие пятна грязи
      if (mN < 0.5) baseColor.lerp(colMud, 0.4);
    } else {
      // Переход — смешанная трава+земля
      const mixT = (pN - 0.4) / 0.3;
      const grassC = new THREE.Color().lerpColors(colGrassDry, colGrassLush, gN * 0.5);
      const dirtC = new THREE.Color().lerpColors(colDirtDry, colDirtWet, dN * 0.5);
      baseColor = tmpColor.copy(dirtC).lerp(grassC, mixT);
    }
  } else if (h < 8) {
    // Холмы — смесь грунта и камня
    const t = (h - 4) / 4;
    const dirtC = new THREE.Color().lerpColors(colDirtDry, colDirtWet, dN * 0.4);
    baseColor = tmpColor.copy(dirtC).lerp(colRock, t * 0.7 + dN * 0.2);
    // Мох на камнях
    if (gN > 1.0 && slope < 0.3) baseColor.lerp(colMoss, 0.4);
  } else {
    // Вершины — камень
    const t = Math.min(1, dN * 0.5);
    baseColor = tmpColor.copy(colRock).lerp(colRockDark, t);
    // Мох в щелях
    if (slope < 0.2 && gN > 0.8) baseColor.lerp(colMoss, 0.3);
  }

  // Крутые склоны → камень/земля (везде)
  if (slope > 0.35) {
    const slopeT = Math.min(1, (slope - 0.35) / 0.3);
    const slopeColor = new THREE.Color().lerpColors(colRockDark, colRock, dN * 0.5);
    baseColor.lerp(slopeColor, slopeT * 0.8);
  }

  // Финальный микрошум для зернистости
  const grain = 0.94 + mN * 0.04;
  colors[idx * 3]     = Math.min(1, baseColor.r * grain);
  colors[idx * 3 + 1] = Math.min(1, baseColor.g * grain);
  colors[idx * 3 + 2] = Math.min(1, baseColor.b * grain);
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// ── Процедурная микро-текстура на canvas ──
// Текстура нейтрально-серая (~128,128,128) чтобы при умножении на vertex colors
// не глушить их, а только добавлять контрастные детали
const TEX_SIZE = 2048;
const texCanvas = document.createElement('canvas');
texCanvas.width = TEX_SIZE;
texCanvas.height = TEX_SIZE;
const tctx = texCanvas.getContext('2d');

// Базовый фон — нейтральный серый (при multiply не меняет vertex color)
tctx.fillStyle = '#b0b0a8';
tctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

// Крупный шум — неровные пятна яркости
const imgData = tctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
const px = imgData.data;
for (let y = 0; y < TEX_SIZE; y++) {
  for (let x = 0; x < TEX_SIZE; x++) {
    const i = (y * TEX_SIZE + x) * 4;
    // Мульти-шум для крупных вариаций
    const n1 = Math.sin(x * 0.05) * Math.cos(y * 0.07) * 20;
    const n2 = Math.sin(x * 0.13 + 3) * Math.cos(y * 0.11 + 2) * 12;
    const n3 = Math.sin(x * 0.31 + 1) * Math.sin(y * 0.27 + 4) * 8;
    // Мелкий шум — зернистость
    const fine = (Math.random() - 0.5) * 40;
    const offset = n1 + n2 + n3 + fine;
    px[i]     = Math.max(0, Math.min(255, px[i] + offset));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + offset * 0.9));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + offset * 0.7));
  }
}
tctx.putImageData(imgData, 0, 0);

// Травинки — яркие зелёные штрихи (контрастные!)
for (let i = 0; i < 100000; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const len = 3 + Math.random() * 8;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
  // Яркие — светлее базы = трава выделяется
  const bright = Math.random() > 0.3;
  if (bright) {
    const g = 150 + Math.floor(Math.random() * 80);
    tctx.strokeStyle = `rgba(${g - 80},${g},${g - 100},${0.4 + Math.random() * 0.4})`;
  } else {
    // Тёмные травинки — создают глубину
    const g = 40 + Math.floor(Math.random() * 40);
    tctx.strokeStyle = `rgba(${g},${g + 15},${g - 10},${0.3 + Math.random() * 0.3})`;
  }
  tctx.lineWidth = 0.5 + Math.random() * 1.2;
  tctx.beginPath();
  tctx.moveTo(x, y);
  tctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
  tctx.stroke();
}

// Грязевые пятна — тёмные контрастные кляксы
for (let i = 0; i < 6000; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const r = 2 + Math.random() * 6;
  tctx.fillStyle = `rgba(${30 + Math.floor(Math.random() * 25)},${20 + Math.floor(Math.random() * 20)},${10 + Math.floor(Math.random() * 15)},${0.3 + Math.random() * 0.4})`;
  tctx.beginPath();
  tctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
  tctx.fill();
}

// Камешки — яркие белёсые/серые точки
for (let i = 0; i < 10000; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const r = 0.5 + Math.random() * 2.5;
  const gray = 160 + Math.floor(Math.random() * 70);
  tctx.fillStyle = `rgba(${gray},${gray - 8},${gray - 15},${0.5 + Math.random() * 0.4})`;
  tctx.beginPath();
  tctx.arc(x, y, r, 0, Math.PI * 2);
  tctx.fill();
}

// Крупные проплешины — светлые пятна сухой земли
for (let i = 0; i < 800; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const r = 8 + Math.random() * 20;
  tctx.fillStyle = `rgba(${170 + Math.floor(Math.random() * 40)},${155 + Math.floor(Math.random() * 30)},${110 + Math.floor(Math.random() * 30)},${0.15 + Math.random() * 0.15})`;
  tctx.beginPath();
  tctx.arc(x, y, r, 0, Math.PI * 2);
  tctx.fill();
}

// Тёмные мокрые пятна
for (let i = 0; i < 600; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const r = 6 + Math.random() * 18;
  tctx.fillStyle = `rgba(${15 + Math.floor(Math.random() * 15)},${12 + Math.floor(Math.random() * 10)},${5 + Math.floor(Math.random() * 8)},${0.1 + Math.random() * 0.15})`;
  tctx.beginPath();
  tctx.arc(x, y, r, 0, Math.PI * 2);
  tctx.fill();
}

// Веточки / корешки — тёмные тонкие линии
for (let i = 0; i < 15000; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const len = 2 + Math.random() * 6;
  const angle = Math.random() * Math.PI * 2;
  tctx.strokeStyle = `rgba(${30 + Math.floor(Math.random() * 20)},${20 + Math.floor(Math.random() * 15)},${10},${0.2 + Math.random() * 0.3})`;
  tctx.lineWidth = 0.4 + Math.random() * 0.8;
  tctx.beginPath();
  tctx.moveTo(x, y);
  // Слегка изогнутые
  const mx = x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 2;
  const my = y + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 2;
  tctx.quadraticCurveTo(mx, my, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
  tctx.stroke();
}

// Крошечные точки — песчинки
for (let i = 0; i < 30000; i++) {
  const x = Math.random() * TEX_SIZE;
  const y = Math.random() * TEX_SIZE;
  const bright = Math.random() > 0.5;
  const v = bright ? 180 + Math.floor(Math.random() * 60) : 30 + Math.floor(Math.random() * 40);
  tctx.fillStyle = `rgba(${v},${v - 5},${v - 10},${0.15 + Math.random() * 0.2})`;
  tctx.fillRect(x, y, 1, 1);
}

const terrainTex = new THREE.CanvasTexture(texCanvas);
terrainTex.wrapS = THREE.RepeatWrapping;
terrainTex.wrapT = THREE.RepeatWrapping;
terrainTex.repeat.set(10, 10);
terrainTex.magFilter = THREE.LinearFilter;
terrainTex.minFilter = THREE.LinearMipmapLinearFilter;
terrainTex.anisotropy = 4;

export const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  map: terrainTex,
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
