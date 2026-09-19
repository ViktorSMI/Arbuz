from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:80]);p.write_text(s.replace(old,new))

edit('scripts/smoke-art.mjs', "import { mkdir, writeFile } from 'node:fs/promises';", "import { mkdir, writeFile } from 'node:fs/promises';\nimport { writeFileSync } from 'node:fs';")
edit('scripts/smoke-art.mjs', 'viewport:{width:960,height:600},offline:true', 'viewport:{width:960,height:600},deviceScaleFactor:.5,offline:true')
edit('scripts/smoke-art.mjs', 'const record=checks.push.bind(checks);', """const progress=()=>writeFileSync(`${output}/progress.json`,JSON.stringify({
  capture:'Actual WebGL canvas; DOM layout at 960x600; half-resolution software rendering',
  checks,biomes,errors,external
},null,2));
const deadline=setTimeout(()=>{
  errors.push('Software-rendered browser suite exceeded its eight-minute budget');
  progress();console.error(errors.at(-1));process.exit(1);
},8*60*1000);
deadline.unref();
const record=checks.push.bind(checks);""")
edit('scripts/smoke-art.mjs', "checks.push=(...items)=>{console.log('Passed: '+items.join('; '));return record(...items);};", "checks.push=(...items)=>{console.log('Passed: '+items.join('; '));const n=record(...items);progress();return n;};")
edit('scripts/smoke-art.mjs', "  await page.locator('#set-quality').selectOption('medium');await page.locator('#btn-settings-close').click();checks.push('quality settings and save');", """  await page.locator('#set-quality').selectOption('medium');
  await page.waitForFunction(()=>window.__arbuzReview.read().quality==='medium');
  // Continue the interaction/transition sweep on the shipped low preset.
  // The opening frame uses medium; the test does not claim high-preset FPS.
  await page.locator('#set-quality').selectOption('low');
  await page.locator('#btn-settings-close').click();checks.push('quality settings and save');""")
edit('scripts/smoke-art.mjs', '    biomes.push(report);await snap', '    biomes.push(report);progress();await snap')
edit('scripts/smoke-art.mjs', 'hasTouch:true,deviceScaleFactor:1,offline:true', 'hasTouch:true,deviceScaleFactor:.5,offline:true')
edit('scripts/smoke-art.mjs', '}finally{\n  await writeFile', '}finally{\n  clearTimeout(deadline);progress();\n  await writeFile')
print('Bounded software-GPU suite: retain all behavioral assertions and save incremental evidence')
