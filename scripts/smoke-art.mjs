import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const output='test-results/art';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:.5,offline:true});
const page=await context.newPage();page.setDefaultTimeout(60000);
const waitForFunction=page.waitForFunction.bind(page);
page.waitForFunction=(fn,arg,options={})=>waitForFunction(fn,arg,{...options,polling:200,timeout:60000});
const errors=[],external=[],checks=[],biomes=[];
const progress=()=>writeFileSync(`${output}/progress.json`,JSON.stringify({
  capture:'Actual WebGL canvas; DOM layout at 960x600; half-resolution software rendering',
  checks,biomes,errors,external
},null,2));
const deadline=setTimeout(()=>{
  errors.push('Software-rendered browser suite exceeded its eight-minute budget');
  progress();console.error(errors.at(-1));process.exit(1);
},8*60*1000);
deadline.unref();
const record=checks.push.bind(checks);
checks.push=(...items)=>{console.log('Passed: '+items.join('; '));const n=record(...items);progress();return n;};
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
const url=pathToFileURL(path.resolve('index3d.html')).href+'#art-review';
const snap=async name=>{
  console.log('Screenshot: '+name);
  // Read actual rendered WebGL pixels in the same task as render(), before
  // the drawing buffer is discarded. DOM behavior is checked independently.
  const pixels=await page.evaluate(()=>window.__arbuzReview.freezeFrame());
  try {
    assert(pixels.startsWith('data:image/png;base64,'));
    await writeFile(`${output}/${name}.png`,Buffer.from(pixels.split(',')[1],'base64'));
  }
  finally { await page.evaluate(()=>window.__arbuzReview?.resumeFrame()); }
};
const inspect=()=>page.evaluate(()=>window.__arbuzReview.inspect());
const ready=async()=>{await page.waitForSelector('#btn-play',{state:'visible',timeout:30000});await page.waitForSelector('#loading-screen',{state:'detached',timeout:30000});};
try{
  // Exercise the actual relative link before opening instrumentation.
  await page.goto(pathToFileURL(path.resolve('index.html')).href,{timeout:30000});
  await page.locator('a[href="index3d.html"]').first().click();await ready();checks.push('launcher link opens the local game');
  await page.goto('about:blank');
  await page.goto(url,{timeout:30000});await ready();await page.waitForFunction(()=>Boolean(window.__arbuzReview));await snap('01-menu');
  assert.equal((await inspect()).art,'orchard-2');checks.push('offline boot and hero');
  await page.locator('#btn-play').click();await page.waitForFunction(()=>document.body.dataset.gameState==='playing');
  // Functional input checks use the low preset on a software-rendered runner.
  await page.keyboard.press('Escape');await page.waitForSelector('#settings-panel',{state:'visible'});
  await page.locator('#set-quality').selectOption('low');await page.locator('#btn-settings-close').click();

  const initial=(await inspect()).position;
  await page.keyboard.down('w');await page.waitForFunction(([x,z])=>{const p=window.__arbuzReview.read().position;return Math.hypot(p[0]-x,p[2]-z)>.5;},[initial[0],initial[2]],{timeout:10000});
  await page.keyboard.up('w');checks.push('WASD movement');
  await page.keyboard.down('Space');await page.waitForFunction(()=>!window.__arbuzReview.read().grounded);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__arbuzReview.read().grounded,null,{timeout:60000});checks.push('jump and landing');
  await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__arbuzReview.read().animation==='dodge');await page.keyboard.up('Shift');checks.push('dodge animation');
  await page.waitForTimeout(600);
  await page.mouse.down({button:'left'});await page.waitForFunction(()=>window.__arbuzReview.read().animation.startsWith('attack'));await page.mouse.up({button:'left'});checks.push('attack animation');
  await page.waitForTimeout(700);await page.mouse.down({button:'right'});await page.waitForFunction(()=>['block','parry'].includes(window.__arbuzReview.read().animation));await page.mouse.up({button:'right'});checks.push('block and parry pose');
  await snap('02-gameplay');
  await page.keyboard.press('Tab');await page.waitForSelector('#inventory-panel',{state:'visible'});await page.keyboard.press('Tab');checks.push('inventory');
  await page.keyboard.press('j');await page.waitForSelector('#quest-panel',{state:'visible'});await page.keyboard.press('j');checks.push('journal');
  await page.keyboard.press('Escape');await page.waitForSelector('#settings-panel',{state:'visible'});
  await page.locator('#set-quality').selectOption('low');await page.waitForFunction(()=>window.__arbuzReview.read().quality==='low');
  await page.locator('#btn-save-now').click();assert((await page.locator('#save-status').textContent()).includes('Сохранено'));
  await page.locator('#set-quality').selectOption('medium');
  await page.waitForFunction(()=>window.__arbuzReview.read().quality==='medium');
  // Continue the interaction/transition sweep on the shipped low preset.
  // The opening frame uses medium; the test does not claim high-preset FPS.
  await page.locator('#set-quality').selectOption('low');
  await page.locator('#btn-settings-close').click();checks.push('quality settings and save');
  await page.evaluate(()=>window.__arbuzReview.defeatPlayer());await page.waitForSelector('#btn-respawn',{state:'visible'});await page.locator('#btn-respawn').click();await page.waitForFunction(()=>{const s=window.__arbuzReview.read();return s.hp>0&&s.state==='playing'&&s.animation!=='death';});checks.push('death and respawn');
  for(let i=0;i<6;i++){
    await page.evaluate(i=>window.__arbuzReview.biome(i),i);
    await page.waitForFunction(i=>window.__arbuzReview.inspect().world.biome===i,i);
    const report=await inspect();assert.equal(report.world.biome,i);assert(report.world.grass>1000);
    assert(report.render.calls>0&&report.render.calls<9000);assert(report.render.triangles>0&&report.render.triangles<3000000);
    biomes.push(report);progress();await snap(`land-${i+1}`);
  }
  checks.push('six biome transitions with bounded draw/triangle counts');
  for(const [kind,index,file] of [['hero',0,'hero'],['Жук-солдат',0,'beetle'],['Крыса-мутант',0,'rat'],['Голубь-бомбер',0,'bird'],...Array.from({length:6},(_,i)=>['guardian',i,`guardian-${i+1}`])]){
    const data=await page.evaluate(([kind,index])=>window.__arbuzReview.show(kind,index),[kind,index]);assert(data.joints.length>0);
    await page.waitForTimeout(180);await snap(file);
  }
  await page.evaluate(()=>window.__arbuzReview.close());checks.push('hero, enemy and guardian rendering');
  assert.equal(external.length,0,'Local play attempted network requests');
  assert.deepEqual(errors,[],'Browser or shader errors');
  await page.reload();await ready();await page.locator('#btn-continue').click();await page.waitForFunction(()=>document.body.dataset.gameState==='playing');checks.push('continue after reload');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>window.__arbuzReview.freezeFrame());
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:.5,offline:true});
  const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));
  await m.goto(url);await m.waitForSelector('#loading-screen',{state:'detached',timeout:30000});
  await m.locator('#btn-play').tap();await m.waitForSelector('#touch-attack',{state:'visible'});
  const mobilePixels=await m.evaluate(()=>window.__arbuzReview.freezeFrame());
  await writeFile(`${output}/mobile.png`,Buffer.from(mobilePixels.split(',')[1],'base64'));assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('mobile launch and controls');
  assert.deepEqual(errors,[]);await mobile.close();
  console.log('Art smoke checks passed: '+checks.join('; '));
}catch(error){
  console.error('Failed check: '+error.message);
  const diagnostic=await inspect().catch(()=>null);
  await writeFile(`${output}/failure.json`,JSON.stringify({error:error.message,diagnostic},null,2));
  await snap('failure').catch(()=>{});
  throw error;
}finally{
  clearTimeout(deadline);progress();
  await writeFile(`${output}/report.json`,JSON.stringify({capture:'Actual WebGL canvas; DOM behavior and layout verified separately',checks,biomes,errors,external},null,2));
  await browser.close();
}
