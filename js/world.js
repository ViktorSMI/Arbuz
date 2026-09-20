import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD_SIZE, WATER_LEVEL, BOSS_ARENA_POS, BOSS_ARENA_R } from './constants.js';
import { scene, sunLight, hemiLight, renderer } from './scene.js';
import { getTerrainHeight, terrainMat, pathDistance } from './terrain.js';
import { landStyle, randomSeed } from './art/palette.js';
import { material, surface, glow } from './art/materials.js';
import { part, tube, link, leaf, ring, collectStatic, disposeRig } from './art/geometry.js';
import { getSetting } from './settings.js';
import { createTree, createGroundcover, foliageShader } from './art/botany.js';
import { createSkyMaterial, setGroundPalette } from './art/landscape.js';

export const obstacles=[];
export const grassMat=material('leaf','#ece5c6',{side:THREE.DoubleSide});
export const leafMats=[material('canopy','#c7d4a4'),material('canopy','#e0dba8'),material('canopy','#9caf8d')];
const timeUniform={value:0};
for(const mat of leafMats) foliageShader(mat,timeUniform,.8);
const worldRoot=new THREE.Group(); worldRoot.name='orchard-world'; scene.add(worldRoot);
let current=-1, grass=null, lightMotes=null, lanterns=[];
let currentQuality='';

// Shared wind shader moves blade tips, leaving their roots fixed.
grassMat.onBeforeCompile=shader=>{
  shader.uniforms.uWindTime=timeUniform;
  shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      float phase = instanceMatrix[3].x * .17 + instanceMatrix[3].z * .11;
      transformed.x += sin(uWindTime * 1.7 + phase + position.y * 2.) * .15 * position.y * position.y;
      transformed.z += cos(uWindTime * 1.2 + phase) * .08 * position.y;
    #endif`);
};
grassMat.customProgramCacheKey=()=> 'orchard-wind-1';

function tree(index,rng) { return createTree(index,rng,leafMats,getSetting('quality')); }
function memoryArch(index) {
  const root=new THREE.Group(), stone=material('stone','#e3e0c7'), bronze=material('gold');
  for(const s of [-1,1]) {
    for(let i=0;i<4;i++) part(root,stone,[s*2.0,.47+i*.9,0],[1.05,.88,1.15],'box').rotation.y=(i%2?.035:-.02);
    part(root,stone,[s*2,4.1,0],[1.4,.36,1.42],'box');
    part(root,stone,[s*2,.16,0],[1.5,.3,1.55],'box');
  }
  for(let i=0;i<9;i++) {
    const a=i/8*Math.PI, x=Math.cos(a)*2, y=4.05+Math.sin(a)*1.8;
    const block=part(root,stone,[x,y,0],[.79,.77,1.06],'box'); block.rotation.z=a-Math.PI/2;
  }
  const seal=ring(root,bronze,.44,.038,[0,5.4,.60]);
  const seed=leaf(root,glow(landStyle(index).accent,.5),.54,.18,.02); seed.position.set(0,5.12,.64);
  for(const s of [-1,1]) tube(root,material('bark'),[[s*2.25,0,.4],[s*1.9,1.4,.64],[s*2.23,2.8,.58],[s*1.8,4.3,.63]],.065,14);
  return root;
}
function lantern(root,x,y,z,index) {
  const iron=material('iron'), g=new THREE.Group(); g.position.set(x,y,z); root.add(g);
  part(g,iron,[0,.06,0],[.24,.12,.24],'box');
  part(g,glow(landStyle(index).accent,1.5),[0,.32,0],[.095,.19,.095]);
  for(const s of [-1,1]) for(const t of [-1,1]) link(g,iron,[s*.09,.1,t*.09],[s*.09,.54,t*.09],.014);
  part(g,iron,[0,.57,0],[.32,.12,.32],'cone');
  return g;
}
function prop(index,rng) {
  const root=new THREE.Group(), wood=material('bark'), iron=material('iron'), stone=material('stone','#cfceb9');
  if(index===0) {
    // Orchard trellis: broken planting frames and a surviving vine.
    for(const s of [-1,1]) link(root,wood,[s*1.15,0,0],[s*1.1,2.7,0],.12,.08);
    for(let i=0;i<3;i++) link(root,wood,[-1.5,.9+i*.75,0],[1.5,.9+i*.75,0],.065);
    tube(root,material('leaf'),[[-1,0,.12],[-.5,.9,.16],[.3,1.6,.18],[.8,2.4,.08]],.035);
    for(let i=0;i<5;i++) { const l=leaf(root,leafMats[0],.45,.16,.10); l.position.set(-.5+i*.29,.6+i*.34,.18); l.rotation.z=i%2?.85:-.85; }
    part(root,stone,[1.6,.24,0],[.5,.24,.5],'stone');
  } else if(index===1) {
    // Collapsed culvert with sewer grating.
    for(const s of [-1,1]) part(root,stone,[s*1.1,1.2,0],[.6,2.4,1.3],'box');
    part(root,stone,[0,2.5,0],[2.8,.5,1.3],'box');
    for(let i=0;i<6;i++) link(root,iron,[-.9+i*.36,0,.2],[-.9+i*.36,2.3,.2],.035);
    part(root,material('chitin','#b6b383'),[-1.3,.16,.7],[.6,.16,.4]);
  } else if(index===2) {
    for(let i=0;i<4;i++) part(root,stone,[0,.4+i*.72,0],[1.3-i*.16,.72,1.0-i*.12],'box');
    link(root,iron,[-1.4,3.3,0],[1.4,3.3,0],.06);
    for(let i=0;i<7;i++) { const feather=leaf(root,material('feather','#96aebc'),.5,.075,.08); feather.position.set(-.8+i*.28,3.24,0); feather.rotation.z=Math.PI; }
    lantern(root,0,2.7,.65,index);
  } else if(index===3) {
    for(let i=0;i<3;i++) { const drum=part(root,iron,[(i-1)*.65,.55,i%2*.3],[.47,.58,.47]); drum.rotation.z=(i-1)*.22; ring(root,material('gold','#a5a684'),.46,.05,[(i-1)*.65,1.0,i%2*.3]).rotation.x=Math.PI/2; }
    part(root,glow('#afce72',.45),[0,.045,.75],[1.6,.045,.85]);
    for(let i=0;i<3;i++) part(root,stone,[1+i*.14,.3+i*.22,-.2],[.5,.45,.4],'stone');
  } else if(index===4) {
    for(let i=0;i<5;i++) { part(root,material('cloth','#b4bdaa'),[(i-2)*.65,.27,0],[.43,.27,.32]); part(root,material('cloth','#b4bdaa'),[(i-2)*.65,.72,.08],[.4,.22,.32]); }
    for(const s of [-1,1]) { link(root,iron,[s*1.5,0,-.5],[s*.6,1.8,-.5],.065); link(root,iron,[s*.6,0,-.5],[s*1.5,1.8,-.5],.065); }
  } else {
    part(root,stone,[0,1.0,0],[2.8,.22,1.2],'box');
    for(const s of [-1,1]) for(const t of [-1,1]) link(root,iron,[s*1.15,0,t*.4],[s*1.15,1,t*.4],.06);
    part(root,iron,[0,1.42,0],[.45,.37,.45]); ring(root,material('gold'),.44,.03,[0,1.76,0]).rotation.x=Math.PI/2;
    lantern(root,-.98,1.15,0,index);
    for(let i=0;i<3;i++) part(root,material('bone'),[.8,1.16+i*.06,0],[.27,.025,.27]);
  }
  return root;
}
function place(root,x,z,rotation=0) {
  root.position.set(x,getTerrainHeight(x,z),z); root.rotation.y=rotation;
  const batched=collectStatic(root,mergeGeometries); worldRoot.add(batched); return batched;
}
function clearWorld() {
  for(const child of [...worldRoot.children]) disposeRig(child);
  for(const light of lanterns) { scene.remove(light); light.dispose(); }
  lanterns=[]; obstacles.length=0; grass=null; lightMotes=null;
}
function buildWorld(index) {
  clearWorld(); current=index; setGroundPalette(index); const rng=randomSeed(83717+index*137), style=landStyle(index);
  for(let i=0;i<leafMats.length;i++) leafMats[i].color.set(style.foliage).lerp(new THREE.Color('#ffffff'),.36+i*.08);
  terrainMat.color.set(style.ground).lerp(new THREE.Color('#ffffff'),.65);
  scene.fog.color.set(style.fog); scene.background.set(style.fog);
  skyMat.uniforms.uTop.value.copy(new THREE.Color(style.sky));
  skyMat.uniforms.uHor.value.copy(new THREE.Color(style.fog));
  skyMat.uniforms.uBot.value.copy(new THREE.Color(style.fog));
  waterMat.color.set(index===3?'#7b9860':index===5?'#a16e45':'#527e80');
  hemiLight.color.set(style.fog); hemiLight.groundColor.set(style.ground);
  for(let i=0;i<64;i++) {
    const x=(rng()-.5)*340, z=(rng()-.5)*340;
    if(Math.hypot(x,z)<13 || pathDistance(x,z)<5 || Math.hypot(x-120,z-120)<32 || getTerrainHeight(x,z)<WATER_LEVEL+.8) continue;
    place(tree(index,rng),x,z,rng()*6.28); obstacles.push({x,z,r:.55});
  }
  for (const [x,z] of [[-9,8],[14,9],[-13,22],[7,28]]) {
    place(tree(index,rng),x,z,rng()*6.28); obstacles.push({x,z,r:.55});
  }
  // Fixed first view. The path stays clear; only the arch's side columns collide.
  const gate=place(memoryArch(index),5,16,-.22);
  for(const s of [-1,1]) {
    const x=5+s*2*Math.cos(-.22),z=16-s*2*Math.sin(-.22); obstacles.push({x,z,r:.55});
  }
  for(let i=0;i<18;i++) {
    const angle=i*.81, radius=18+i*5.4, x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(getTerrainHeight(x,z)<WATER_LEVEL+.5 || pathDistance(x,z)<3 || Math.hypot(x-BOSS_ARENA_POS.x,z-BOSS_ARENA_POS.z)<BOSS_ARENA_R+3) continue;
    place(prop(index,rng),x,z,rng()*6.28);
  }
  // Foreground ruins beside the main path.
  place(prop(index,rng),-5,6,.45); place(prop(index,rng),10,24,-.5);
  for(let i=0;i<30;i++) {
    const x=(rng()-.5)*330,z=(rng()-.5)*330,y=getTerrainHeight(x,z);
    if(y<WATER_LEVEL+.4 || Math.hypot(x,z)<12 || pathDistance(x,z)<4) continue;
    const rock=new THREE.Group();
    for(let j=0;j<3;j++) part(rock,material('stone','#c8c8b4'),[(rng()-.5)*1.5,.3+j*.25,(rng()-.5)*1.5],[.5+rng(),.4+rng()*.4,.5+rng()],'stone').rotation.set(rng(),rng(),rng());
    place(rock,x,z); obstacles.push({x,z,r:.8});
  }
  buildGrass(rng,index);
  buildMotes(rng,index);
  worldRoot.add(createGroundcover(index,rng,getTerrainHeight,pathDistance,mergeGeometries,timeUniform,getSetting('quality')));
  for(const [x,z] of [[-3,3],[7,15]]) {
    const light=new THREE.PointLight(style.accent,2,8,2); light.position.set(x,getTerrainHeight(x,z)+1.3,z); scene.add(light); lanterns.push(light);
  }
}
function buildGrass(rng,index) {
  const template=new THREE.Group();
  for(let i=0;i<3;i++) { const blade=leaf(template,grassMat,.65+i*.16,.026+i*.007,.13,2); blade.rotation.y=i*2.1; blade.rotation.z=(i-1)*.24; }
  template.updateMatrixWorld(true);
  const geos=template.children.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld));
  const geo=mergeGeometries(geos,false); geos.forEach(g=>g.dispose()); disposeRig(template);
  const counts={low:5000,medium:10000,high:16000}; const count=counts[getSetting('quality')]||10000;
  grass=new THREE.InstancedMesh(geo,grassMat,count); grass.name='wind-grass';
  const transform=new THREE.Object3D(), col=new THREE.Color(); let n=0;
  for(let i=0;i<count;i++) {
    // More detail close to the opening, wider coverage behind it.
    const near=i<count*.45, range=near?90:365;
    const x=(rng()-.5)*range,z=(rng()-.5)*range,y=getTerrainHeight(x,z);
    if(y<WATER_LEVEL+.3 || pathDistance(x,z)<1.6 || Math.hypot(x,z)<1.8) continue;
    transform.position.set(x,y,z); transform.rotation.y=rng()*6.283;
    transform.scale.setScalar((index===1||index===4?.4:.7)*( .55+rng()*.65 )); transform.updateMatrix();
    grass.setMatrixAt(n,transform.matrix);
    col.set(landStyle(index).foliage).lerp(new THREE.Color('#e0cd97'),rng()*.5).multiplyScalar(1.20);
    grass.setColorAt(n,col); n++;
  }
  grass.count=n; grass.instanceMatrix.needsUpdate=true; grass.instanceColor.needsUpdate=true;
  grass.receiveShadow=true; grass.castShadow=false; grass.computeBoundingSphere(); worldRoot.add(grass);
}
function buildMotes(rng,index) {
  const count=90, pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){pos[i*3]=(rng()-.5)*60;pos[i*3+1]=1+rng()*5;pos[i*3+2]=(rng()-.5)*60;}
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:landStyle(index).accent,size:.06,transparent:true,opacity:.55,depthWrite:false});
  lightMotes=new THREE.Points(geo,mat); lightMotes.userData.sharedArtMaterial=false; worldRoot.add(lightMotes);
}
export const skyMat=createSkyMaterial(timeUniform);
const sky=new THREE.Mesh(new THREE.SphereGeometry(270,24,16),skyMat); sky.name='orchard-sky'; sky.frustumCulled=false; scene.add(sky);
export const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(2.3,12,8),new THREE.MeshBasicMaterial({color:'#ffedbf'})); sunMesh.visible=false; scene.add(sunMesh);
export const waterMat=material('iron','#70938f',{transparent:true,opacity:.82,metalness:.25,roughness:.48,normalScale:new THREE.Vector2(.13,.13)}).clone();
waterMat.map=null;
const water=new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE*2,WORLD_SIZE*2),waterMat);water.rotation.x=-Math.PI/2;water.position.y=WATER_LEVEL;scene.add(water);

export function updateWorld(dt,focus,index=0,timeOfDay=.25) {
  timeUniform.value+=Math.max(0,Math.min(dt,.05));
  const quality=getSetting('quality')||'medium';
  if(current!==index || currentQuality!==quality){currentQuality=quality;buildWorld(index);}
  sky.position.copy(focus);
  const night=Math.max(0,-Math.sin(timeOfDay*Math.PI*2));
  renderer.toneMappingExposure=1.06;
  skyMat.uniforms.uSun.value.copy(sunLight.position).normalize();
  skyMat.uniforms.uNight.value=night;
  sunMesh.visible=false;
  sunLight.color.lerp(new THREE.Color(landStyle(index).light),.65);
  sunLight.intensity*=1.45;
  sunLight.position.add(focus); sunLight.target.position.copy(focus); sunLight.target.updateMatrixWorld();
  scene.fog.density=.0065+night*.004;
  if(lightMotes){lightMotes.position.set(focus.x,getTerrainHeight(focus.x,focus.z),focus.z);lightMotes.rotation.y=timeUniform.value*.025;}
  for(let i=0;i<lanterns.length;i++)lanterns[i].intensity=1.8+Math.sin(timeUniform.value*4+i)*.2;
  if(grass && Math.hypot(focus.x-BOSS_ARENA_POS.x,focus.z-BOSS_ARENA_POS.z)<BOSS_ARENA_R) grass.visible=quality!=='low'; else if(grass)grass.visible=true;
}
export function worldStats(){return {biome:current,obstacles:obstacles.length,grass:grass?.count||0,groups:worldRoot.children.length};}
