import * as THREE from 'three';

/** A continuous, UV-mapped organic surface. Ribs change the silhouette, not scale. */
export function organicGeometry({ lobes = 10, depth = .018, taper = 0, bend = 0, rings = 28, sides = 48 } = {}) {
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings, theta = v * Math.PI, y = Math.cos(theta);
    for (let i = 0; i <= sides; i++) {
      const u = i / sides, phi = u * Math.PI * 2;
      const rib = 1 + depth * Math.cos(phi * lobes + y * .13) * Math.sin(theta);
      const radius = Math.sin(theta) * rib * (1 - taper * y);
      positions.push(-Math.cos(phi) * radius + bend * (1 - y * y), y, Math.sin(phi) * radius);
      uvs.push(u, 1 - v);
      if (j < rings && i < sides) {
        const a = j * (sides + 1) + i, b = a + sides + 1;
        if (j !== 0) indices.push(a, b, a + 1);
        if (j !== rings - 1) indices.push(b, b + 1, a + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  // Smooth the UV seam after computing normals on duplicated vertices.
  const normals = geo.attributes.normal;
  for (let j = 0; j <= rings; j++) {
    const a = j * (sides + 1), b = a + sides;
    const n = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
  }
  geo.computeBoundingSphere();
  return geo;
}

/** Solid curved seed armour: front, back and rim are one closed surface. */
export function seedGeometry(length = 1, width = .3, bulge = .12, thickness = .035) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-width * 1.7, length * .2, -width * .85, length * .68, 0, length);
  shape.bezierCurveTo(width * .85, length * .68, width * 1.7, length * .2, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1, depth: thickness, bevelEnabled: true, bevelSegments: 2,
    bevelSize: thickness * .45, bevelThickness: thickness * .45, curveSegments: 10,
  });
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), t = Math.max(0, Math.min(1, y / length));
    pos.setZ(i, pos.getZ(i) + Math.sin(t * Math.PI) * bulge * (1 - .55 * (x / width) ** 2));
    uv.setXY(i, .5 + x / (width * 2.4), t);
  }
  geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}

/** Tapered, bent branch. Local cross sections avoid a uniform garden-hose trunk. */
export function branchGeometry(points, radius = .2, endRadius = .025, segments = 12, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false), positions = [], uvs = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, centre = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(radius, endRadius, t) * (1 + Math.sin(t * Math.PI * 4) * .05);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const p = centre.clone().addScaledVector(frames.normals[i], Math.cos(angle) * r)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * r);
      positions.push(p.x, p.y, p.z); uvs.push(j / sides, t * points.length * .6);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}

export function sculpt(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.fromArray(position); mesh.scale.fromArray(scale);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
