import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const out='test-results/refinement';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1100,height:700},deviceScaleFactor:1,offline:true});
const page=await context.newPage();const errors=[],requests=[],frames=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:|^wss?:/.test(r.url()))requests.push(r.url());});
try {
  await page.goto(pathToFileURL(path.resolve('index3d.html')).href+'#art-review',{timeout:60000});
  await page.waitForSelector('#loading-screen',{state:'detached',timeout:60000});
  async function shot(name) {
    const pixels=await page.evaluate(()=>window.__arbuzReview.freezeFrame());
    await writeFile(`${out}/${name}.png`,Buffer.from(pixels.split(',')[1],'base64'));
    frames.push({name,render:await page.evaluate(()=>window.__arbuzReview.inspect().render)});
    await page.evaluate(()=>window.__arbuzReview.resumeFrame());console.log('Captured: '+name);
  }
  await shot('opening');
  for(const [kind,index,name] of [['hero',0,'hero'],['Жук-солдат',0,'beetle'],...Array.from({length:5},(_,i)=>['resident',i,`resident-${i+1}`])]) {
    await page.evaluate(([kind,index])=>window.__arbuzReview.show(kind,index),[kind,index]);
    await shot(name);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
} finally {
  await writeFile(`${out}/report.json`,JSON.stringify({mode:'file://; offline; full-resolution WebGL captures at 1100x700',frames,errors,requests},null,2));
  await browser.close();
}
