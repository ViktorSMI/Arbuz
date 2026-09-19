from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:50]);p.write_text(s.replace(old,new))

p=Path('js/main.js');s=p.read_text();assert s.count('requestAnimationFrame(update);')==4;s=s.replace('requestAnimationFrame(update);','scheduledFrame = requestAnimationFrame(update);');p.write_text(s)
edit('js/main.js', 'const artReview = createReviewBridge({', '''let scheduledFrame = 0;
let frameFrozen = false;
const artReview = createReviewBridge({
  freezeFrame: () => {
    frameFrozen = true;
    cancelAnimationFrame(scheduledFrame);
    renderer.info.reset();
    getComposer().render();
    renderer.getContext().finish();
  },
  resumeFrame: () => {
    if (!frameFrozen) return;
    frameFrozen = false;
    clock.getDelta();
    scheduledFrame = requestAnimationFrame(update);
  },''')
edit('js/main.js', 'function update() {', 'function update() {\n  if (frameFrozen) return;')
edit('scripts/smoke-art.mjs', "const snap=async name=>{console.log('Screenshot: '+name);return page.screenshot({path:`${output}/${name}.png`,timeout:30000});};", '''const snap=async name=>{
  console.log('Screenshot: '+name);
  await page.evaluate(()=>window.__arbuzReview?.freezeFrame());
  try { return await page.screenshot({path:`${output}/${name}.png`,timeout:60000}); }
  finally { await page.evaluate(()=>window.__arbuzReview?.resumeFrame()); }
};''')
edit('scripts/smoke-art.mjs', "  await m.screenshot({path:`${output}/mobile.png`});", "  await m.evaluate(()=>window.__arbuzReview.freezeFrame());\n  await m.screenshot({path:`${output}/mobile.png`,timeout:60000});")
print('Deterministic render capture enabled only for the explicit art-review URL')
