import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const library = new Map();
let ready = false;
let loadError = null;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function cloneMaterial(material) {
  if (Array.isArray(material)) return material.map(cloneMaterial);
  const result = material.clone();
  result.userData = { ...material.userData, sharedArtMaterial: false, modelAssetMaterial: true };
  return result;
}

function prepareScene(key, scene) {
  scene.name = `model-asset-${key}`;
  scene.userData.modelAssetKey = key;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.userData.sharedModelAsset = true;
    object.material.userData = { ...object.material.userData, sharedArtMaterial: true, modelAssetMaterial: true };
    object.castShadow = object.receiveShadow = true;
  });
  return scene;
}

export async function loadModelPack(manifest) {
  const loader = new GLTFLoader();
  const entries = Object.entries(manifest);
  try {
    await Promise.all(entries.map(async ([key, encoded]) => {
      const gltf = await loader.parseAsync(decodeBase64(encoded), '');
      library.set(key, prepareScene(key, gltf.scene));
    }));
    ready = true;
    loadError = null;
  } catch (error) {
    loadError = error;
    ready = false;
    throw error;
  }
  const stats = modelAssetStats();
  globalThis.__ARBZ_MODEL_ASSETS__ = stats;
  return stats;
}

export function modelAssetReady(key) {
  return library.has(key);
}

export function cloneModelNode(key, nodeName, { material = null, cloneMaterials = true } = {}) {
  const root = library.get(key);
  const source = root?.getObjectByName(nodeName);
  if (!source) return null;
  if (source.isMesh) {
    const mesh = new THREE.Mesh(source.geometry, material || (cloneMaterials ? cloneMaterial(source.material) : source.material));
    mesh.name = source.name;
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { ...source.userData, modelAssetKey: key, modelAssetNode: nodeName };
    return mesh;
  }
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!object.isMesh) return;
    object.material = material || (cloneMaterials ? cloneMaterial(object.material) : object.material);
    object.castShadow = object.receiveShadow = true;
    object.userData = { ...object.userData, modelAssetKey: key, modelAssetNode: object.name };
  });
  return clone;
}

export function cloneModelScene(key, { cloneMaterials = true } = {}) {
  const source = library.get(key);
  if (!source) return null;
  const clone = source.clone(true);
  const materials = new Map();
  clone.name = `${source.name}-instance`;
  clone.userData = { ...source.userData, modelAssetInstance: true };
  clone.traverse((object) => {
    if (!object.isMesh) return;
    if (cloneMaterials) {
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const cloned = sourceMaterials.map((entry) => {
        if (!materials.has(entry)) materials.set(entry, cloneMaterial(entry));
        return materials.get(entry);
      });
      object.material = Array.isArray(object.material) ? cloned : cloned[0];
    }
    object.castShadow = object.receiveShadow = true;
    object.userData = { ...object.userData, modelAssetKey: key, modelAssetNode: object.name };
  });
  return clone;
}

export function modelNodes(key, prefix = '') {
  const root = library.get(key);
  if (!root) return [];
  const nodes = [];
  root.traverse((object) => {
    if (object.isMesh && (!prefix || object.name.startsWith(prefix))) nodes.push(object.name);
  });
  return nodes;
}

export function tintModel(root, palette = {}) {
  if (!root) return root;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const name = (material.name || '').toLowerCase();
      for (const [role, color] of Object.entries(palette)) {
        if (name.includes(role.toLowerCase()) && material.color) material.color.set(color);
      }
    }
  });
  return root;
}

export function modelAssetStats() {
  let meshes = 0, triangles = 0;
  for (const scene of library.values()) scene.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    const index = object.geometry.index;
    triangles += index ? index.count / 3 : object.geometry.attributes.position.count / 3;
  });
  return {
    ready,
    models: library.size,
    meshes,
    triangles: Math.round(triangles),
    keys: [...library.keys()],
    error: loadError ? String(loadError.message || loadError) : null,
  };
}
