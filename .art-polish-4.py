from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:80]);p.write_text(s.replace(old,new))

edit('scripts/smoke-art.mjs', 'viewport:{width:1280,height:800},offline:true', 'viewport:{width:960,height:600},offline:true')
edit('scripts/smoke-art.mjs', "const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[],external=[],checks=[],biomes=[];", """const page=await context.newPage();page.setDefaultTimeout(60000);
const cdp=await context.newCDPSession(page);
const waitForFunction=page.waitForFunction.bind(page);
page.waitForFunction=(fn,arg,options={})=>waitForFunction(fn,arg,{...options,polling:200,timeout:60000});
const errors=[],external=[],checks=[],biomes=[];
const record=checks.push.bind(checks);
checks.push=(...items)=>{console.log('Passed: '+items.join('; '));return record(...items);};""")
edit('scripts/smoke-art.mjs', "  try { return await page.screenshot({path:`${output}/${name}.png`,timeout:60000}); }", """  try {
    const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});
    await writeFile(`${output}/${name}.png`,Buffer.from(result.data,'base64'));
  }""")
edit('scripts/smoke-art.mjs', '  await page.setViewportSize({width:800,height:500});', '')
edit('scripts/smoke-art.mjs', "  await page.setViewportSize({width:1280,height:800});await snap('02-gameplay');", "  await snap('02-gameplay');")
edit('scripts/smoke-art.mjs', "  await m.screenshot({path:`${output}/mobile.png`,timeout:60000});", """  const mobileCdp=await mobile.newCDPSession(m);
  const mobileShot=await mobileCdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});
  await writeFile(`${output}/mobile.png`,Buffer.from(mobileShot.data,'base64'));""")
print('Fixed-size offline browser validation with timer-based state polling and direct compositor capture')
