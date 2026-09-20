import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Procedural PBR helpers only need a canvas-like pixel buffer during Node tests.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})};

const { loadModelPack, modelAssetReady } = await import('../js/art/model-assets.js');
const { createHero } = await import('../js/art/characters.js');
const { secondaryMotion } = await import('../js/art/motion.js');
const { capePenetration, CLOTH_PHYSICS_VERSION, releaseCape } = await import('../js/art/cloth-physics.js');
const { disposeRig } = await import('../js/art/geometry.js');

await loadModelPack({
  hero: readFileSync('assets/models/hero_arbuzilla.glb').toString('base64'),
});

test('authored GLB hero keeps the physical cape outside the rind while running and rolling',()=>{
  assert(modelAssetReady('hero'));
  const hero=createHero();
  assert.equal(hero.userData.modelAsset,'hero_arbuzilla.glb');
  assert.equal(hero.userData.body.userData.modelAssetKey,'hero');
  const cape=hero.userData.cloth?.[0];
  assert(cape?.isMesh,'GLB cape mesh was not registered');
  assert.equal(cape.userData.modelAssetKey,'hero');
  assert(cape.geometry.attributes.uv?.count===cape.geometry.attributes.position.count,'GLB cape needs a regular UV grid');

  const hip=hero.userData.joints.hip;
  for(let frame=0;frame<210;frame++){
    const rolling=frame>=90&&frame<135;
    hero.position.x+=Math.sin(frame*.037)*.006;
    hero.position.z+=rolling?.145:.065;
    hero.rotation.y+=Math.sin(frame*.041)*.006;
    hip.rotation.x=rolling?(frame-90)/45*Math.PI*2:0;
    secondaryMotion(hero,1/60,rolling?'dodge':'run',rolling?1.55:1.05,frame/60);
    const values=cape.geometry.attributes.position.array;
    assert(Array.from(values).every(Number.isFinite));
    assert(capePenetration(cape)<1e-4,`GLB cape penetrated rind on frame ${frame}`);
  }

  assert.equal(hero.userData.capePhysics.version,CLOTH_PHYSICS_VERSION);
  assert(hero.userData.joints.cape.position.z<=-.76,'cape collar remained inside the GLB rind');
  assert(hero.userData.capePhysics.maxStretch<1.38,hero.userData.capePhysics.maxStretch);
  assert(hero.userData.capePhysics.constraints>cape.geometry.attributes.position.count*3);
  releaseCape(cape);
  disposeRig(hero);
});
