from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:80]);p.write_text(s.replace(old,new))

edit('js/main.js', '    renderer.getContext().finish();\n  },', "    renderer.getContext().finish();\n    return renderer.domElement.toDataURL('image/png');\n  },")
edit('scripts/smoke-art.mjs', 'const cdp=await context.newCDPSession(page);\n', '')
edit('scripts/smoke-art.mjs', "  await page.evaluate(()=>window.__arbuzReview?.freezeFrame());\n  try {\n    const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});\n    await writeFile(`${output}/${name}.png`,Buffer.from(result.data,'base64'));\n  }", """  // Read actual rendered WebGL pixels in the same task as render(), before
  // the drawing buffer is discarded. DOM behavior is checked independently.
  const pixels=await page.evaluate(()=>window.__arbuzReview.freezeFrame());
  try {
    assert(pixels.startsWith('data:image/png;base64,'));
    await writeFile(`${output}/${name}.png`,Buffer.from(pixels.split(',')[1],'base64'));
  }""")
edit('scripts/smoke-art.mjs', "  await m.evaluate(()=>window.__arbuzReview.freezeFrame());\n  const mobileCdp=await mobile.newCDPSession(m);\n  const mobileShot=await mobileCdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});\n  await writeFile(`${output}/mobile.png`,Buffer.from(mobileShot.data,'base64'));", "  const mobilePixels=await m.evaluate(()=>window.__arbuzReview.freezeFrame());\n  await writeFile(`${output}/mobile.png`,Buffer.from(mobilePixels.split(',')[1],'base64'));")
edit('scripts/smoke-art.mjs', 'JSON.stringify({checks,biomes,errors,external},null,2)', "JSON.stringify({capture:'Actual WebGL canvas; DOM behavior and layout verified separately',checks,biomes,errors,external},null,2)")
print('Read actual WebGL frames without depending on the headless compositor')
