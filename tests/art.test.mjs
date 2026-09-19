import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { selectHeroState, animatorFor, HERO_STATES, releaseAnimator } from '../js/art/animation.js';
import { createHero, createCreature, createGuardian } from '../js/art/characters.js';
import { surface, materialStats } from '../js/art/materials.js';
import { LAND_STYLES, randomSeed } from '../js/art/palette.js';
import { disposeRig } from '../js/art/geometry.js';

// Geometry/material tests need pixels, not a GPU or network.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};
function finiteRig(rig) {
  rig.updateMatrixWorld(true);
  rig.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),o.name));
  const size=new THREE.Box3().setFromObject(rig).getSize(new THREE.Vector3());
  assert(size.toArray().every(v=>v>0&&Number.isFinite(v)));
}
const p={alive:true,grounded:true,vel:new THREE.Vector3(),comboCount:2};
test('animation priorities match combat and locomotion',()=>{
  assert.equal(selectHeroState(p),'idle');
  assert.equal(selectHeroState(p,{moving:true}),'walk');
  assert.equal(selectHeroState(p,{moving:true,sprinting:true}),'run');
  assert.equal(selectHeroState({...p,attacking:true}),'attack2');
  assert.equal(selectHeroState({...p,attacking:true,dodging:true}),'dodge');
  assert.equal(selectHeroState({...p,alive:false,dodging:true}),'death');
  assert.equal(selectHeroState({...p,blocking:true}),'block');
  assert.equal(selectHeroState({...p,grounded:false,vel:new THREE.Vector3(0,6,0)}),'jump');
});
test('hero rig plays every authored action without NaN or deforming mesh scale',()=>{
  const hero=createHero(), anim=animatorFor(hero),scale=hero.userData.body.scale.clone();
  assert(Object.keys(hero.userData.joints).length>=12);
  for(const state of HERO_STATES){ for(let i=0;i<40;i++)anim.update(1/60,state);finiteRig(hero);assert(hero.userData.body.scale.equals(scale)); }
  releaseAnimator(hero);disposeRig(hero);
});
const names=['Жук-солдат','Муравей','Оса','Таракан','Богомол','Кот','Дворник','Крыса-мутант','Голубь-бомбер','Светлячок'];
for(const name of names)test(`new ${name} rig has animation, body and finite bounds`,()=>{
  const rig=createCreature(name),anim=animatorFor(rig);assert(rig.userData.body.isMesh);
  for(const state of ['idle','walk','run','windup','attack1','hit','death']){anim.update(.04,state);finiteRig(rig);}
  releaseAnimator(rig);disposeRig(rig);
});
for(let i=0;i<6;i++)test(`guardian ${i+1} preserves simulation scale and has articulated model`,()=>{
  const rig=createGuardian(i),anim=animatorFor(rig.userData.visual);assert(rig.scale.equals(new THREE.Vector3(1,1,1)));
  anim.update(.03,'walk');finiteRig(rig);releaseAnimator(rig);disposeRig(rig);
});
test('PBR maps are cached and are generated locally',()=>{
  const before=materialStats().surfaces; const a=surface('rind'),b=surface('rind');
  assert.equal(a,b); assert.equal(a.map.image.width,256); assert.equal(a.normalMap.image.data.length,256*256*4);
  assert.equal(materialStats().surfaces,before);assert.equal(LAND_STYLES.length,6);
});
test('seeded scenery sampling is reproducible',()=>{const a=randomSeed(3),b=randomSeed(3);for(let i=0;i<100;i++)assert.equal(a(),b());});
