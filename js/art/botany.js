import * as THREE from 'three';
import { part, link, leaf, tube, disposeRig } from './geometry.js';
import { branchGeometry, sculpt } from './sculpt.js';
import { material } from './materials.js';
import { landStyle } from './palette.js';

/** Dense leaf clusters have shaped edges and open gaps, never spherical crowns. */
function crownGeometry(rng, centre, radius, count = 110) {
  const positions = [], colors = [], uvs = [], indices = [];
  const transform = new THREE.Object3D(), point = new THREE.Vector3(), color = new THREE.Color();
  // Two curved triangles on either side of a raised midrib.
  const shape = [[0,0,0],[-.36,.42,0],[0,.48,.12],[.36,.42,0],[0,1,.18]];
  const faces = [0,1,2,0,2,3,1,4,2,2,4,3];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963, y = 1 - 2 * (i + .5) / count, r = Math.sqrt(1-y*y);
    const shell = .5 + rng() * .5;
    transform.position.set(centre[0] + Math.cos(angle)*r*radius*shell,
      centre[1] + y*radius*.52*shell, centre[2] + Math.sin(angle)*r*radius*shell);
    transform.rotation.set(-.7 + rng()*2.0, angle, -.7 + rng()*1.4);
    transform.scale.setScalar(.62 + rng()*.38); transform.updateMatrix();
    const shade = .52 + (y+1)*.15 + rng()*.15;
    color.setRGB(shade*.96, shade, shade*.85);
    const start = positions.length / 3;
    for (let v = 0; v < shape.length; v++) {
      point.fromArray(shape[v]).applyMatrix4(transform.matrix);
      positions.push(point.x, point.y, point.z); colors.push(color.r,color.g,color.b);
      uvs.push(shape[v][0]+.5,shape[v][1]);
    }
    faces.forEach(f=>indices.push(start+f));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}

export function createTree(index, rng, leafMats, quality = 'medium') {
  const root = new THREE.Group(), wood = material('bark','#b8b4a0');
  const height = 5.5 + rng()*2.8, bend = (rng()-.5)*1.6;
  const trunk = [[0,-.08,0],[.12,height*.26,.10],[bend,height*.6,0],[bend-.2,height,.1]];
  sculpt(root,branchGeometry(trunk,.34,.035,14,9),wood);
  const leafy = index===0 || index===2 || index===5;
  const count = quality==='low'?64:quality==='high'?130:95;
  for(let i=0;i<6;i++) {
    const angle = i*2.3999 + rng()*.5, extent = 1.6+rng()*1.1;
    const y = height*(.5+i*.062), start=[bend*.55,y-.8,0];
    const end=[bend+Math.cos(angle)*extent,y+.65,Math.sin(angle)*extent];
    sculpt(root,branchGeometry([start,[(start[0]+end[0])*.5,y,end[2]*.5],end],.13,.012,8,7),wood);
    if(leafy) {
      const crown = new THREE.Mesh(crownGeometry(rng,end,1.45+rng()*.3,count),leafMats[i%leafMats.length]);
      crown.castShadow=crown.receiveShadow=true; root.add(crown);
    } else {
      const twig=[end[0]*1.08,end[1]+.8,end[2]*1.07];
      sculpt(root,branchGeometry([end,twig,[twig[0]+.2,twig[1]+.3,twig[2]]],.045,.006,5,5),wood);
    }
  }
  for(let i=0;i<5;i++) {
    const a=i/5*Math.PI*2;
    sculpt(root,branchGeometry([[0,.35,0],[Math.cos(a)*.50,.04,Math.sin(a)*.50],[Math.cos(a)*1.20,-.08,Math.sin(a)*1.20]],.16,.015,7,7),wood);
  }
  return root;
}

export function foliageShader(mat, time, strength = 1) {
  mat.side=THREE.DoubleSide; mat.vertexColors=true;
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uFoliageTime=time;
    shader.vertexShader='uniform float uFoliageTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 foliageOrigin = (modelMatrix * vec4(position, 1.0)).xyz;
      #ifdef USE_INSTANCING
        foliageOrigin = (modelMatrix * instanceMatrix * vec4(position,1.0)).xyz;
      #endif
      float phase = foliageOrigin.x * .37 + foliageOrigin.z * .29;
      float gust = sin(uFoliageTime*1.35 + phase) + sin(uFoliageTime*2.1 - phase*.45)*.3;
      transformed.x += gust * ${(.08*strength).toFixed(3)} * uv.y * uv.y;
      transformed.z += cos(uFoliageTime+phase) * ${(.04*strength).toFixed(3)} * uv.y;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float throughLeaf=pow(max(0.0,-dot(normal,directionalLights[0].direction)),2.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * throughLeaf * .14;
      #endif
    `);
  };
  mat.customProgramCacheKey=()=>`orchard-foliage-2-${strength}`;
}

/** Instanced ferns, small flowers and path gravel share three draws. */
export function createGroundcover(index, rng, heightAt, pathDistance, mergeGeometries, time, quality) {
  const result=new THREE.Group(); result.name='orchard-understory';
  const count=quality==='low'?180:quality==='high'?750:420;
  const style=landStyle(index), green=material('leaf','#dbe1c2',{side:THREE.DoubleSide,vertexColors:true});
  foliageShader(green,time,.55);
  const bloomMat=material('bone',index===5?'#df9568':index===1?'#c6b8d7':'#e8dcab',{side:THREE.DoubleSide,vertexColors:true});
  foliageShader(bloomMat,time,.4);
  const dry=index===1||index===4||index===5;
  function mergeTemplate(template) {
    template.updateMatrixWorld(true);
    const geos=template.children.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld));
    const merged=mergeGeometries(geos,false); geos.forEach(g=>g.dispose()); disposeRig(template); return merged;
  }
  const fern=new THREE.Group();
  for(let f=0;f<5;f++) {
    const angle=f*2.399;
    for(let i=0;i<5;i++) for(const side of [-1,1]) {
      const frond=leaf(fern,green,.14+(4-i)*.015,.04,.018,2);
      frond.position.set(Math.sin(angle)*i*.052,.06+i*.047,Math.cos(angle)*i*.052);
      frond.rotation.set(.45,angle+side*.8,side*.95);
    }
  }
  const flower=new THREE.Group();
  for(let f=0;f<5;f++) {
    const petal=leaf(flower,bloomMat,.075,.03,.022,2);
    petal.position.y=.36; petal.rotation.set(.9,f*Math.PI*2/5,0);
  }
  // Stems share the same material draw; avoid per-flower lights or sprites.
  link(flower,bloomMat,[0,0,0],[0,.36,0],.009,.004);
  const stones=new THREE.IcosahedronGeometry(1,0);
  const stoneMat=material('stone','#c3bbae',{vertexColors:true});
  const types=[new THREE.InstancedMesh(mergeTemplate(fern),green,count),
    new THREE.InstancedMesh(mergeTemplate(flower),bloomMat,count),
    new THREE.InstancedMesh(stones,stoneMat,count*2)];
  const transform=new THREE.Object3D(), color=new THREE.Color();
  types.forEach((mesh,k)=>{
    // MeshStandardMaterial has no default vertex colour. Supply white before
    // multiplying the authored material and per-instance colour in the shader.
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(
      new Float32Array(mesh.geometry.attributes.position.count*3).fill(1),3));
    let n=0;
    for(let i=0;i<mesh.count;i++) {
      const range=k===2?125:90, x=(rng()-.5)*range,z=(rng()-.5)*range,y=heightAt(x,z);
      const road=pathDistance(x,z);
      if(y< -2.5 || Math.hypot(x,z)<1.8 || (k!==2&&road<2.6) || Math.hypot(x-120,z-120)<28)continue;
      if(k!==2&&dry&&rng()<.68)continue;
      transform.position.set(x,y+(k===2?.015:0),z);
      transform.rotation.set(0,rng()*Math.PI*2,0);
      const scale=.65+rng()*1.3;
      transform.scale.set(k===2?.07+rng()*.10:scale,k===2?.04+rng()*.055:scale,k===2?.07+rng()*.1:scale);
      transform.updateMatrix();mesh.setMatrixAt(n,transform.matrix);
      color.set(k===0?style.foliage:'#fff0d3').lerp(new THREE.Color('#cbbc7b'),rng()*.18);
      mesh.setColorAt(n++,color);
    }
    mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere(); result.add(mesh);
  });
  return result;
}
