import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHero } from '../js/art/characters.js';
import { secondaryMotion } from '../js/art/motion.js';
import { capePenetration, CLOTH_PHYSICS_VERSION, releaseCape, simulateCape } from '../js/art/cloth-physics.js';
import { disposeRig } from '../js/art/geometry.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};

function finiteCape(cape) {
  const values = cape.geometry.attributes.position.array;
  assert(Array.from(values).every(Number.isFinite));
  cape.geometry.computeBoundingSphere();
  assert(Number.isFinite(cape.geometry.boundingSphere.radius));
}

test('cape collar is outside the rind and particles never penetrate the back shell',()=>{
  const hero=createHero();
  const cape=hero.userData.cloth[0];
  for(let frame=0;frame<180;frame++){
    hero.position.z += frame < 90 ? .09 : .03;
    hero.rotation.y += Math.sin(frame*.09)*.004;
    secondaryMotion(hero,1/60,frame>120?'dodge':'run',1.4,frame/60);
  }
  finiteCape(cape);
  assert.equal(hero.userData.capePhysics.version,CLOTH_PHYSICS_VERSION);
  assert(hero.userData.joints.cape.position.z<=-.76);
  assert(capePenetration(cape)<1e-5,`penetration ${capePenetration(cape)}`);
  assert(hero.userData.capePhysics.maxStretch<1.35,hero.userData.capePhysics.maxStretch);
  releaseCape(cape);disposeRig(hero);
});

test('cape simulation is stable through a full physical roll and recovery',()=>{
  const hero=createHero();
  const cape=hero.userData.cloth[0];
  const hip=hero.userData.joints.hip;
  for(let frame=0;frame<90;frame++){
    const rolling=frame>=15&&frame<55;
    hero.position.z += rolling?.16:.035;
    hip.rotation.x = rolling ? (frame-15)/40*Math.PI*2 : 0;
    secondaryMotion(hero,1/60,rolling?'dodge':'run',rolling?1.5:.65,frame/60);
    finiteCape(cape);
    assert(capePenetration(cape)<1e-4);
  }
  assert(hero.userData.capePhysics.pinned>0);
  assert(hero.userData.capePhysics.constraints>cape.geometry.attributes.position.count*3);
  releaseCape(cape);disposeRig(hero);
});

test('fixed-step cloth gives close results at 30 and 120 FPS',()=>{
  const run=dt=>{
    const hero=createHero(),cape=hero.userData.cloth[0];
    const frames=Math.round(1.5/dt);
    for(let frame=0;frame<frames;frame++){
      hero.position.z += 7*dt;
      hero.rotation.y += .45*dt;
      secondaryMotion(hero,dt,'run',1.1,frame*dt);
    }
    const result=new Float32Array(cape.geometry.attributes.position.array);
    releaseCape(cape);disposeRig(hero);return result;
  };
  const a=run(1/30),b=run(1/120);
  assert.equal(a.length,b.length);
  let error=0;
  for(let i=0;i<a.length;i++)error+=Math.abs(a[i]-b[i]);
  assert(error/a.length<.055,error/a.length);
});

test('direct cape solver preserves the pinned collar',()=>{
  const hero=createHero(),cape=hero.userData.cloth[0];
  hero.userData.joints.cape.position.z=-.76;
  const state=simulateCape(cape,hero,1/60,0,{motion:1});
  const first=new Float32Array(state.current);
  for(let frame=1;frame<60;frame++)simulateCape(cape,hero,1/60,frame/60,{motion:1,turn:.4});
  for(let i=0;i<state.pinned.length;i++)if(state.pinned[i]){
    const offset=i*3;
    assert.equal(state.current[offset],first[offset]);
    assert.equal(state.current[offset+1],first[offset+1]);
    assert.equal(state.current[offset+2],first[offset+2]);
  }
  releaseCape(cape);disposeRig(hero);
});
