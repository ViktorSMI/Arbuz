import { landStyle } from './art/palette.js';
import * as THREE from 'three';

const BIOMES = [
  { name: 'Зелёные холмы', terrainColor: 0x4a7c3f, grassColor: 0x5d8a3c, fogColor: 0x87ceeb, fogDensity: 0.008,
    skyTop: [0.45, 0.72, 0.95], skyBot: [0.85, 0.92, 0.98], skyHor: [0.95, 0.88, 0.7],
    treeLeafColor: 0x2e7d32, waterColor: 0x1565c0, ambientIntensity: 0.5, sunIntensity: 1.8 },
  { name: 'Подземелья крыс', terrainColor: 0x5d4037, grassColor: 0x4e342e, fogColor: 0x3e2723, fogDensity: 0.015,
    skyTop: [0.3, 0.25, 0.2], skyBot: [0.15, 0.1, 0.08], skyHor: [0.4, 0.3, 0.2],
    treeLeafColor: 0x4e342e, waterColor: 0x33691e, ambientIntensity: 0.3, sunIntensity: 1.0 },
  { name: 'Вороньи скалы', terrainColor: 0x616161, grassColor: 0x455a64, fogColor: 0x90a4ae, fogDensity: 0.012,
    skyTop: [0.5, 0.55, 0.6], skyBot: [0.7, 0.72, 0.75], skyHor: [0.8, 0.82, 0.85],
    treeLeafColor: 0x37474f, waterColor: 0x37474f, ambientIntensity: 0.4, sunIntensity: 1.2 },
  { name: 'Токсичная свалка', terrainColor: 0x33691e, grassColor: 0x76ff03, fogColor: 0x1b5e20, fogDensity: 0.018,
    skyTop: [0.2, 0.4, 0.1], skyBot: [0.3, 0.35, 0.15], skyHor: [0.5, 0.6, 0.2],
    treeLeafColor: 0x76ff03, waterColor: 0x76ff03, ambientIntensity: 0.35, sunIntensity: 1.0 },
  { name: 'Военная база', terrainColor: 0x37474f, grassColor: 0x455a64, fogColor: 0x263238, fogDensity: 0.014,
    skyTop: [0.25, 0.3, 0.35], skyBot: [0.15, 0.18, 0.2], skyHor: [0.4, 0.42, 0.45],
    treeLeafColor: 0x546e7a, waterColor: 0x263238, ambientIntensity: 0.3, sunIntensity: 1.1 },
  { name: 'Кухня ада', terrainColor: 0x4e342e, grassColor: 0xbf360c, fogColor: 0x3e2723, fogDensity: 0.016,
    skyTop: [0.6, 0.15, 0.05], skyBot: [0.3, 0.1, 0.05], skyHor: [0.8, 0.4, 0.1],
    treeLeafColor: 0xbf360c, waterColor: 0xbf360c, ambientIntensity: 0.35, sunIntensity: 1.4 },
];

function getBiome(index) {
  return BIOMES[Math.max(0, Math.min(index, BIOMES.length - 1))];
}

function applyBiome(locationIndex, refs) {
  const style = landStyle(locationIndex);
  const { terrainMat, grassMat, leafMats, scene, hemiLight, sunLight, waterMat, skyMat } = refs;
  if (terrainMat) terrainMat.color.set(style.ground).lerp(new THREE.Color('#ffffff'), .65);
  if (grassMat) grassMat.color.set('#ece5c6');
  for (const [i, mat] of (leafMats || []).entries()) mat.color.set(style.foliage).lerp(new THREE.Color('#ffffff'), .36 + i * .08);
  if (scene) {
    scene.background = new THREE.Color(style.fog);
    if (scene.fog) { scene.fog.color.set(style.fog); scene.fog.density = .009; }
  }
  if (sunLight) sunLight.color.set(style.light);
  if (hemiLight) { hemiLight.color.set(style.fog); hemiLight.groundColor.set(style.ground); }
  if (waterMat) waterMat.color.set(locationIndex === 3 ? '#7b9860' : locationIndex === 5 ? '#a16e45' : '#527e80');
  // Color-valued uniforms remain Color objects across every transition.
  if (skyMat?.uniforms) for (const [name, color] of [['uTop', style.sky], ['uHor', style.fog], ['uBot', style.fog]]) {
    if (skyMat.uniforms[name]) skyMat.uniforms[name].value = new THREE.Color(color);
  }
}

export { BIOMES, getBiome, applyBiome };
