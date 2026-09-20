import * as THREE from 'three';
import { clamp01 } from './palette.js';
import { secondaryMotion, groundHero } from './motion.js';

const controllers = new WeakMap();
const clipCache = new Map();
const LOOP = new Set(['idle','walk','run','air','fall','block','swim','windup']);
export const HERO_STATES = Object.freeze(['idle','walk','run','jump','air','fall','land','dodge','attack1','attack2','attack3','block','parry','hit','death','cast','swim']);

export function selectHeroState(p, movement = {}) {
  if (!p.alive) return 'death';
  if (p.dodging) return 'dodge';
  if (p.attacking) return `attack${Math.max(1, Math.min(3, p.comboCount || 1))}`;
  if (p.parrying) return 'parry';
  if (p.blocking) return 'block';
  if (p.dmgFlash > .06) return 'hit';
  if (movement.casting) return 'cast';
  if (movement.inWater) return 'swim';
  if (!p.grounded && !movement.menu) return p.vel.y > 2 ? 'jump' : p.vel.y < -2 ? 'fall' : 'air';
  return movement.moving ? movement.sprinting ? 'run' : 'walk' : 'idle';
}

function clipsFor(root) {
  const kind=root.userData.kind, joints=root.userData.joints;
  const key=kind+Object.keys(joints).join(',');
  if(clipCache.has(key)) return clipCache.get(key);
  const hero=kind==='hero', humanoid=hero||['janitor','soldier','chef'].includes(kind);
  const bird=['bird','crow','wasp','firefly'].includes(kind);
  const states=hero?HERO_STATES:['idle','walk','run','windup','attack1','hit','death'];
  const durations={idle:2.8,walk:.8,run:.48,jump:.3,air:.8,fall:.5,land:.18,dodge:.35,attack1:.25,attack2:.25,attack3:.25,block:1,parry:.15,hit:.18,death:.55,cast:.45,swim:1,windup:.32};
  const clips={};
  for(const state of states) {
    const duration=durations[state], tracks=[], steps=12;
    const times=Array.from({length:steps+1},(_,i)=>i/steps*duration);
    const values={};
    for(const name of Object.keys(joints)) for(const axis of ['x','y','z']) values[`${name}.rotation[${axis}]`]=[];
    // A single root bob moves attached equipment together; no shape deformation.
    const vertical=hero||humanoid||kind!=='worm' ? joints.hip?.position.y : undefined;
    if(vertical!==undefined) values['hip.position[y]']=[];
    for(let frame=0;frame<=steps;frame++) {
      const t=frame/steps, wave=Math.sin(t*Math.PI*2), pulse=Math.sin(t*Math.PI);
      const pose={}; const put=(name,axis,value)=>{pose[`${name}.rotation[${axis}]`]=value;};
      let bob=0;
      const move=['walk','run','swim'].includes(state), fast=state==='run';
      if(humanoid) {
        put('armL','z',.17); put('armR','z',-.15);
        put('elbowR','x',-.25); put('elbowL','x',-.12);
        if(move) {
          const amp=fast?.85:.48;
          for(const [s,side] of [[1,'L'],[-1,'R']]) {
            put(`leg${side}`,'x',wave*amp*s);
            put(`knee${side}`,'x',Math.max(0,-wave*s)*amp*.95);
            put(`arm${side}`,'x',-wave*amp*s*.58);
            put(`elbow${side}`,'x',-.25-Math.max(0,wave*s)*.22);
          }
          put('hip','x',fast?.14:.025); put('hip','y',wave*.075);
          bob=Math.abs(wave)*(fast?.055:.028);
        }
        if(['jump','air','fall'].includes(state)) {
          put('legL','x',-.4); put('legR','x',.32); put('kneeL','x',.85); put('kneeR','x',.6);
          put('armL','z',.75); put('armR','z',-.65); put('hip','x',state==='fall'?-.12:.1);
        }
        if(state==='land') { bob=-pulse*.14; put('legL','x',-.28*pulse); put('legR','x',-.28*pulse); put('kneeL','x',.6*pulse); put('kneeR','x',.6*pulse); }
        if(state==='dodge') { put('hip','x',Math.PI*2*t); bob=.12; put('legL','x',-1.5); put('legR','x',-1.5); put('kneeL','x',1.8); put('kneeR','x',1.8); put('armL','x',-1.7); put('armR','x',-1.7); }
        if(state.startsWith('attack')) {
          const n=Number(state.at(-1)), wind=t<.25?t/.25:1-(t-.25)/.75;
          const strike=Math.sin(clamp01((t-.18)/.72)*Math.PI);
          put('hip','y',(n===2?-1:1)*(.38*wind-.6*strike));
          put('hip','x',n===3?.3*strike:.04);
          put('armR','x',-1.65*wind+.6*strike); put('elbowR','x',-.6*wind);
          put('armR','z',-.2-(n===2?1.3:.35)*strike); put('armL','x',-.25*strike);
          put('legL','x',-.24*strike); put('kneeL','x',.2*strike);
        }
        if(['block','parry','windup'].includes(state)) { put('armR','x',-1.55); put('armR','z',.4); put('elbowR','x',-1.1); put('armL','x',-1.25); put('armL','z',-.2); put('hip','y',-.18); }
        if(state==='cast') { put('armL','x',-1.6*pulse); put('elbowL','x',-.7*pulse); put('hip','y',.15*pulse); }
      } else {
        if(move||state==='idle') {
          const active=move?1:.10;
          for(const name of Object.keys(joints)) {
            if(name.startsWith('leg')) {
              const side=name.includes('L')?1:-1, row=Number(name.at(-1))||0;
              const phase=t*Math.PI*2+row*Math.PI+ (side===1?0:Math.PI);
              put(name,'y',Math.sin(phase)*.32*active);
              put(name,'x',Math.sin(phase)*.40*active);
              put(name,'z',Math.max(0,Math.cos(phase))*.25*side*active);
              put(name.replace('leg','knee'),'x',Math.max(0,-Math.sin(phase))*.42*active);
            }
          }
          bob=move?Math.abs(wave)*.018:0;
        }
        if(state==='windup') { put('hip','x',-.22); bob=-.08*t; put('head','x',-.20); }
        if(state==='attack1') { put('hip','x',pulse*.32); put('head','x',pulse*.36); put('armL','x',-pulse*1.1); put('armR','x',-pulse*1.1); }
        if(bird) { const flap=Math.sin(t*Math.PI*2)*(kind==='crow'||kind==='bird'?.5:1.0); put('wingL','z',-.2+flap); put('wingR','z',.2-flap); bob+=wave*.06; }
        if(kind==='worm') for(let i=0;i<7;i++) { put(`segment${i}`,'y',Math.sin(t*Math.PI*2-i*.65)*.13); put(`segment${i}`,'z',Math.cos(t*Math.PI*2-i*.5)*.08); }
      }
      if(state==='idle') { bob+=Math.sin(t*Math.PI*2)*.012; put('head','y',wave*.05); }
      if(state==='hit') { put('hip','x',-pulse*.24); put('head','x',-pulse*.2); }
      if(state==='death') { put('hip','z',t*1.35); put('hip','x',t*-.3); bob=-t*(vertical||.5)*.7; if(kind==='worm') put('segment0','z',t*.8); }
      for(const name of Object.keys(values)) values[name].push(name==='hip.position[y]' ? vertical+bob : pose[name]||0);
    }
    for(const [name,data] of Object.entries(values)) tracks.push(new THREE.NumberKeyframeTrack(name,times,data));
    clips[state]=new THREE.AnimationClip(state,duration,tracks);
  }
  clipCache.set(key,clips); return clips;
}

export class RigAnimator {
  constructor(root) {
    this.root=root; this.mixer=new THREE.AnimationMixer(root); this.actions={}; this.state=''; this.elapsed=0; this.time=0; this.previousGrounded=true;
    for(const [name,clip] of Object.entries(clipsFor(root))) {
      const action=this.mixer.clipAction(clip);
      action.setLoop(LOOP.has(name)?THREE.LoopRepeat:THREE.LoopOnce,LOOP.has(name)?Infinity:1);
      action.clampWhenFinished=!LOOP.has(name);
      this.actions[name]=action;
    }

  }
  play(name) {
    if(!this.actions[name]) name='idle';
    if(name===this.state) return;
    const previous=this.actions[this.state];
    const next=this.actions[name];
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    if(previous) { previous.fadeOut(.085); next.fadeIn(.085); }
    this.state=name; this.elapsed=0;
  }
  update(dt,state,speed=1) {
    dt=Math.max(0,Math.min(.05,dt));
    this.play(state); this.elapsed+=dt; this.time+=dt;
    this.actions[this.state].setEffectiveTimeScale(speed);
    this.mixer.update(dt);
    const joints=this.root.userData.joints;
    secondaryMotion(this.root, dt, state, state==='run'?1.5:state==='walk'?.6:0, this.time);
    this.root.userData.animationState=this.state;
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); }
}
export function animatorFor(root) {
  if(!controllers.has(root)) controllers.set(root,new RigAnimator(root));
  return controllers.get(root);
}
export function animateHero(root,dt,p,movement={}) {
  const anim=animatorFor(root);
  let state=selectHeroState(p,movement);
  if(p.grounded&&!anim.previousGrounded&&p.alive&&!p.dodging) anim.landUntil=anim.time+.18;
  if((anim.landUntil||0)>anim.time && ['idle','walk','run'].includes(state)) state='land';
  anim.previousGrounded=p.grounded||movement.menu;
  const cadence = ['walk','run'].includes(state) ? (movement.sprinting ? 1.45 : 1.18) : 1;
  anim.update(dt,state,cadence);
  groundHero(root, dt, p, movement);
  root.userData.body.material.emissive.set('#cd5b3b');
  root.userData.body.material.emissiveIntensity=Math.max(0,p.dmgFlash||0)*2;
  if(root.userData.sword) root.userData.sword.visible=!p.dodging;
}
export function animateCreature(root,dt,e) {
  const visual=root.userData.visual||root;
  const state=!e.alive||e.dying?'death':e.windup>0||e.windupTimer>0?'windup':e.flashTimer>.07?'hit':e.atkAnim>0||e.swipeLunging?'attack1':e.charging||e.state==='chase'?'run':'walk';
  animatorFor(visual).update(dt,state,visual.userData.kind==='wasp'||visual.userData.kind==='firefly'?3:1);
  if(visual.userData.body) {
    visual.userData.body.material.emissive.set('#cd714e');
    visual.userData.body.material.emissiveIntensity=Math.max(0,e.flashTimer||0)*2.5;
  }
}
export function releaseAnimator(root) { const target=root.userData.visual||root; controllers.get(target)?.dispose(); controllers.delete(target); }
