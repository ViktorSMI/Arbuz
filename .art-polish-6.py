from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:80]);p.write_text(s.replace(old,new))

edit('scripts/smoke-art.mjs', "await page.waitForFunction(()=>window.__arbuzReview.read().hp>0);checks.push('death and respawn');", "await page.waitForFunction(()=>{const s=window.__arbuzReview.read();return s.hp>0&&s.state==='playing'&&s.animation!=='death';});checks.push('death and respawn');")
edit('scripts/smoke-art.mjs', "await page.evaluate(i=>window.__arbuzReview.biome(i),i);await page.waitForTimeout(650);", "await page.evaluate(i=>window.__arbuzReview.biome(i),i);\n    await page.waitForFunction(i=>window.__arbuzReview.inspect().world.biome===i,i);")
edit('scripts/smoke-art.mjs', "    assert(report.render.calls<9000);assert(report.render.triangles<3000000);", "    assert(report.render.calls>0&&report.render.calls<9000);assert(report.render.triangles>0&&report.render.triangles<3000000);")
edit('scripts/smoke-art.mjs', "  const mobile=await browser.newContext", "  await page.evaluate(()=>window.__arbuzReview.freezeFrame());\n  const mobile=await browser.newContext")
print('Wait for rendered respawn and biome state, rather than fixed wall-clock delays')
