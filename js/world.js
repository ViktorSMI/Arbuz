import * as THREE from 'three';
import { WORLD_SIZE, TREE_COUNT, ROCK_COUNT, CRATE_COUNT, WATER_LEVEL } from './constants.js';
import { scene, sunLight } from './scene.js';
import { getTerrainHeight } from './terrain.js';

export const obstacles = [];

/* ==================== HELPER: seeded-ish random ==================== */
function rand(lo = 0, hi = 1) { return lo + Math.random() * (hi - lo); }

/* ==================== BARK CANVAS TEXTURE ==================== */
function createBarkTexture() {
  const w = 256, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // base brown
  ctx.fillStyle = '#6B4226'; ctx.fillRect(0, 0, w, h);
  // vertical grain lines
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const lw = 0.5 + Math.random() * 2;
    ctx.strokeStyle = `rgba(${30 + Math.random()*30},${20 + Math.random()*15},${10},${0.3 + Math.random()*0.4})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let cy = 0;
    ctx.moveTo(x, cy);
    while (cy < h) {
      cy += 5 + Math.random() * 15;
      ctx.lineTo(x + (Math.random() - 0.5) * 4, cy);
    }
    ctx.stroke();
  }
  // lighter patches
  for (let i = 0; i < 25; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const pw = 10 + Math.random() * 30, ph = 15 + Math.random() * 40;
    ctx.fillStyle = `rgba(${130 + Math.random()*40},${90 + Math.random()*30},${50 + Math.random()*20},${0.15 + Math.random()*0.15})`;
    ctx.fillRect(px, py, pw, ph);
  }
  // knots
  for (let i = 0; i < 8; i++) {
    const kx = Math.random() * w, ky = Math.random() * h;
    const kr = 3 + Math.random() * 7;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, 'rgba(30,15,5,0.8)');
    grad.addColorStop(0.6, 'rgba(50,30,15,0.5)');
    grad.addColorStop(1, 'rgba(80,50,25,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
    // ring around knot
    ctx.strokeStyle = 'rgba(40,25,10,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(kx, ky, kr + 2, 0, Math.PI * 2); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

/* ==================== WOOD CRATE CANVAS TEXTURE ==================== */
function createWoodTexture() {
  const w = 256, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // base tan/brown
  ctx.fillStyle = '#B08050'; ctx.fillRect(0, 0, w, h);
  // horizontal grain lines
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(${80 + Math.random()*40},${50 + Math.random()*30},${20 + Math.random()*20},${0.15 + Math.random()*0.3})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let cx = 0;
    ctx.moveTo(cx, y);
    while (cx < w) {
      cx += 5 + Math.random() * 20;
      ctx.lineTo(cx, y + (Math.random() - 0.5) * 3);
    }
    ctx.stroke();
  }
  // color variation bands
  for (let i = 0; i < 12; i++) {
    const by = Math.random() * h, bh = 8 + Math.random() * 25;
    ctx.fillStyle = `rgba(${100 + Math.random()*60},${60 + Math.random()*40},${20 + Math.random()*30},${0.08 + Math.random()*0.12})`;
    ctx.fillRect(0, by, w, bh);
  }
  // darker knots
  for (let i = 0; i < 5; i++) {
    const kx = Math.random() * w, ky = Math.random() * h;
    const kr = 4 + Math.random() * 10;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, 'rgba(50,25,10,0.7)');
    grad.addColorStop(0.5, 'rgba(70,40,20,0.4)');
    grad.addColorStop(1, 'rgba(100,60,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
  }
  // stain patches
  for (let i = 0; i < 4; i++) {
    const sx = Math.random() * w, sy = Math.random() * h;
    ctx.fillStyle = `rgba(60,30,10,${0.05 + Math.random()*0.08})`;
    ctx.fillRect(sx, sy, 20 + Math.random()*40, 20 + Math.random()*40);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ==================== GRASS ==================== */
const GRASS_COUNT = 5000;
const grassGeo = new THREE.PlaneGeometry(0.3, 0.8);
export const grassMat = new THREE.MeshStandardMaterial({ color: 0x5d8a3c, side: THREE.DoubleSide, alphaTest: 0.5 });
const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_COUNT);
grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
// per-instance colors
const grassColors = new Float32Array(GRASS_COUNT * 3);
const grassPalette = [
  new THREE.Color(0x3a6b20), // dark green
  new THREE.Color(0x5d8a3c), // medium green
  new THREE.Color(0x7ba650), // light green
  new THREE.Color(0x8db860), // yellow-green
  new THREE.Color(0xa0aa45), // olive
  new THREE.Color(0x7a6b30), // dried brown-green
  new THREE.Color(0x6b8035), // sage
];
const dummy = new THREE.Object3D();
let grassIdx = 0;
for (let i = 0; i < GRASS_COUNT; i++) {
  const gx = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
  const gz = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
  const gy = getTerrainHeight(gx, gz);
  if (gy < WATER_LEVEL + 0.5) { continue; }
  dummy.position.set(gx, gy + 0.35, gz);
  dummy.rotation.set(0, Math.random() * Math.PI, 0);
  // vary blade shapes: some wider, some taller
  const widthVar = 0.6 + Math.random() * 0.9;
  const heightVar = 0.4 + Math.random() * 1.2;
  dummy.scale.set(widthVar, heightVar, 1);
  dummy.updateMatrix();
  grassMesh.setMatrixAt(grassIdx, dummy.matrix);
  // pick a random color from palette with slight randomization
  const col = grassPalette[Math.floor(Math.random() * grassPalette.length)].clone();
  col.r += (Math.random() - 0.5) * 0.05;
  col.g += (Math.random() - 0.5) * 0.06;
  col.b += (Math.random() - 0.5) * 0.03;
  grassColors[grassIdx * 3] = col.r;
  grassColors[grassIdx * 3 + 1] = col.g;
  grassColors[grassIdx * 3 + 2] = col.b;
  grassIdx++;
}
grassMesh.count = grassIdx;
grassMesh.instanceMatrix.needsUpdate = true;
grassMesh.instanceColor = new THREE.InstancedBufferAttribute(grassColors, 3);
scene.add(grassMesh);

/* ==================== TREES ==================== */
const barkTex = createBarkTexture();
const trunkMats = [
  new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.85, color: 0xeeddbb }),
  new THREE.MeshStandardMaterial({ map: barkTex.clone(), roughness: 0.85, color: 0xddccaa }),
];
export const leafMats = [
  new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.7, emissive: 0x1a4a1a, emissiveIntensity: 0.15 }),
  new THREE.MeshStandardMaterial({ color: 0x66BB6A, roughness: 0.7, emissive: 0x1a5a1a, emissiveIntensity: 0.12 }),
  new THREE.MeshStandardMaterial({ color: 0x388E3C, roughness: 0.7, emissive: 0x184018, emissiveIntensity: 0.18 }),
  new THREE.MeshStandardMaterial({ color: 0x81C784, roughness: 0.75, emissive: 0x1a5a1a, emissiveIntensity: 0.1 }),
];

const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
const leafGeo = new THREE.SphereGeometry(2.5, 8, 6);
const leafGeoSmall = new THREE.SphereGeometry(1.8, 7, 5);
const leafGeoTiny = new THREE.SphereGeometry(1.3, 6, 5);
const branchGeo = new THREE.CylinderGeometry(0.06, 0.12, 1.5, 5);
const rootGeo = new THREE.CylinderGeometry(0.04, 0.14, 1.2, 5);
const branchMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.95, color: 0xaa8866 });

for (let i = 0; i < TREE_COUNT; i++) {
  const tx = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const tz = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const dc = Math.sqrt(tx * tx + tz * tz);
  if (dc < 15) continue;
  const ty = getTerrainHeight(tx, tz);
  if (ty < WATER_LEVEL + 0.5) continue;
  const scale = 0.7 + Math.random() * 0.8;
  const group = new THREE.Group();

  // trunk — slight tilt for variation
  const trunk = new THREE.Mesh(trunkGeo, trunkMats[i % 2]);
  trunk.position.y = 2 * scale;
  trunk.scale.set(scale, scale, scale);
  trunk.rotation.z = (Math.random() - 0.5) * 0.1;
  trunk.rotation.x = (Math.random() - 0.5) * 0.08;
  trunk.castShadow = true;
  group.add(trunk);

  // multi-crown: 2–3 overlapping spheres
  const crownCount = 2 + Math.floor(Math.random() * 2); // 2 or 3
  const treeShape = Math.random(); // controls vertical vs flat
  for (let c = 0; c < crownCount; c++) {
    const geos = [leafGeo, leafGeoSmall, leafGeoTiny];
    const crown = new THREE.Mesh(geos[c] || leafGeoSmall, leafMats[(i + c) % leafMats.length]);
    const offsetY = c === 0 ? 5 : (4.2 + c * 1.1 + Math.random() * 0.5);
    const offsetX = c === 0 ? 0 : (Math.random() - 0.5) * 1.8;
    const offsetZ = c === 0 ? 0 : (Math.random() - 0.5) * 1.8;
    crown.position.set(offsetX * scale, offsetY * scale, offsetZ * scale);
    // shape variation: some trees taller canopy, some flatter
    if (treeShape > 0.6) {
      crown.scale.set(scale * 0.85, scale * 1.2, scale * 0.85); // tall
    } else if (treeShape < 0.3) {
      crown.scale.set(scale * 1.15, scale * 0.7, scale * 1.15); // flat/wide
    } else {
      crown.scale.set(scale, scale * 0.9, scale);
    }
    crown.castShadow = true;
    group.add(crown);
  }

  // branches: 2–4 short cylinders sticking out
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branchCount; b++) {
    const branch = new THREE.Mesh(branchGeo, branchMat);
    const angle = (b / branchCount) * Math.PI * 2 + Math.random() * 0.5;
    const branchY = (1.5 + Math.random() * 2.5) * scale;
    branch.position.set(
      Math.cos(angle) * 0.6 * scale,
      branchY,
      Math.sin(angle) * 0.6 * scale
    );
    branch.rotation.z = Math.cos(angle) * 0.8 + (Math.random() - 0.5) * 0.3;
    branch.rotation.x = Math.sin(angle) * 0.8 + (Math.random() - 0.5) * 0.3;
    branch.scale.set(scale, scale * (0.6 + Math.random() * 0.6), scale);
    branch.castShadow = true;
    group.add(branch);
  }

  // roots: 2–3 tapered cylinders at base
  const rootCount = 2 + Math.floor(Math.random() * 2);
  for (let r = 0; r < rootCount; r++) {
    const root = new THREE.Mesh(rootGeo, branchMat);
    const angle = (r / rootCount) * Math.PI * 2 + Math.random() * 0.8;
    root.position.set(
      Math.cos(angle) * 0.4 * scale,
      0.15 * scale,
      Math.sin(angle) * 0.4 * scale
    );
    root.rotation.z = Math.cos(angle) * 1.0;
    root.rotation.x = Math.sin(angle) * 1.0;
    root.scale.set(scale, scale * (0.5 + Math.random() * 0.5), scale);
    group.add(root);
  }

  group.position.set(tx, ty, tz);
  scene.add(group);
  obstacles.push({ x: tx, z: tz, r: 1.5 * scale });
}

/* ==================== ROCKS ==================== */
function createRockGeometry(detail) {
  const geo = new THREE.DodecahedronGeometry(1, detail);
  // Лёгкая деформация — без нормализации, просто смещаем каждую вершину
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const jitter = 0.12;
    pos.setXYZ(i,
      x + (Math.random() - 0.5) * jitter,
      y + (Math.random() - 0.5) * jitter,
      z + (Math.random() - 0.5) * jitter
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // vertex colors: darker at bottom, lighter on top, random moss
  const colors = new Float32Array(pos.count * 3);
  const hasMoss = Math.random() > 0.5;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // base grey, darker at bottom
    const brightness = 0.5 + (y + 1) * 0.15 + Math.random() * 0.1;
    let r = brightness, g = brightness, b = brightness;
    // warm stone tint
    r += 0.03; b -= 0.02;
    // moss patches on top vertices
    if (hasMoss && y > 0.2 && Math.random() > 0.4) {
      g += 0.08 + Math.random() * 0.1;
      r -= 0.05;
      b -= 0.03;
    }
    colors[i * 3] = Math.min(1, Math.max(0, r));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, g));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, b));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

const rockMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  flatShading: true,
});
const mossDiscGeo = new THREE.CircleGeometry(0.3, 8);
const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7a32, roughness: 0.9, side: THREE.DoubleSide });
const pebbleGeo = new THREE.SphereGeometry(0.08, 5, 4);
const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, flatShading: true });

for (let i = 0; i < ROCK_COUNT; i++) {
  const rx = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const rz = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
  const dc = Math.sqrt(rx * rx + rz * rz); if (dc < 12) continue;
  const ry = getTerrainHeight(rx, rz);
  if (ry < WATER_LEVEL + 0.3) continue;
  const s = 0.5 + Math.random() * 1.5;

  // unique rock geometry per rock
  const detail = Math.random() > 0.5 ? 1 : 0;
  const rGeo = createRockGeometry(detail);

  const rock = new THREE.Mesh(rGeo, rockMat);
  rock.position.set(rx, ry + s * 0.4, rz);
  // scale distortions for variety
  rock.scale.set(
    s * (0.7 + Math.random() * 0.6),
    s * (0.4 + Math.random() * 0.5),
    s * (0.7 + Math.random() * 0.6)
  );
  rock.rotation.set(Math.random(), Math.random(), Math.random() * 0.3);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);

  // moss disc on top of ~30% of rocks
  if (Math.random() < 0.3) {
    const moss = new THREE.Mesh(mossDiscGeo, mossMat);
    moss.position.set(rx, ry + s * 0.75, rz);
    moss.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    moss.scale.set(s * 0.6, s * 0.6, 1);
    scene.add(moss);
  }

  // pebble clusters: 2–4 tiny spheres near each rock
  const pebbleCount = 2 + Math.floor(Math.random() * 3);
  for (let p = 0; p < pebbleCount; p++) {
    const peb = new THREE.Mesh(pebbleGeo, pebbleMat);
    const pa = Math.random() * Math.PI * 2;
    const pd = s * 0.8 + Math.random() * 0.6;
    const px = rx + Math.cos(pa) * pd;
    const pz = rz + Math.sin(pa) * pd;
    const py = getTerrainHeight(px, pz);
    peb.position.set(px, py + 0.04, pz);
    peb.scale.set(
      0.5 + Math.random() * 1.0,
      0.4 + Math.random() * 0.6,
      0.5 + Math.random() * 1.0
    );
    peb.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(peb);
  }

  obstacles.push({ x: rx, z: rz, r: s * 0.8 });
}

/* ==================== CRATES ==================== */
const woodTex = createWoodTexture();
const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, color: 0xddccaa });
const crateEdge = new THREE.MeshStandardMaterial({ map: woodTex.clone(), roughness: 0.9, color: 0x9a7755 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.4 });
const nailMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.3 });
const bracketGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
const nailGeo = new THREE.SphereGeometry(0.03, 4, 4);

for (let i = 0; i < CRATE_COUNT; i++) {
  const cx = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
  const cz = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
  const dc = Math.sqrt(cx * cx + cz * cz); if (dc < 10) continue;
  const cy = getTerrainHeight(cx, cz);
  if (cy < WATER_LEVEL + 0.3) continue;

  const crateGroup = new THREE.Group();
  const isDamaged = Math.random() < 0.3;

  // main crate body
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.y = 0.75;
  crate.castShadow = true;
  crate.receiveShadow = true;
  crateGroup.add(crate);

  // two horizontal bands
  for (let b = 0; b < 2; b++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 1.55), crateEdge);
    band.position.y = 0.45 + b * 0.6;
    if (isDamaged) {
      band.rotation.z = (Math.random() - 0.5) * 0.08;
      band.rotation.x = (Math.random() - 0.5) * 0.05;
    }
    crateGroup.add(band);

    // nail heads on the band — 4 per band
    for (let n = 0; n < 4; n++) {
      const nail = new THREE.Mesh(nailGeo, nailMat);
      const nAngle = (n / 4) * Math.PI * 2 + Math.PI * 0.25;
      nail.position.set(
        Math.cos(nAngle) * 0.72,
        band.position.y + 0.055,
        Math.sin(nAngle) * 0.72
      );
      crateGroup.add(nail);
    }
  }

  // metal corner brackets — 4 corners
  const corners = [
    [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
  ];
  for (const [bx, bz] of corners) {
    const bracket = new THREE.Mesh(bracketGeo, metalMat);
    bracket.position.set(bx, 0.75, bz);
    crateGroup.add(bracket);
  }

  // damaged crates get darker stain color tint
  if (isDamaged) {
    crate.material = crate.material.clone();
    crate.material.color.set(0xaa9070);
  }

  crateGroup.position.set(cx, cy, cz);
  crateGroup.rotation.y = Math.random() * Math.PI;
  scene.add(crateGroup);
  obstacles.push({ x: cx, z: cz, r: 1.2 });
}

/* ==================== SKY (unchanged) ==================== */
const skyGeo = new THREE.SphereGeometry(250, 32, 32);
export const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uTop: { value: new THREE.Vector3(0.45, 0.72, 0.95) },
    uBot: { value: new THREE.Vector3(0.85, 0.92, 0.98) },
    uHor: { value: new THREE.Vector3(0.95, 0.88, 0.7) },
  },
  vertexShader: 'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 uTop;uniform vec3 uBot;uniform vec3 uHor;varying vec3 vPos;void main(){float h=normalize(vPos).y;vec3 c=mix(uHor,uTop,smoothstep(0.,.5,h));c=mix(c,uBot,smoothstep(0.,-.2,h));gl_FragColor=vec4(c,1.);}'
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

/* ==================== SUN (unchanged) ==================== */
const sunGeo = new THREE.SphereGeometry(5, 16, 16);
const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
export const sunMesh = new THREE.Mesh(sunGeo, sunDiscMat);
sunMesh.position.copy(sunLight.position).normalize().multiplyScalar(240);
scene.add(sunMesh);

/* ==================== WATER (unchanged) ==================== */
const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
export const waterMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.3 });
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -3;
scene.add(water);
