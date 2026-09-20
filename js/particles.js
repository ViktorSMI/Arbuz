import * as THREE from 'three';
import { scene } from './scene.js';

// Fixed pool: combat effects do not allocate a mesh/material per hit.
const MAX=640, particles=Array.from({length:MAX},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:0,scale:0,spin:0,color:new THREE.Color()}));
const geo=new THREE.OctahedronGeometry(.085,0);
const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:.2,emissive:0x251608});
const mesh=new THREE.InstancedMesh(geo,mat,MAX);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.name='seed-and-rind-particles';scene.add(mesh);
const transform=new THREE.Object3D(); let cursor=0;
export function spawnParticles(pos,color,count=8,speed=4){
  if(!pos||![pos.x,pos.y,pos.z].every(Number.isFinite))return;
  for(let i=0;i<Math.min(MAX,Math.max(0,count));i++){
    const p=particles[cursor];cursor=(cursor+1)%MAX;
    p.x=pos.x;p.y=pos.y;p.z=pos.z;
    p.vx=(Math.random()-.5)*speed;p.vy=(.3+Math.random()*.7)*speed;p.vz=(Math.random()-.5)*speed;
    p.life=.35+Math.random()*.5;p.age=0;p.scale=.5+Math.random();p.spin=Math.random()*6.283;p.color.set(color).lerp(new THREE.Color('#d6ba8b'),.28);
  }
}
export function updateParticles(dt){
  let visible=0;
  for(const p of particles){
    if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
    p.vy-=11*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const t=p.age/p.life;
    transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.spin+t*4,t*3,p.spin);
    const size=p.scale*(1-t*t);transform.scale.set(size*.55,size*1.7,size);transform.updateMatrix();
    mesh.setMatrixAt(visible,transform.matrix);mesh.setColorAt(visible,p.color);visible++;
  }
  mesh.count=visible;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
}
