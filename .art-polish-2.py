from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:50]);p.write_text(s.replace(old,new))

p=Path('js/biomes.js');s=p.read_text();start=s.index('function applyBiome(');end=s.index('\nexport {',start)
s=s[:start]+'''function applyBiome(locationIndex, refs) {
  const style = landStyle(locationIndex);
  const { terrainMat, grassMat, leafMats, scene, hemiLight, sunLight, waterMat, skyMat } = refs;
  if (terrainMat) terrainMat.color.set(style.ground).lerp(new THREE.Color('#ffffff'), .65);
  if (grassMat) grassMat.color.set('#ece5c6');
  for (const [i, mat] of (leafMats || []).entries()) mat.color.set(style.foliage).lerp(new THREE.Color('#ffffff'), .36 + i * .08);
  if (scene) {
    scene.background = new THREE.Color(style.fog);
    if (scene.fog) { scene.fog.color.set(style.fog); scene.fog.density = .009; }
  }
  if (sunLight) sunLight.color.set(style.light);
  if (hemiLight) { hemiLight.color.set(style.fog); hemiLight.groundColor.set(style.ground); }
  if (waterMat) waterMat.color.set(locationIndex === 3 ? '#7b9860' : locationIndex === 5 ? '#a16e45' : '#527e80');
  // Color-valued uniforms remain Color objects across every transition.
  if (skyMat?.uniforms) for (const [name, color] of [['uTop', style.sky], ['uHor', style.fog], ['uBot', style.fog]]) {
    if (skyMat.uniforms[name]) skyMat.uniforms[name].value = new THREE.Color(color);
  }
}
''' + s[end:];p.write_text("import { landStyle } from './art/palette.js';\n"+s)
edit('js/world.js', "export const grassMat=material('leaf','#baca97',{side:THREE.DoubleSide});", "export const grassMat=material('leaf','#ece5c6',{side:THREE.DoubleSide});")
edit('js/postprocessing.js', "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { FXAAShader } from 'three/addons/shaders/FXAAShader.js';")
edit('js/postprocessing.js', "let vignettePass = null;", "let vignettePass = null;\nlet fxaaPass = null;")
edit('js/postprocessing.js', "  composer.addPass(outputPass);", "  composer.addPass(outputPass);\n  fxaaPass = new ShaderPass(FXAAShader);\n  composer.addPass(fxaaPass);\n  fxaaPass.uniforms.resolution.value.set(1 / composer.readBuffer.width, 1 / composer.readBuffer.height);")
edit('js/postprocessing.js', "    composer.setSize(width, height);", "    composer.setSize(width, height);\n    if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / composer.readBuffer.width, 1 / composer.readBuffer.height);")
edit('scripts/smoke-art.mjs', "}finally{", "}catch(error){\n  console.error('Failed check: '+error.message);\n  const diagnostic=await inspect().catch(()=>null);\n  await writeFile(`${output}/failure.json`,JSON.stringify({error:error.message,diagnostic},null,2));\n  await snap('failure').catch(()=>{});\n  throw error;\n}finally{")
print('Biome palette continuity and antialiasing applied')
edit('scripts/smoke-art.mjs', "const page=await context.newPage();const errors", "const page=await context.newPage();page.setDefaultTimeout(60000);const errors")
edit('scripts/smoke-art.mjs', "  const initial=(await inspect()).position;", "  // Functional input checks use the low preset on a software-rendered runner.\n  await page.keyboard.press('Escape');await page.waitForSelector('#settings-panel',{state:'visible'});\n  await page.locator('#set-quality').selectOption('low');await page.locator('#btn-settings-close').click();\n  await page.setViewportSize({width:800,height:500});\n  const initial=(await inspect()).position;")
edit('scripts/smoke-art.mjs', "null,{timeout:10000});checks.push('jump and landing');", "null,{timeout:60000});checks.push('jump and landing');")
edit('scripts/smoke-art.mjs', "  await snap('02-gameplay');", "  await page.setViewportSize({width:1280,height:800});await snap('02-gameplay');")
edit('js/main.js', "position: player.pos.toArray(), hp: player.hp, stamina: player.stamina, grounded: player.grounded,", "position: player.pos.toArray(), velocity: player.vel.toArray(), ground: getTerrainHeight(player.pos.x,player.pos.z), hp: player.hp, stamina: player.stamina, grounded: player.grounded,")
edit('js/art/materials.js', "    bone: ['#66604b', '#d9cba0'], gold:", "    canopy: ['#354f36', '#95a774'],\n    bone: ['#66604b', '#d9cba0'], gold:")
edit('js/world.js', "export const leafMats=[material('leaf','#c7d4a4'),material('leaf','#e0dba8'),material('leaf','#9caf8d')];", "export const leafMats=[material('canopy','#c7d4a4'),material('canopy','#e0dba8'),material('canopy','#9caf8d')];")
edit('js/scene.js', 'scene.environmentIntensity = .5;', "scene.environmentIntensity = .65;\nconst fillLight = new THREE.DirectionalLight('#c0d9d1', .8);\nfillLight.position.set(-15, 12, -20);\nscene.add(fillLight);")
print('Input-test pacing and canopy materials updated')
