import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { organicGeometry, seedGeometry, branchGeometry } from '../js/art/sculpt.js';
import { spring, solveLeg, deformCloth, groundHero } from '../js/art/motion.js';
import { createHero } from '../js/art/characters.js';
import { createResident, RESIDENT_NAMES, animateResident } from '../js/art/inhabitants.js';
import { animateHero } from '../js/art/animation.js';
import { createTree } from '../js/art/botany.js';
import { randomSeed } from '../js/art/palette.js';
import { material, surface } from '../js/art/materials.js';
import { createContactShadows } from '../js/art/contact-shadows.js';
import { disposeRig } from '../js/art/geometry.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};
function validGeometry(geo) {
  assert(geo.attributes.position.count>0);
  for(const attr of Object.values(geo.attributes))assert(Array.from(attr.array).every(Number.isFinite));
  geo.computeBoundingSphere();assert(Number.isFinite(geo.boundingSphere.radius)&&geo.boundingSphere.radius>0);
}
for(const [name,make] of [['rind',()=>organicGeometry()],['seed armour',()=>seedGeometry()],['tapered branch',()=>branchGeometry([[0,0,0],[.2,1,0],[.5,2,.1]])]])test(`${name} has finite UVs, positions and normals`,()=>{const g=make();validGeometry(g);g.dispose();});
test('critically damped secondary motion is frame-rate independent and bounded',()=>{
  const a={value:0,velocity:0},b={value:0,velocity:0};
  for(let i=0;i<120;i++)spring(a,1,1/120);
  for(let i=0;i<30;i++)spring(b,1,1/30);
  assert(Math.abs(a.value-b.value)<1e-10);assert(a.value> .99&&a.value<=1);
  assert.equal(spring(a,NaN,.02),a.value);assert.equal(spring(a,1,0),a.value);
});
test('IK reaches valid foot targets without stretching, including reach limits',()=>{
  for(const [forward,down] of [[.1,.42],[-.15,.36],[0,.51],[0,0],[8,8]]){
    const {hip,knee}=solveLeg(forward,down);assert(Number.isFinite(hip)&&Number.isFinite(knee));
    const y=.29*Math.cos(hip)+.24*Math.cos(hip+knee),z=-.29*Math.sin(hip)-.24*Math.sin(hip+knee);
    if(Math.hypot(forward,down)>.06&&Math.hypot(forward,down)<.529){assert(Math.abs(y-down)<1e-6);assert(Math.abs(z-forward)<1e-6);}
    assert(Math.hypot(y,z)<.53001);
  }
});
test('cloth is pinned at its collar and deforms without accumulating drift',()=>{
  const hero=createHero(),cape=hero.userData.cloth[0],rest=cape.userData.clothRest;
  deformCloth(cape,.5,1,.4);const first=new Float32Array(cape.geometry.attributes.position.array);
  for(let i=0;i<500;i++)deformCloth(cape,.5,1,.4);
  assert.deepEqual(cape.geometry.attributes.position.array,first);
  for(let i=0;i<rest.length;i+=3)if(rest[i+1]===0)assert.deepEqual(Array.from(first.slice(i,i+3)),Array.from(rest.slice(i,i+3)));
  assert(first.some((value,i)=>value!==rest[i]));disposeRig(hero);
});
test('hero ground adaptation does not mutate simulation or limb scale',()=>{
  const hero=createHero(),p={pos:new THREE.Vector3(),vel:new THREE.Vector3(),alive:true,grounded:true,comboCount:1};
  const heights=(x,z)=>x*.12+z*.10;
  for(let i=0;i<60;i++)animateHero(hero,1/60,p,{getHeight:heights});
  assert(p.pos.equals(new THREE.Vector3()));assert(hero.userData.groundAdaptedFeet>0);
  for(const j of Object.values(hero.userData.joints))assert(j.scale.equals(new THREE.Vector3(1,1,1)));
  assert.equal(hero.userData.artVersion,'orchard-2');disposeRig(hero);
});
for(const name of RESIDENT_NAMES)test(`resident ${name} has a distinct procedural model and quest marker`,()=>{
  const rig=createResident(name);assert(rig.userData.body);assert(rig.userData.questMarker);assert(rig.userData.hip);
  for(let i=0;i<40;i++)animateResident(rig,1/60,{animT:i/60,hostile:i>20,facing:2},3);
  rig.updateMatrixWorld(true);rig.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
  disposeRig(rig);
});
test('512px rind normals are unit length within byte-quantisation tolerance',()=>{
  const map=surface('rind').normalMap;assert.equal(map.image.width,512);
  const data=map.image.data;
  for(let i=0;i<data.length;i+=4096){const n=[data[i],data[i+1],data[i+2]].map(v=>(v-128)/127);assert(Math.abs(Math.hypot(...n)-1)<.025);}
});
test('canopy meshes are reproducible and stay within their triangle budget',()=>{
  const mats=[material('leaf')];
  const a=createTree(0,randomSeed(5),mats,'medium'),b=createTree(0,randomSeed(5),mats,'medium');
  let triangles=0;const gather=root=>{const out=[];root.traverse(o=>{if(o.geometry){validGeometry(o.geometry);out.push(...o.geometry.attributes.position.array);}});return out;};
  assert.deepEqual(gather(a),gather(b));a.traverse(o=>{if(o.geometry)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  assert(triangles<5500);disposeRig(a);disposeRig(b);
});
test('contact shadows have bounded capacity and release the instanced GPU resource',()=>{
  const scene=new THREE.Scene(),shadow=createContactShadows(scene,()=>0,4),player={pos:new THREE.Vector3()};
  shadow.update(player,Array.from({length:10},(_,i)=>({alive:true,x:i,y:0,z:0,type:{r:.6}})),[],null);
  assert.equal(shadow.mesh.count,4);let disposed=false;shadow.mesh.addEventListener('dispose',()=>disposed=true);
  shadow.dispose();assert(disposed);assert.equal(scene.children.length,0);
});
