// Instrumentation is exposed only on the explicit #art-review URL.
import * as THREE from 'three';
import { scene, renderer, camera } from '../scene.js';
import { createHero, createCreature, createGuardian } from './characters.js';
import { animatorFor, releaseAnimator } from './animation.js';
import { disposeRig } from './geometry.js';
import { worldStats } from '../world.js';
import { materialStats, material } from './materials.js';
import { createResident, RESIDENT_NAMES } from './inhabitants.js';

export function createReviewBridge(callbacks) {
  let actor=null, hidden=[], pedestal=null, state='idle', oldBackground=null,oldView=null;
  function close() {
    if(actor){releaseAnimator(actor);disposeRig(actor);actor=null;}
    if(pedestal){pedestal.geometry.dispose();pedestal.removeFromParent();pedestal=null;}
    for(const [obj,visible] of hidden)obj.visible=visible;hidden=[];
    if(oldBackground)scene.background=oldBackground;
    if(oldView){camera.position.copy(oldView.position);camera.quaternion.copy(oldView.quaternion);camera.fov=oldView.fov;camera.updateProjectionMatrix();oldView=null;}
    document.getElementById('game-root').style.visibility='';
  }
  function show(kind,index=0) {
    close();oldBackground=scene.background;
    oldView={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
    hidden=scene.children.filter(o=>!o.isLight).map(o=>[o,o.visible]);hidden.forEach(([o])=>o.visible=false);
    actor=kind==='hero'?createHero():kind==='resident'?createResident(RESIDENT_NAMES[index]):kind==='guardian'?createGuardian(index):createCreature(kind);
    actor.name='review-actor';scene.add(actor);state='idle';
    const box=new THREE.Box3().setFromObject(actor),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
    const span=Math.max(size.x,size.y,size.z);
    camera.fov=38;camera.updateProjectionMatrix();camera.position.set(centre.x+span*.85,centre.y+span*.3,centre.z+span*1.55);camera.lookAt(centre);
    pedestal=new THREE.Mesh(new THREE.CylinderGeometry(span*.6,span*.65,.10,48),material('stone','#acbca2'));
    pedestal.position.set(centre.x,box.min.y-.08,centre.z);pedestal.receiveShadow=true;scene.add(pedestal);
    scene.background=new THREE.Color('#273c38');
    document.getElementById('game-root').style.visibility='hidden';
    return {kind,index,joints:Object.keys(actor.userData.joints||{hip:actor.userData.hip}),size:size.toArray()};
  }
  if(location.hash==='#art-review') window.__arbuzReview={
    ...callbacks,
    show,close,pose:value=>{state=value;},
    inspect:()=>({...callbacks.read(),world:worldStats(),materials:materialStats(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}}),
  };
  return {tick(dt){if(!actor)return false;if(actor.userData.joints)animatorFor(actor.userData.visual||actor).update(dt,state);return true;}};
}
