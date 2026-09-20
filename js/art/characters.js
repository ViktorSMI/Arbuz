import * as THREE from 'three';
import { part, pivot, tube, link, leaf, ring } from './geometry.js';
import { material, glow } from './materials.js';
import { organicGeometry, seedGeometry, sculpt } from './sculpt.js';
import { ART_VERSION } from './palette.js';
import { cloneModelNode, modelAssetReady } from './model-assets.js';

const twoSided = { side: THREE.DoubleSide };
const unique = base => { const mat=base.clone(); mat.userData.sharedArtMaterial=false; return mat; };
const skin = () => unique(material('rind'));
function eyes(parent, y, z, x = .24, size = .075, tint = '#e5c77b') {
  for (const s of [-1, 1]) {
    part(parent, material('iron', '#465552'), [s*x, y, z], [size*2.1, size*.85, size*.55]);
    const eye = part(parent, glow(tint, .85), [s*x, y, z+.035], [size*1.35, size*.36, size*.45]);
    eye.rotation.z = s * -.12;
    eye.userData.openScale = eye.scale.y;
    const owner = parent.userData.rigRoot;
    if (owner) (owner.userData.eyes ||= []).push(eye);
  }
}
function banner(parent, mat, length, width) {
  const geo = new THREE.PlaneGeometry(width, length, 8, 10);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i), y=pos.getY(i), t=(length/2-y)/length;
    pos.setXYZ(i, x*(.62+t*.48), -t*length, -t*t*.35 + Math.sin(x*13)*.06*t);
    if (t>.98) pos.setY(i, -length + .11*(1+Math.sin(x*29)));
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat); mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData.clothRest = new Float32Array(pos.array);
  mesh.userData.clothLength = length;
  const owner = parent.userData.rigRoot;
  if (owner) (owner.userData.cloth ||= []).push(mesh);
  parent.add(mesh); return mesh;
}
function seedSword(hand, large = false, offset = [0,-.29,.03]) {
  const sword = pivot(hand, 'weapon', offset);
  const iron=material('iron'), gold=material('gold');
  link(sword, material('bark'), [0,-.14,0], [0,.2,0], .065);
  const guard=leaf(sword,gold,.42,.095,.04); guard.rotation.z=-Math.PI/2; guard.position.x=-.21; guard.position.y=.15;
  const blade=sculpt(sword, seedGeometry(large?1.65:1.12,.15,.055,.025), material('iron','#dce6d7')); blade.position.y=.2;
  const ridge=leaf(sword,material('gold','#d3d1b1',twoSided),large?1.55:1.02,.026,.03); ridge.position.set(0,.24,.055);
  part(sword,glow('#c4c98b',.3),[0,-.2,0],[.08,.13,.055]);
  sword.rotation.x=2.05;
  return sword;
}
function rootRig(kind) {
  const root=new THREE.Group(); root.name=`orchard-${kind}`;
  root.userData.artVersion=ART_VERSION; root.userData.kind=kind;
  root.userData.joints={};
  return root;
}
function joint(root,parent,name,pos) {
  const j=pivot(parent,name,pos); j.userData.rigRoot=root; root.userData.joints[name]=j; return j;
}
function assetNode(parent,key,name,materialOverride=null) {
  const object=cloneModelNode(key,name,{material:materialOverride});
  if(!object)return null;
  parent.add(object); return object;
}
function registerCloth(root,mesh,length) {
  if(!mesh?.geometry?.attributes?.position)return mesh;
  mesh.geometry=mesh.geometry.clone();
  mesh.geometry.userData.sharedModelAsset=false;
  mesh.userData.clothRest=new Float32Array(mesh.geometry.attributes.position.array);
  mesh.userData.clothLength=length;
  (root.userData.cloth ||= []).push(mesh);
  return mesh;
}
function createHeroAsset() {
  const root=rootRig('hero'), hip=joint(root,root,'hip',[0,1.17,0]);
  root.userData.modelAsset='hero_arbuzilla.glb';
  const body=assetNode(hip,'hero','body');
  root.userData.body=body;
  assetNode(hip,'hero','face_mask');
  for(const side of ['L','R']) {
    const eye=assetNode(hip,'hero',`eye_${side}`);
    if(eye){eye.userData.openScale=eye.scale.y;(root.userData.eyes ||= []).push(eye);}
  }
  for(const [s,side] of [[-1,'L'],[1,'R']]) {
    const arm=joint(root,hip,`arm${side}`,[s*.72,.10,0]);
    const plate=assetNode(arm,'hero','shoulder_plate'); if(plate)plate.rotation.z=-s*.24;
    assetNode(arm,'hero','upper_arm');
    const elbow=joint(root,arm,`elbow${side}`,[s*.055,-.32,0]);
    assetNode(elbow,'hero','forearm');
    const wrist=joint(root,elbow,`wrist${side}`,[0,-.32,.055]);
    assetNode(wrist,'hero','hand');
    const leg=joint(root,hip,`leg${side}`,[s*.29,-.5,0]);
    assetNode(leg,'hero','thigh');
    const knee=joint(root,leg,`knee${side}`,[s*.025,-.29,0]);
    assetNode(knee,'hero','shin');
    const ankle=joint(root,knee,`ankle${side}`,[0,-.24,.015]);
    const foot=assetNode(ankle,'hero','foot');
    root.userData[`shoe${side}`]=foot;
  }
  const stem=joint(root,hip,'stem',[0,.78,0]);
  assetNode(stem,'hero','stem');
  for(const s of [-1,1]) {
    const sprout=assetNode(stem,'hero','sprout');
    if(sprout){sprout.rotation.z=s*.92;sprout.rotation.y=s*.5;}
  }
  const cape=joint(root,hip,'cape',[0,.38,-.5]);
  registerCloth(root,assetNode(cape,'hero','cape'),1.25);
  const shield=assetNode(root.userData.joints.elbowL,'hero','shield');
  if(shield)shield.rotation.z=-.16;
  const sword=pivot(root.userData.joints.wristR,'weapon',[0,-.03,.03]);
  for(const name of ['sword_blade','sword_grip','sword_guard'])assetNode(sword,'hero',name);
  sword.rotation.x=2.05; root.userData.sword=sword;
  root.userData.armL=root.userData.joints.armL; root.userData.armR=root.userData.joints.armR;
  root.userData.legL=root.userData.joints.legL; root.userData.legR=root.userData.joints.legR;
  return root;
}

export function createHero() {
  return modelAssetReady('hero') ? createHeroAsset() : createHeroProcedural();
}

function createHeroProcedural() {
  const root=rootRig('hero'), vine=material('bark','#abb687'), bronze=material('gold'), cloth=material('cloth','#e0b8a4',twoSided);
  const hip=joint(root,root,'hip',[0,1.17,0]);
  const body=sculpt(hip,organicGeometry({lobes:10,depth:.018,taper:.055}),skin(),[0,0,0],[.73,.81,.66]);
  body.name='rind'; root.userData.body=body;
  // Carved seed-mask and a healed scar, rather than white toy eyeballs.
  eyes(hip,.22,.617,.23,.082);
  for (const s of [-1,1]) {
    tube(hip,bronze,[[s*.07,.32,.64],[s*.25,.37,.66],[s*.44,.28,.56]],.025);
  }
  tube(hip,material('bone','#c8b987'),[[.42,.25,.52],[.44,.05,.56],[.4,-.11,.56]],.015);
  part(hip,material('iron'),[0,-.19,.638],[.115,.16,.026]);
  part(hip,glow('#d5bb70',.35),[0,-.18,.669],[.047,.09,.017]);
  // Shoulder shells, vine joints, stitched wrist wraps.
  for (const [s,side] of [[-1,'L'],[1,'R']]) {
    const arm=joint(root,hip,`arm${side}`,[s*.72,.10,0]);
    // Overlapping lames cover the shoulder joint instead of floating beside it.
    for (let i=0;i<2;i++) {
      const plate=sculpt(arm,seedGeometry(.40-i*.05,.21,.11,.026),material('chitin','#cad2ad'));
      plate.position.set(s*(.045+i*.035),-.24-i*.13,.04+i*.025);
      plate.rotation.z=-s*.24;
      tube(arm,bronze,[[s*.02,-.19-i*.13,.16],[s*.19,-.14-i*.13,.16],[s*.23,-.01-i*.13,.09]],.012,6);
    }
    link(arm,vine,[0,0,0],[s*.055,-.32,0],.095,.075);
    const elbow=joint(root,arm,`elbow${side}`,[s*.055,-.32,0]);
    link(elbow,vine,[0,0,0],[0,-.29,.045],.085,.07);
    part(elbow,cloth,[0,-.19,.025],[.105,.1,.095]);
    const wrist=joint(root,elbow,`wrist${side}`,[0,-.32,.055]);
    part(wrist,material('bark','#b9aa89'),[0,0,0],[.1,.105,.1]);
    for (let f=0;f<3;f++) part(wrist,bronze,[(f-1)*.053,-.07,.058],[.023,.067,.028]);
    const leg=joint(root,hip,`leg${side}`,[s*.29,-.5,0]);
    link(leg,vine,[0,0,0],[s*.025,-.29,0],.12,.10);
    const knee=joint(root,leg,`knee${side}`,[s*.025,-.29,0]);
    link(knee,vine,[0,0,0],[0,-.24,.015],.105,.075);
    part(knee,bronze,[0,-.04,.08],[.12,.16,.06]);
    const ankle=joint(root,knee,`ankle${side}`,[0,-.24,.015]);
    const foot=part(ankle,material('bark','#c1b293'),[0,-.02,.12],[.17,.09,.27]);
    for(let wrap=0;wrap<3;wrap++) tube(ankle,cloth,[[-.14,-.025,.02+wrap*.065],[0,.065,.02+wrap*.065],[.14,-.025,.02+wrap*.065]],.018,6);
    root.userData[`shoe${side}`]=foot;
  }
  const stem=joint(root,hip,'stem',[0,.78,0]);
  tube(stem,vine,[[0,0,0],[.015,.18,-.015],[.16,.29,0],[.24,.21,.03]],.06);
  for (const s of [-1,1]) {
    const sprout=leaf(stem,material('leaf','#d0daa0',twoSided),.48,.16,.14);
    sprout.position.set(.06,.12,0); sprout.rotation.z=s*.92; sprout.rotation.y=s*.5;
  }
  const cape=joint(root,hip,'cape',[0,.38,-.5]);
  banner(cape,cloth,1.2,1.25);
  // Worn strap follows the body instead of an equatorial ring.
  tube(hip,material('bark','#c7b9a0'),[[-.45,.59,.25],[-.23,.35,.62],[.09,0,.66],[.38,-.43,.40]],.045);
  const shield=sculpt(root.userData.joints.elbowL,seedGeometry(.70,.29,.12,.035),material('chitin','#bccb9d'));
  shield.position.set(-.10,-.52,.12); shield.rotation.z=-.16;
  const emblem=sculpt(root.userData.joints.elbowL,seedGeometry(.3,.05,.02,.008),bronze); emblem.position.set(-.1,-.36,.27);
  for(const sign of [-1,1]) tube(hip,cloth,[[sign*.08,.56,-.44],[sign*.32,.38,-.57],[sign*.50,.1,-.5]],.047,9);
  const pouch=part(hip,material('bark','#c1ad81'),[.54,-.39,-.34],[.15,.19,.10]);
  part(hip,bronze,[.54,-.35,-.435],[.046,.025,.012],'box');
  root.userData.sword=seedSword(root.userData.joints.wristR,false,[0,-.03,.03]);
  root.userData.armL=root.userData.joints.armL; root.userData.armR=root.userData.joints.armR;
  root.userData.legL=root.userData.joints.legL; root.userData.legR=root.userData.joints.legR;
  return root;
}

function insect(kind, boss = false) {
  const root=rootRig(kind), chitin=material('chitin',boss?'#bec389':'#c3cfb5'), dark=material('iron','#869288'), gold=material('gold');
  const hip=joint(root,root,'hip',[0,.58,0]);
  const body=modelAssetReady('enemy_insect')
    ? assetNode(hip,'enemy_insect','body',unique(chitin))
    : sculpt(hip,organicGeometry({lobes:8,depth:.04,rings:18,sides:28}),unique(chitin),[0,0,-.12],[.52,.38,.73]);
  root.userData.body=body; if(body)body.userData.modelAssetArchetype='enemy_insect.glb';
  const ant=kind==='ant', roach=kind==='roach', mantis=kind==='mantis';
  body.scale.set(ant?.26:.52,mantis?.24:.38,ant?.4:.73);
  if (ant) part(hip,chitin,[0,-.04,-.78],[.34,.32,.44]);
  if (roach) body.scale.set(.45,.2,.87);
  const head=joint(root,hip,'head',[0,.07,.63]);
  part(head,dark,[0,0,0],[mantis?.36:.28,.23,.29]); eyes(head,.06,.252,.15,.053,boss?'#f1ac6f':'#d6cf85');
  for (const s of [-1,1]) {
    tube(head,dark,[[s*.16,.17,.08],[s*.31,.42,.30],[s*.4,.47,.65]],.018);
    tube(head,gold,[[s*.15,-.05,.18],[s*.29,-.09,.40],[s*.13,-.03,.53]],.04);
  }
  // The authored GLB carries a closed shell; the procedural fallback keeps articulated elytra.
  if (!ant && !mantis && modelAssetReady('enemy_insect')) {
    const shell=assetNode(hip,'enemy_insect','shell',chitin); if(shell)shell.userData.modelAssetArchetype='enemy_insect.glb';
  } else if (!ant && !mantis) for (const [s,side] of [[-1,'L'],[1,'R']]) {
    const wing=joint(root,hip,`shell${side}`,[s*.05,.17,-.13]);
    const plate=sculpt(wing,organicGeometry({lobes:7,depth:.05,rings:16,sides:28}),chitin,[s*.23,.07,0],[.29,roach?.17:.28,.68]);
    plate.rotation.z=s*-.18;
    for(let rib=0;rib<4;rib++) tube(wing,dark,[[s*.15,.26,-.42+rib*.23],[s*.28,.32,-.40+rib*.23],[s*.40,.20,-.37+rib*.23]],.009,5);
    tube(wing,gold,[[s*.24,.1,-.58],[s*.47,.1,-.2],[s*.41,.12,.3],[s*.12,.13,.62]],.018);
  }
  for (let i=0;i<3;i++) for (const [s,side] of [[-1,'L'],[1,'R']]) {
    const leg=joint(root,hip,`leg${side}${i}`,[s*.37,-.02,(i-1)*.39]);
    link(leg,dark,[0,0,0],[s*.38,.08,(i-1)*.18],.055,.04);
    const knee=joint(root,leg,`knee${side}${i}`,[s*.38,.08,(i-1)*.18]);
    link(knee,dark,[0,0,0],[s*.23,-.58,.09],.04,.012);
  }
  if (mantis) {
    hip.position.y=.98;
    body.rotation.x=.7;
    for (const [s,side] of [[-1,'L'],[1,'R']]) {
      const claw=joint(root,head,`arm${side}`,[s*.32,-.04,.05]);
      link(claw,chitin,[0,0,0],[s*.18,-.12,.48],.065,.045);
      const sickle=leaf(claw,material('bone','#d5deaa',twoSided),.8,.13,.30);
      sickle.position.set(s*.18,-.12,.48); sickle.rotation.x=1.7;
    }
  }
  if (boss) {
    const horn=leaf(head,gold,1.12,.20,-.30); horn.position.set(0,.12,.22); horn.rotation.x=-.25;
    for(const s of [-1,1]) tube(head,gold,[[s*.19,.11,.28],[s*.4,.6,.45],[s*.16,.82,.63]],.09);
    for (let i=0;i<3;i++) part(hip,gold,[0,.39,-.54+i*.32],[.1,.08,.08],'stone');
    root.scale.setScalar(3.7);
  }
  return root;
}
function flyer(kind, boss = false) {
  const root=rootRig(kind), bird=kind==='bird'||kind==='crow', firefly=kind==='firefly';
  const bodyMat=material(bird?'feather':'chitin',bird?'#a9b9ba':'#c7ba81',bird?twoSided:{});
  const hip=joint(root,root,'hip',[0,.35,0]);
  const body=modelAssetReady('enemy_bird') && bird
    ? assetNode(hip,'enemy_bird','body',unique(bodyMat))
    : part(hip,unique(bodyMat),[0,0,0],[.3,.4,.55]);
  root.userData.body=body; if(body&&bird)body.userData.modelAssetArchetype='enemy_bird.glb';
  const head=joint(root,hip,'head',[0,.24,.40]);
  part(head,bodyMat,[0,0,0],[.23,.26,.26]); eyes(head,.045,.224,.12,.045);
  if (bird) {
    link(head,material('bone'),[0,-.01,.2],[0,-.09,.55],.11,.001);
    for(let i=0;i<4;i++) { const plume=leaf(hip,bodyMat,.52,.08,.08); plume.position.set((i-1.5)*.13,-.02,-.45); plume.rotation.x=-2.05; }
  } else {
    for(let i=0;i<3;i++) part(hip,i%2?material('iron'):material('gold'),[0,-.04,-.22-i*.16],[.26-i*.03,.27-i*.025,.1]);
    if(firefly) part(hip,glow('#c7de87',2),[0,-.035,-.44],[.245,.24,.22]);
    else link(hip,material('iron'),[0,-.08,-.52],[0,-.20,-.84],.07,.001);
  }
  for(const [s,side] of [[-1,'L'],[1,'R']]) {
    const wing=joint(root,hip,`wing${side}`,[s*.21,.17,-.04]);
    if (bird && modelAssetReady('enemy_bird')) {
      const authoredWing=assetNode(wing,'enemy_bird','wing',bodyMat);
      if(authoredWing){authoredWing.scale.x*=s;authoredWing.rotation.z=-s*1.15;}
    } else if (bird) for(let i=0;i<7;i++) {
      const feather=leaf(wing,bodyMat,.85-i*.055,.12,.14); feather.position.set(s*i*.09,-i*.03,-i*.075); feather.rotation.z=-s*(1.15+i*.07);
    } else {
      const membrane=material('bone','#e6e6c5',{...twoSided,transparent:true,opacity:.63,metalness:.1});
      for(let i=0;i<2;i++) { const panel=leaf(wing,membrane,.96-i*.18,.21,.08); panel.rotation.z=-s*1.2; panel.rotation.y=i*.6; panel.position.z=-i*.23; }
    }
    const leg=joint(root,hip,`leg${side}`,[s*.17,-.28,0]);
    link(leg,material('gold'),[0,0,0],[s*.03,-.31,.10],.027,.018);
    for(let f=0;f<3;f++) link(leg,material('gold'),[0,-.3,.08],[(f-1)*.06,-.33,.23],.02,.004);
  }
  if(boss) {
    part(hip,material('iron'),[0,.04,.30],[.38,.41,.29]);
    ring(head,material('gold'),.27,.03,[0,.22,0]).rotation.x=Math.PI/2;
    root.scale.setScalar(4.2);
  }
  return root;
}
function quadruped(kind, boss = false) {
  const root=rootRig(kind), fur=material('fur',kind==='cat'?'#c3a38b':'#b0acb3');
  const hip=joint(root,root,'hip',[0,.62,0]);
  const body=modelAssetReady('enemy_quadruped')
    ? assetNode(hip,'enemy_quadruped','body',unique(fur))
    : part(hip,unique(fur),[0,0,-.04],[.38,.37,.68]);
  root.userData.body=body; if(body)body.userData.modelAssetArchetype='enemy_quadruped.glb';
  const head=joint(root,hip,'head',[0,.14,.59]);
  part(head,fur,[0,0,0],[.28,.28,.3]);
  part(head,material('fur','#b8aaa6'),[0,-.095,.28],[.18,.14,kind==='cat'?.15:.29]);
  part(head,material('iron'),[0,-.07,kind==='cat'?.40:.52],[.066,.052,.051]);
  eyes(head,.065,.265,.16,.05,kind==='cat'?'#c4d69c':'#e0a888');
  for(const [s,side] of [[-1,'L'],[1,'R']]) {
    part(head,fur,[s*.20,.25,-.02],[.12,.23,.065],kind==='cat'?'cone':'round');
    for(let f=0;f<2;f++) {
      const leg=joint(root,hip,`leg${side}${f}`,[s*.29,-.15,f===0?.42:-.45]);
      part(leg,fur,[0,-.11,0],[.135,.22,.15]);
      const knee=joint(root,leg,`knee${side}${f}`,[0,-.25,.02]);
      link(knee,fur,[0,0,0],[0,-.16,.08],.08,.055);
      part(knee,material('bone','#b0a8a0'),[0,-.19,.13],[.1,.055,.16]);
    }
  }
  const tail=joint(root,hip,'tail',[0,.02,-.63]);
  tube(tail,kind==='cat'?fur:material('cloth','#bdaca0'),[[0,0,0],[.13,.08,-.32],[.33,.25,-.60],[.44,.45,-.73]],kind==='cat'?.08:.045);
  for(const side of [-1,1]) for(let w=0;w<3;w++) link(head,material('bone','#c5bdae'),[side*.13,-.07,.30],[side*(.36+w*.04),-.02+w*.07,.30+w*.035],.006,.002);
  if(kind==='rat') {
    for(let i=0;i<3;i++) part(hip,material('chitin','#b6c38c'),[.27,.25-i*.08,-.36+i*.18],[.12,.16,.14],'stone');
  }
  if(boss) {
    const cape=joint(root,hip,'cape',[0,.33,-.10]); banner(cape,material('cloth','#c3add0',twoSided),.9,1.2);
    ring(head,material('gold'),.26,.05,[0,.30,0]).rotation.x=Math.PI/2;
    for(let i=0;i<5;i++) { const a=i/5*Math.PI*2; part(head,material('iron'),[Math.cos(a)*.24,.46,Math.sin(a)*.24],[.036,.27,.036],'cone'); }
    root.scale.setScalar(4.5);
  }
  return root;
}
function humanoid(kind, boss = false) {
  const root=rootRig(kind), iron=material('iron'), fabric=material('cloth',kind==='chef'?'#e6d7b8':'#96a5a0');
  const hip=joint(root,root,'hip',[0,1.18,0]);
  const body=modelAssetReady('enemy_humanoid')
    ? assetNode(hip,'enemy_humanoid','torso',unique(fabric))
    : part(hip,unique(fabric),[0,0,0],[.35,.48,.24]);
  root.userData.body=body; if(body)body.userData.modelAssetArchetype='enemy_humanoid.glb';
  const head=joint(root,hip,'head',[0,.64,0]);
  part(head,material('bone','#c7c1aa'),[0,0,0],[.20,.25,.18]); eyes(head,.035,.172,.10,.033);
  if(kind==='chef') {
    part(head,material('cloth','#f0e6c9'),[0,.32,0],[.24,.25,.21]);
    for(let i=0;i<3;i++) part(head,material('cloth','#f0e6c9'),[(i-1)*.14,.5,0],[.13,.12,.20]);
    const apron=banner(hip,material('cloth','#d4c7a9',twoSided),.8,.56); apron.position.set(0,.13,.27);
  } else {
    part(head,iron,[0,.19,-.015],[.24,.14,.24]);
    part(hip,iron,[0,.08,.2],[.30,.30,.09],'box');
  }
  for(const [s,side] of [[-1,'L'],[1,'R']]) {
    const arm=joint(root,hip,`arm${side}`,[s*.36,.30,0]);
    link(arm,fabric,[0,0,0],[0,-.36,0],.115,.08);
    const elbow=joint(root,arm,`elbow${side}`,[0,-.36,0]);
    link(elbow,fabric,[0,0,0],[0,-.3,0],.09,.07);
    part(elbow,material('bone','#c7c1aa'),[0,-.32,0],[.085,.105,.07]);
    const leg=joint(root,hip,`leg${side}`,[s*.18,-.38,0]);
    link(leg,fabric,[0,0,0],[0,-.34,0],.13,.095);
    const knee=joint(root,leg,`knee${side}`,[0,-.34,0]);
    link(knee,iron,[0,0,0],[0,-.3,.025],.10,.08);
    part(knee,iron,[0,-.34,.10],[.13,.095,.22]);
  }
  if(kind==='janitor') {
    const hand=root.userData.joints.elbowR;
    link(hand,material('bark'),[0,-.24,0],[0,-1.15,.7],.034,.025);
    part(hand,material('leaf','#c6b894'),[0,-1.1,.7],[.32,.20,.08],'box');
  } else {
    const weapon=seedSword(root.userData.joints.elbowR,true);
    if(kind==='chef') part(weapon,iron,[.14,.8,0],[.4,.8,.055],'box');
  }
  if(boss) {
    root.scale.setScalar(2.55);
    for(const s of [-1,1]) part(hip,iron,[s*.40,.24,0],[.20,.26,.23]);
  }
  return root;
}
function worm() {
  const root=rootRig('worm'); let parent=root;
  for(let i=0;i<7;i++) {
    const segment=joint(root,parent,`segment${i}`,[0,i===0?2.6:-.55,i===0?0:-.6]);
    const body=part(segment,unique(material('chitin','#b9ba7d')),[0,0,0],[1.3-i*.095,.95-i*.05,1.0-i*.065]);
    if(i===0) { root.userData.body=body; ring(segment,material('cloth','#d0987a'),.70,.18,[0,.05,.92]);
      for(let t=0;t<10;t++) { const a=t/10*Math.PI*2; link(segment,material('bone'),[Math.cos(a)*.62,Math.sin(a)*.62,1.0],[Math.cos(a)*.32,Math.sin(a)*.32,1.12],.1,.012); }
    }
    for(const s of [-1,1]) link(segment,material('bone'),[s*(1.1-i*.08),0,0],[s*(1.4-i*.10),-.3,.1],.12,.01);
    parent=segment;
  }
  return root;
}

export function createCreature(type) {
  const name=typeof type==='string'?type:type.name;
  const factories={
    'Жук-солдат':()=>insect('beetle'), 'Муравей':()=>insect('ant'), 'Таракан':()=>insect('roach'),
    'Богомол':()=>insect('mantis'), 'Оса':()=>flyer('wasp'), 'Светлячок':()=>flyer('firefly'),
    'Голубь-бомбер':()=>flyer('bird'), 'Крыса-мутант':()=>quadruped('rat'), 'Кот':()=>quadruped('cat'),
    'Дворник':()=>humanoid('janitor'),
  };
  if(!factories[name]) throw new Error(`Нет модели для ${name}`);
  const rig=factories[name](); rig.userData.species=name; return rig;
}
export function createGuardian(index) {
  const factories=[()=>insect('beetle',true),()=>quadruped('rat',true),()=>flyer('crow',true),worm,()=>humanoid('soldier',true),()=>humanoid('chef',true)];
  const visual=factories[index]();
  // Simulation may squash/rotate the outer transform. Keep authored scale nested.
  const root=new THREE.Group(); root.add(visual); root.userData={...visual.userData, visual, guardianIndex:index};
  return root;
}
