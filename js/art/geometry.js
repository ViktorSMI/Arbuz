import * as THREE from 'three';

const shapes = new Map();
const unit = (key, fn) => { if (!shapes.has(key)) shapes.set(key, fn()); return shapes.get(key); };
export function part(parent, mat, pos = [0, 0, 0], scale = [1, 1, 1], shape = 'round') {
  const geo = unit(shape, () => shape === 'box' ? new THREE.BoxGeometry(1, 1, 1, 1, 1, 1)
    : shape === 'stone' ? new THREE.IcosahedronGeometry(1, 1)
    : shape === 'cone' ? new THREE.ConeGeometry(1, 1, 8)
    : new THREE.SphereGeometry(1, 16, 12));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.fromArray(pos); mesh.scale.fromArray(scale);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
export function pivot(parent, name, pos = [0, 0, 0]) {
  const group = new THREE.Group(); group.name = name; group.position.fromArray(pos);
  parent.add(group); return group;
}
export function tube(parent, mat, points, radius = .06, segments = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, radius, 6, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
export function link(parent, mat, a, b, radius = .06, endRadius = radius * .6) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), dir = bv.clone().sub(av);
  const geo = new THREE.CylinderGeometry(endRadius, radius, dir.length(), 6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(av).add(bv).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
// Authored curved blade/leaf silhouette, not a scaled primitive.
export function leaf(parent, mat, length = 1, width = .4, bend = .25, segments = 12) {
  const vertices = [], uv = [], indices = [];
  const n = Math.max(2, Math.min(24, segments | 0));
  for (let row = 0; row <= n; row++) {
    const t = row / n, w = Math.pow(Math.sin(t * Math.PI), .75) * width;
    for (let col = 0; col < 3; col++) {
      const side = col - 1;
      vertices.push(side * w, t * length, bend * t * t + (side === 0 ? .05 : 0));
      uv.push(col / 2, t);
      if (row < n && col < 2) {
        const i = row * 3 + col; indices.push(i, i + 3, i + 1, i + 1, i + 3, i + 4);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
export function ring(parent, mat, radius, tubeRadius, pos = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 5, 28), mat);
  mesh.position.fromArray(pos); mesh.castShadow = true; parent.add(mesh); return mesh;
}

export function disposeRig(root) {
  const geometries = new Set(), mats = new Set();
  root.traverse(o => { if (o.geometry && ![...shapes.values()].includes(o.geometry)) geometries.add(o.geometry);
    if (o.material) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) if (!mat.userData.sharedArtMaterial) mats.add(mat);
  });
  for (const geo of geometries) geo.dispose();
  for (const mat of mats) mat.dispose();
  root.removeFromParent();
}

// Combine stationary details by material. Keeps a ruin or tree to a few draws.
export function collectStatic(root, mergeGeometries) {
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups=new Map();
  root.traverse(obj => {
    if(!obj.isMesh || Array.isArray(obj.material)) return;
    const mat=obj.material;
    if(!groups.has(mat)) groups.set(mat,[]);
    const geo=obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    // All authored parts have position/normal/uv; discard optional attributes.
    for(const name of Object.keys(geo.attributes)) if(!['position','normal','uv'].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld));
    groups.get(mat).push(geo);
  });
  const result=new THREE.Group(); result.position.copy(root.position); result.quaternion.copy(root.quaternion); result.scale.copy(root.scale);
  for(const [mat,geos] of groups) {
    const merged=mergeGeometries(geos,false);
    for(const geo of geos) geo.dispose();
    if(!merged) throw new Error('Не удалось собрать геометрию окружения');
    const mesh=new THREE.Mesh(merged,mat); mesh.castShadow=mesh.receiveShadow=true;
    result.add(mesh);
  }
  disposeRig(root); return result;
}
