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
  const biome = getBiome(locationIndex);
  const { terrainMat, grassMat, leafMats, scene, ambientLight, hemiLight, sunLight, waterMat, skyMat } = refs;

  if (terrainMat) {
    terrainMat.color.setHex(biome.terrainColor);
  }

  if (grassMat) {
    grassMat.color.setHex(biome.grassColor);
  }

  if (leafMats && Array.isArray(leafMats)) {
    for (const mat of leafMats) {
      mat.color.setHex(biome.treeLeafColor);
    }
  }

  if (scene) {
    const fogCol = new THREE.Color(biome.fogColor);
    if (scene.fog) {
      scene.fog.color.copy(fogCol);
      if (scene.fog.density !== undefined) {
        scene.fog.density = biome.fogDensity;
      }
    }
    scene.background = fogCol;
  }

  if (ambientLight) {
    ambientLight.intensity = biome.ambientIntensity;
  }

  if (sunLight) {
    sunLight.intensity = biome.sunIntensity;
  }

  if (waterMat) {
    waterMat.color.setHex(biome.waterColor);
  }

  if (skyMat && skyMat.uniforms) {
    if (skyMat.uniforms.uTop) {
      skyMat.uniforms.uTop.value = new THREE.Vector3(biome.skyTop[0], biome.skyTop[1], biome.skyTop[2]);
    }
    if (skyMat.uniforms.uBot) {
      skyMat.uniforms.uBot.value = new THREE.Vector3(biome.skyBot[0], biome.skyBot[1], biome.skyBot[2]);
    }
    if (skyMat.uniforms.uHor) {
      skyMat.uniforms.uHor.value = new THREE.Vector3(biome.skyHor[0], biome.skyHor[1], biome.skyHor[2]);
    }
  }

  if (hemiLight) {
    hemiLight.color.setHex(biome.fogColor);
  }
}

export { BIOMES, getBiome, applyBiome };
