import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DODGE_DURATION, DODGE_SPEED } from '../js/constants.js';
import { createHero } from '../js/art/characters.js';
import { animateHero, animatorFor, releaseAnimator } from '../js/art/animation.js';
import {
  advanceStridePhase,
  rollAngleFromDistance,
  sampleFootCycle,
  PROCEDURAL_LOCOMOTION_VERSION,
} from '../js/art/procedural-locomotion.js';
import { disposeRig } from '../js/art/geometry.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};

function player(speed = 8) {
  return {
    alive: true, grounded: true, attacking: false, dodging: false, blocking: false, parrying: false,
    dmgFlash: 0, comboCount: 1, vel: new THREE.Vector3(0, 0, speed), dodgeDir: new THREE.Vector3(0, 0, 1),
  };
}
function finiteRig(root) {
  root.updateMatrixWorld(true);
  root.traverse(object => assert(object.matrixWorld.elements.every(Number.isFinite), object.name));
}
function simulate(frames, dt, speed) {
  const hero=createHero(), p=player(speed);
  for(let i=0;i<frames;i++){
    hero.position.z += speed * dt;
    animateHero(hero,dt,p,{moving:true,sprinting:speed>10,getHeight:()=>0});
  }
  const gait={...hero.userData.gait};
  finiteRig(hero);releaseAnimator(hero);disposeRig(hero);
  return gait;
}

test('stride phase is driven by travelled distance rather than frame count',()=>{
  const a=simulate(120,1/120,8),b=simulate(30,1/30,8);
  assert.equal(a.version,PROCEDURAL_LOCOMOTION_VERSION);
  assert(Math.abs(a.phase-b.phase)<.015,`${a.phase} vs ${b.phase}`);
  assert(Math.abs(a.strideDistance-b.strideDistance)<.01);
  assert.equal(advanceStridePhase(.25,0,3),.25);
  assert(Math.abs(advanceStridePhase(.25,3,3)-.25)<1e-12);
});

test('procedural foot cycle alternates planted and swinging feet',()=>{
  for(let i=0;i<100;i++){
    const phase=i/100,left=sampleFootCycle(phase,.6,0),right=sampleFootCycle(phase,.6,.5);
    assert(Number.isFinite(left.travel)&&Number.isFinite(left.lift));
    assert(left.lift>=0&&left.lift<=1);
    assert(right.lift>=0&&right.lift<=1);
    assert(left.stance||right.stance,'at least one foot supports the body');
  }
});

test('walk, run and dodge mixer clips are neutral procedural bases',()=>{
  const hero=createHero(),anim=animatorFor(hero);
  for(const state of ['walk','run','dodge']){
    const clip=anim.actions[state].getClip();
    assert(clip.tracks.length>0);
    for(const track of clip.tracks){
      const values=Array.from(track.values);
      assert(values.every(value=>value===values[0]),`${state} contains authored motion in ${track.name}`);
    }
  }
  releaseAnimator(hero);disposeRig(hero);
});

test('dodge rotation is generated from actual displacement and direction',()=>{
  const hero=createHero(),p=player(DODGE_SPEED);p.dodging=true;
  const frames=21,dt=DODGE_DURATION/frames;
  for(let i=0;i<frames;i++){
    hero.position.z+=DODGE_SPEED*dt;
    animateHero(hero,dt,p,{moving:true,getHeight:()=>0});
  }
  const roll=hero.userData.proceduralRoll;
  assert.equal(roll.version,PROCEDURAL_LOCOMOTION_VERSION);
  assert(Math.abs(roll.distance-DODGE_SPEED*DODGE_DURATION)<.01);
  assert(Math.abs(roll.angle-Math.PI*2)<.03,roll.angle);
  assert(Math.abs(rollAngleFromDistance(DODGE_SPEED*DODGE_DURATION)-Math.PI*2)<1e-12);
  assert(Math.abs(roll.axis[0]-1)<1e-6&&Math.abs(roll.axis[2])<1e-6);
  finiteRig(hero);releaseAnimator(hero);disposeRig(hero);
});

test('procedural gait reacts continuously to acceleration and lateral movement',()=>{
  const hero=createHero(),p=player(2);
  for(let i=0;i<90;i++){
    const speed=2+i/89*11;
    p.vel.set(speed*.55,0,speed*.835);
    hero.position.addScaledVector(p.vel,1/60);
    animateHero(hero,1/60,p,{moving:true,sprinting:speed>10,getHeight:(x,z)=>x*.025+z*.01});
  }
  const gait=hero.userData.gait;
  assert(gait.speed>9);
  assert(gait.runBlend>.45);
  assert(Math.abs(gait.direction.x)>.2);
  assert.equal(hero.userData.groundAdaptedFeet,2);
  for(const joint of Object.values(hero.userData.joints)) assert(joint.scale.equals(new THREE.Vector3(1,1,1)));
  finiteRig(hero);releaseAnimator(hero);disposeRig(hero);
});
