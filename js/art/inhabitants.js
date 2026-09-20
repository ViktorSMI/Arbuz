import * as THREE from 'three';
import { material, glow } from './materials.js';
import { organicGeometry, seedGeometry, branchGeometry, sculpt } from './sculpt.js';
import { part, pivot, leaf, link, tube, ring, collectStatic } from './geometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART_VERSION } from './palette.js';
import { cloneModelNode, modelAssetReady, modelNodes } from './model-assets.js';

export const RESIDENT_NAMES=Object.freeze(['Мудрый Кактус','Старый Тыквос','Грибочек','Морковка-ведунья','Баклажан-торговец']);
const twoSided={side:THREE.DoubleSide};
function eyes(parent,y,z,x=.19,body=null) {
  const meshes=[],ray=new THREE.Raycaster();
  if(body)body.updateWorldMatrix(true,false);
  for(const side of [-1,1]) {
    let surfaceZ=z;
    if(body) {
      const origin=parent.localToWorld(new THREE.Vector3(side*x,y,3));
      const direction=new THREE.Vector3(0,0,-1).transformDirection(parent.matrixWorld);
      ray.set(origin,direction);
      const hit=ray.intersectObject(body,false)[0];
      if(hit)surfaceZ=parent.worldToLocal(hit.point.clone()).z+.018;
    }
    meshes.push(part(parent,material('iron'),[side*x,y,surfaceZ],[.095,.05,.035]));
    part(parent,glow('#d9c193',.3),[side*x,y,surfaceZ+.025],[.046,.021,.022]);
  }
  return meshes;
}
function staff(parent) {
  sculpt(parent,branchGeometry([[0,0,0],[.03,.7,.05],[-.07,1.4,0],[.04,2.05,.04],[.26,2.13,.04]],.045,.023,15,7),material('bark','#cec1a5'));
  for(let i=0;i<3;i++) ring(parent,material('cloth'),.048,.015,[0,.70+i*.07,.025]).rotation.x=Math.PI/2;
  sculpt(parent,seedGeometry(.28,.085,.03,.02),glow('#dac38a',.5),[.18,1.92,.08]);
}
function capGeometry() {
  const points=[];
  // A real mushroom profile: curled lip, domed cap and recessed underside.
  for(const [r,y] of [[0,.45],[.12,.44],[.30,.40],[.53,.29],[.75,.12],[.84,.015],[.79,-.045],[.57,-.03],[.34,.05],[.08,.1],[0,.1]]) points.push(new THREE.Vector2(r,y));
  const geometry=new THREE.LatheGeometry(points,40), top=[], underside=[];
  const indices=geometry.index.array, quads=points.length-1;
  for(let q=0;q<40*quads;q++) {
    const target=q%quads<6?top:underside;
    for(let k=0;k<6;k++)target.push(indices[q*6+k]);
  }
  geometry.setIndex([...top,...underside]);geometry.clearGroups();
  geometry.addGroup(0,top.length,0);geometry.addGroup(top.length,underside.length,1);
  return geometry;
}

export function createResident(name) {
  const index=RESIDENT_NAMES.indexOf(typeof name==='string'?name:name.name);
  if(index<0)throw new Error('Unknown orchard resident');
  const root=new THREE.Group();root.name=`resident-${index}`;
  root.userData.artVersion=ART_VERSION;root.userData.residentIndex=index;
  const hip=pivot(root,'resident-hip',[0,.79,0]);root.userData.hip=hip;
  const keys=['resident_cactus','resident_pumpkin','resident_mushroom','resident_carrot','resident_eggplant'];
  const assetKey=keys[index], authored=modelAssetReady(assetKey);
  const mats=['cactus','pumpkin','bone','carrot','aubergine'];
  const skin=material(mats[index]).clone();skin.userData.sharedArtMaterial=false;
  const size=[[.37,.87,.34],[.67,.60,.58],[.24,.63,.24],[.34,.79,.32],[.49,.79,.42]][index];
  const body=authored
    ? cloneModelNode(assetKey,'body')
    : sculpt(hip,organicGeometry({lobes:index===1?10:8,depth:index===1?.11:index===0?.06:.015,taper:index===3?-.48:index===4?.24:0,bend:index===4?.12:0}),skin);
  if(authored){hip.add(body);root.userData.modelAsset=`${assetKey}.glb`;}
  root.userData.body=body;
  if(!authored){body.scale.fromArray(size);body.position.y=index===0?.36:index===1?.17:.29;}
  const bronze=material('gold'),cloth=material('cloth',index===3?'#c3a6cd':'#d2baa3',twoSided);
  if(authored) {
    root.userData.eyes=[];
    for(const side of ['L','R']) {
      const eye=cloneModelNode(assetKey,`eye_${side}`); if(eye){hip.add(eye);root.userData.eyes.push(eye);}
    }
  } else {
    const eyeY=index===0?.65:index===1?.3:.53,eyeZ=size[2]*.91;
    root.userData.eyes=eyes(hip,eyeY,eyeZ,index===0||index===2?.14:.19,body);
  }
  for(const [s,side] of [[-1,'L'],[1,'R']]) {
    const arm=pivot(hip,`resident-arm${side}`,[s*(size[0]*.82),.24,0]);
    root.userData[`arm${side}`]=arm;
    if(authored) {
      const modelArm=cloneModelNode(assetKey,'arm'); if(modelArm){modelArm.scale.x*=s;arm.add(modelArm);}
    } else if(index===0) {
      sculpt(arm,branchGeometry([[0,0,0],[s*.30,.02,0],[s*.38,.24,0],[s*.36,.60,0]],.13,.08,12,8),skin);
      part(arm,skin,[s*.36,.60,0],[.083,.10,.083]);
    } else {
      sculpt(arm,branchGeometry([[0,0,0],[s*.18,-.16,.04],[s*.25,-.28,.14]],.058,.042,8,7),material('bark','#bead8a'));
      part(arm,cloth,[s*.19,-.20,.07],[.085,.08,.068]);
      part(arm,bronze,[s*.25,-.29,.14],[.071,.067,.065]);
    }
    const leg=pivot(hip,`resident-leg${side}`,[s*(index===2?.14:.18),-.18,0]);root.userData[`leg${side}`]=leg;
    if(authored) {
      const modelLeg=cloneModelNode(assetKey,'leg'); if(modelLeg)leg.add(modelLeg);
    } else {
      link(leg,material('bark'),[0,0,0],[0,-.51,0],.09,.065);
      part(leg,material('bark','#c6b28c'),[0,-.55,.1],[.14,.075,.23]);
    }
  }
  if(authored) {
    const skip=new Set(['body','eye_L','eye_R','arm','leg']);
    for(const node of modelNodes(assetKey)) if(!skip.has(node)) {
      const extra=cloneModelNode(assetKey,node); if(extra)hip.add(extra);
    }
  } else if(index===0) {
    const needles=new THREE.Group();
    for(let row=0;row<6;row++)for(let j=0;j<8;j++) {
      const a=j/8*Math.PI*2,y=-.20+row*.21;
      const r=.38*Math.sqrt(Math.max(.1,1-((y-.36)/.87)**2));
      link(needles,material('bone','#d9c9a1'),[Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(a)*(r+.07),y+.036,Math.sin(a)*(r+.07)],.008,.001);
    }
    hip.add(collectStatic(needles,mergeGeometries));
    for(let f=0;f<7;f++) {
      const petal=leaf(hip,material('cloth','#f6b7a5',twoSided),.23,.065,.06,4);
      petal.position.set(.05,1.19,0);petal.rotation.set(.55,f*Math.PI*2/7,0);
    }
  } else if(index===1) {
    sculpt(hip,branchGeometry([[0,.70,0],[.06,.88,.01],[.2,1.0,0],[.25,.91,0]],.10,.045,8,7),material('bark'));
    const collar=ring(hip,cloth,.49,.09,[0,.63,0]);collar.rotation.x=Math.PI/2;collar.scale.z=.8;
    part(hip,material('cloth','#ad9a7b'),[0,.23,-.51],[.36,.34,.15]);
    for(const s of [-1,1])tube(hip,bronze,[[s*.24,.57,-.45],[s*.29,.30,-.64],[s*.22,-.1,-.56]],.024,8);
    const stick=pivot(root,'walking-stick',[-.82,0,.22]);staff(stick);
  } else if(index===2) {
    sculpt(hip,capGeometry(),[material('mushroom'),material('bone','#f0e0bb')],[0,.98,0]);
    const gills=new THREE.Group();
    for(let f=0;f<22;f++) {
      const a=f/22*Math.PI*2;
      link(gills,material('bone','#d6c6a2'),[Math.cos(a)*.23,.98,Math.sin(a)*.23],[Math.cos(a)*.75,.94,Math.sin(a)*.75],.012,.006);
    }
    hip.add(collectStatic(gills,mergeGeometries));
    part(hip,cloth,[0,.37,-.24],[.32,.24,.11]);
  } else if(index===3) {
    for(let f=0;f<9;f++) {
      const sprout=leaf(hip,material('leaf','#cad4a0',twoSided),.5+(f%3)*.1,.075,.17,5);
      sprout.position.set(0,1.00,0);sprout.rotation.set(.1+f%2*.2,f*2.4,(f%3-1)*.5);
    }
    const collar=ring(hip,cloth,.25,.08,[0,.73,0]);collar.rotation.x=Math.PI/2;
    const mantle=sculpt(hip,seedGeometry(.82,.39,.08,.018),cloth,[0,-.34,-.29]);mantle.rotation.y=Math.PI;
    const stick=pivot(root,'herb-staff',[.72,0,.2]);staff(stick);
  } else {
    for(let f=0;f<6;f++) {
      const calyx=leaf(hip,material('leaf','#b4be8f',twoSided),.42,.14,.09,6);
      calyx.position.set(0,1.03,0);calyx.rotation.set(2.1,f*Math.PI/3,0);
    }
    sculpt(hip,branchGeometry([[0,.95,0],[.04,1.19,0],[.20,1.23,0]],.075,.027,7,7),material('bark'));
    part(hip,material('bark','#e0c39f'),[-.40,-.10,.30],[.28,.21,.12]);
    part(hip,bronze,[-.40,-.06,.427],[.05,.04,.016],'box');
    tube(hip,cloth,[[-.35,-.1,.36],[-.03,.44,.4],[.18,.86,.12]],.05,12);
    for(let f=0;f<3;f++)part(hip,glow('#abc790',.15),[-.51+f*.11,.14,.29],[.044,.07,.045]);
  }
  const marker=new THREE.Group();marker.position.y=2.65;
  sculpt(marker,seedGeometry(.24,.06,.02,.016),glow('#d9c789',.55));
  ring(marker,bronze,.19,.009,[0,.12,-.005]);root.add(marker);
  root.userData.questMarker=marker;root.userData.questMarkerHeight=2.65;
  return root;
}

export function animateResident(root, dt, npc, distance) {
  const t=npc.animT, moving=npc.hostile&&distance>2;
  root.userData.hip.rotation.z=Math.sin(t*1.7)*.012;
  root.userData.hip.position.y=.79 + Math.sin(t*2)*.013;
  const phase=moving?Math.sin(t*10)*.48:0;
  root.userData.legL.rotation.x=phase;root.userData.legR.rotation.x=-phase;
  root.userData.armL.rotation.x=-phase*.55;
  root.userData.armR.rotation.x=phase*.55+(distance<4&&!npc.hostile?Math.sin(t*2.5)*.09:0);
  const difference=Math.atan2(Math.sin(npc.facing-root.rotation.y),Math.cos(npc.facing-root.rotation.y));
  root.rotation.y+=difference*(1-Math.exp(-6*dt));
}
