import * as THREE from 'three';
import { cloneModelNode, modelAssetReady } from './model-assets.js';
import { material } from './materials.js';
import { landStyle } from './palette.js';

function extractedGeometry(key, nodeName) {
  if (!modelAssetReady(key)) return null;
  const mesh = cloneModelNode(key, nodeName, { cloneMaterials: false });
  if (!mesh?.geometry) return null;
  const geometry = mesh.geometry.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  geometry.translate(-centre.x, -box.min.y, -centre.z);
  if (!geometry.attributes.color) geometry.setAttribute('color', new THREE.Float32BufferAttribute(
    new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeInstances(geometry, mat, capacity, name) {
  const mesh = new THREE.InstancedMesh(geometry, mat, capacity);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  return mesh;
}

export function createModelDetailField(index, rng, heightAt, distanceToPath, quality = 'medium') {
  const result = new THREE.Group();
  result.name = 'authored-model-details';
  const style = landStyle(index);
  const multipliers = quality === 'low' ? .42 : quality === 'high' ? 1.55 : 1;
  const specs = [
    {
      key: 'prop_rock_cluster', node: 'rock_0', count: Math.round(700 * multipliers),
      material: material('stone', style.stone, { vertexColors: true }),
      scale: () => [.055 + rng()*.13, .025 + rng()*.08, .055 + rng()*.13],
      range: 145, pathMin: 1.5, color: new THREE.Color(style.stone), y: .01,
    },
    {
      key: 'prop_fallen_log', node: 'branch_0', count: Math.round(180 * multipliers),
      material: material('bark', '#7d624c', { vertexColors: true }),
      scale: () => [.30 + rng()*.65, .24 + rng()*.40, .30 + rng()*.65],
      range: 130, pathMin: 2.8, color: new THREE.Color('#8c6c4e'), y: .015,
    },
    {
      key: 'prop_orchard_tree', node: 'leaf_0', count: Math.round((index===1||index===4?160:850) * multipliers),
      material: material('leaf', style.foliage, { side: THREE.DoubleSide, vertexColors: true }),
      scale: () => [.13 + rng()*.26, .13 + rng()*.26, .13 + rng()*.26],
      range: 105, pathMin: .7, color: new THREE.Color(style.foliage), y: .02,
    },
  ];
  const transform = new THREE.Object3D();
  for (const spec of specs) {
    const geometry = extractedGeometry(spec.key, spec.node);
    if (!geometry) continue;
    const mesh = makeInstances(geometry, spec.material, spec.count, `detail-${spec.node}`);
    let written = 0;
    const tint = new THREE.Color();
    for (let attempt = 0; attempt < spec.count * 2.4 && written < spec.count; attempt++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * spec.range;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x, z) < 4 || distanceToPath(x, z) < spec.pathMin) continue;
      const y = heightAt(x, z);
      if (y < -2.7) continue;
      transform.position.set(x, y + spec.y, z);
      transform.rotation.set((rng()-.5)*.28, rng()*Math.PI*2, (rng()-.5)*.20);
      transform.scale.fromArray(spec.scale());
      transform.updateMatrix();
      mesh.setMatrixAt(written, transform.matrix);
      tint.copy(spec.color).offsetHSL((rng()-.5)*.035, (rng()-.5)*.08, (rng()-.5)*.12);
      mesh.setColorAt(written, tint);
      written++;
    }
    mesh.count = written;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    result.add(mesh);
  }
  result.userData.instanceCount = result.children.reduce((sum, child) => sum + child.count, 0);
  return result;
}
