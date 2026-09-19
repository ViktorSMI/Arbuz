import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const output='test-results/art';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
const page=await context.newPage();const errors=[],external=[],checks=[],biomes=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
const url=pathToFileURL(path.resolve('index3d.html')).href+'#art-review';
const snap=async name=>page.screenshot({path:`${output}/${name}.png`});
const inspect=()=>page.evaluate(()=>window.__arbuzReview.inspect());
const ready=async()=>{await page.waitForSelector('#btn-play',{state:'visible',timeout:30000});await page.waitForSelector('#loading-screen',{state:'detached',timeout:30000});};
try{
  // Exercise the actual relative link before opening instrumentation.
  await page.goto(pathToFileURL(path.resolve('index.html')).href,{timeout:30000});
  await page.locator('a[href="index3d.html"]').first().click();await ready();checks.push('launcher link opens the local game');
  await page.goto(url,{timeout:30000});await ready();await snap('01-menu');
  assert.equal((await inspect()).art,'orchard-1');checks.push('offline boot and hero');
  await page.locator('#btn-play').click();await page.waitForFunction(()=>document.body.dataset.gameState==='playing');
  const initial=(await inspect()).position;
  await page.keyboard.down('w');await page.waitForFunction(([x,z])=>{const p=window.__arbuzReview.read().position;return Math.hypot(p[0]-x,p[2]-z)>.5;},[initial[0],initial[2]],{timeout:10000});
  await page.keyboard.up('w');checks.push('WASD movement');
  await page.keyboard.down('Space');await page.waitForFunction(()=>!window.__arbuzReview.read().grounded);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__arbuzReview.read().grounded,null,{timeout:10000});checks.push('jump and landing');
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
  await page.locator('#set-quality').selectOption('medium');await page.locator('#btn-settings-close').click();checks.push('quality settings and save');
  await page.evaluate(()=>window.__arbuzReview.defeatPlayer());await page.waitForSelector('#btn-respawn',{state:'visible'});await page.locator('#btn-respawn').click();await page.waitForFunction(()=>window.__arbuzReview.read().hp>0);checks.push('death and respawn');
  for(let i=0;i<6;i++){
    await page.evaluate(i=>window.__arbuzReview.biome(i),i);await page.waitForTimeout(650);
    const report=await inspect();assert.equal(report.world.biome,i);assert(report.world.grass>1000);
    assert(report.render.calls<9000);assert(report.render.triangles<3000000);
    biomes.push(report);await snap(`land-${i+1}`);
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
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,offline:true});
  const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));
  await m.goto(url);await m.waitForSelector('#loading-screen',{state:'detached',timeout:30000});
  await m.locator('#btn-play').tap();await m.waitForSelector('#touch-attack',{state:'visible'});
  await m.screenshot({path:`${output}/mobile.png`});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('mobile launch and controls');
  assert.deepEqual(errors,[]);await mobile.close();
  console.log('Art smoke checks passed: '+checks.join('; '));
}finally{
  await writeFile(`${output}/report.json`,JSON.stringify({checks,biomes,errors,external},null,2));
  await browser.close();
}
