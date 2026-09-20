import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyBiome, BIOMES } from '../js/biomes.js';

test('all six biome transitions preserve finite Color-valued sky uniforms', () => {
  const refs = {
    terrainMat: new THREE.MeshStandardMaterial(),
    grassMat: new THREE.MeshStandardMaterial(),
    leafMats: [new THREE.MeshStandardMaterial()],
    scene: new THREE.Scene(),
    hemiLight: new THREE.HemisphereLight(),
    sunLight: new THREE.DirectionalLight(),
    waterMat: new THREE.MeshStandardMaterial(),
    skyMat: { uniforms: Object.fromEntries(['uTop','uHor','uBot'].map(name => [name, { value: new THREE.Vector3() }])) },
  };
  refs.scene.fog = new THREE.FogExp2();
  for (let i = 0; i < BIOMES.length; i++) {
    applyBiome(i, refs);
    for (const uniform of Object.values(refs.skyMat.uniforms)) {
      assert.equal(uniform.value.isColor, true);
      assert(uniform.value.toArray().every(Number.isFinite));
    }
    assert(refs.terrainMat.color.toArray().every(Number.isFinite));
  }
});
