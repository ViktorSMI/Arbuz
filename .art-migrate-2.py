from pathlib import Path
import hashlib

def patch(name, base, edits, expected):
    path = Path(name)
    old = path.read_bytes()
    assert hashlib.sha256(old).hexdigest() == base, 'Unexpected base: ' + name
    lines = old.decode('utf-8').splitlines(keepends=True)
    for start, count, replacement in reversed(edits):
        lines[start:start + count] = replacement.splitlines(keepends=True)
    data = ''.join(lines).encode('utf-8')
    assert hashlib.sha256(data).hexdigest() == expected, 'Patch checksum: ' + name
    path.write_bytes(data)
    print('Updated', name)

patch('js/player.js', 'd7a187ea933bd7127aeb50638b2ce29551bc453f42bbfd32ba4661238240bcfe', [
    (3, 0, r'''import { createHero } from './art/characters.js';
'''),
    (4, 138, r'''export const createWatermelon = createHero;
'''),
], '2e75753499ad6d2e9400b94d0f873c96e98270ce1ff7f28d5775264cea0b72c2')

patch('js/save.js', '14b1d8ae6eca1d3693fa8c18488ec7e88b83ade13823c303096dba74439b7524', [
    (20, 0, r'''      reputation: player.reputation || 0,
      foundLore: [...(player.foundLore || [])],
      ngPlus: player.ngPlus || 0,
'''),
    (32, 0, r'''    return true;
'''),
    (33, 1, r'''    return false;
'''),
    (48, 1, r'''  try { return Boolean(loadGame()?.player); } catch { return false; }
'''),
    (52, 1, r'''  try { localStorage.removeItem(STORAGE_KEY); } catch {}
'''),
], '6914c6cd9369b3d3b4151c3bce414e3532e5a5faab5cff566b8c7264c40367ab')

patch('js/scene.js', '3659dd2aa08ef85f686f5503b2cc0a5f4d12805ce08b13e6e11351cb0a667954', [
    (1, 0, r'''import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
'''),
    (5, 1, r'''renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.info.autoReset = false;
'''),
    (9, 1, r'''renderer.toneMappingExposure = 1.14;
'''),
    (25, 4, r'''sunLight.shadow.camera.left = -45;
sunLight.shadow.camera.right = 45;
sunLight.shadow.camera.top = 45;
sunLight.shadow.camera.bottom = -45;
'''),
    (31, 1, r'''sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = .04;
'''),
    (36, 0, r'''// Local neutral environment gives metal and chitin readable reflections.
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(room, .04);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = .5;
room.dispose();
pmrem.dispose();
'''),
], 'a2ec7b712643239d5a9ab951fd9f7502fd2284cf2167350fb012be140f54fb5b')

patch('js/settings.js', '4b9801c7785bf2dc154f6830221f98a9fe53793f613ce222794948803949cf50', [
    (8, 0, r'''  quality: 'medium',
'''),
], 'a732c776b99b7c212cd946cc1288c4d4bff44d2c1aef06f472040a40f14d779e')

patch('js/terrain.js', '6d0a23a012a71a0bca3c2b5d6652b9520b3147b2e252b4f0256ea8e1f63d17cc', [
    (2, 0, r'''import { surface } from './art/materials.js';
'''),
    (36, 11, r'''export function pathDistance(x,z) {
  const centre=z*.88+Math.sin(z*.022)*10;
  return Math.abs(x-centre)/1.33;
'''),
    (48, 98, r'''const colors=new Float32Array(posAttr.count*3);
const c=new THREE.Color(), soil=new THREE.Color('#b2a182'), moss=new THREE.Color('#91a06c'), cliff=new THREE.Color('#b4b6aa');
for(let i=0;i<posAttr.count;i++) {
  const x=posAttr.getX(i),z=posAttr.getZ(i),y=posAttr.getY(i);
  const noise=.5+.25*Math.sin(x*.19+Math.cos(z*.11))+.15*Math.cos(z*.31);
  c.copy(soil).lerp(moss,Math.max(0,Math.min(1,(pathDistance(x,z)-1.6)/2))*noise);
  c.lerp(cliff,Math.max(0,(y-5)/16)); c.multiplyScalar(.86+noise*.20);
  c.toArray(colors,i*3);
'''),
    (147, 144, r'''terrainGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
const maps=surface('soil');
export const terrainMat=new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:1,normalScale:new THREE.Vector2(.38,.38),
  map:maps.map.clone(),normalMap:maps.normalMap.clone(),roughnessMap:maps.roughnessMap.clone(),
'''),
    (292, 3, r'''for(const tex of [terrainMat.map,terrainMat.normalMap,terrainMat.roughnessMap]){tex.repeat.set(85,85);tex.needsUpdate=true;}
const terrain=new THREE.Mesh(terrainGeo,terrainMat);terrain.name='orchard-terrain';terrain.receiveShadow=true;scene.add(terrain);
'''),
], '26ef5651a57c352fc378e2a8bddb58168b23092d271e79b2d95c736b8918695a')

patch('package.json', '0781334bd8bfa8fb3e8281df425c6c850e2b7417496b1d385f79bef9feeb4e65', [
    (12, 2, r'''    "check": "node scripts/check-sources.mjs",
    "smoke:local": "node scripts/smoke-local.mjs",
    "smoke:art": "node scripts/smoke-art.mjs"
'''),
], '79c6fd6ab2d3250289c911816724d9f57ea8c5e340c8897cb645575656d2c664')

patch('ui/game-hud.html', 'f891cc5af278a44b7dff0336d97111bf45e37f14b3f9c9f3e08df7203681eb9c', [
    (1, 2, r'''    <div id="hp-bar" class="bar-wrap"><div class="bar-fill"></div><div class="bar-label">ЗДОРОВЬЕ</div></div>
    <div id="stam-bar" class="bar-wrap"><div class="bar-fill"></div><div class="bar-label">ВЫНОСЛИВОСТЬ</div></div>
'''),
    (74, 3, r'''    <div id="lore-popup-title">📜 Камень памяти</div>
    <div id="lore-popup-text"></div>
    <div id="lore-popup-counter">Найдено: 0 / 18</div>
'''),
], '1229230527f86b81170bdb35ef360f83e45147d94ca3bf90d26dcd35699773d0')

patch('ui/game-menu.html', '79e4c18d7ae89085c54e0753bf16432a84a3a3f5a4779eae6f2b7c2c24047fab', [
    (7, 1, r'''          <button id="btn-play" class="menu-button primary" type="button">Начать путь</button>
'''),
    (11, 1, r'''        <details class="menu-foot"><summary>Управление</summary>WASD — движение · R — бег · Shift — уворот<br>ЛКМ — удар · ПКМ — блок · E — взаимодействие<br>J — журнал · Tab — инвентарь · Esc — пауза</details>
'''),
], 'b89eaf53e6b74d8d20c3bc1bd915b93ce817cb2096d74543c5538512e39b9738')

patch('ui/game-panels.html', '5099306da059601c5939c875db064adeb8282eaa728f2c20e1026e468ba8c39b', [
    (31, 0, r'''        <div class="form-row"><label for="set-quality">Графика</label><select id="set-quality"><option value="low">Низкая</option><option value="medium" selected>Средняя</option><option value="high">Высокая</option></select></div>
'''),
    (42, 1, r'''      <div id="save-status" class="menu-foot">Сохранение хранится в этом браузере</div>
'''),
], '826751c4718f52b273fe1aa3fd3f08811ae97ca11445a851bf84c0e8df2d19aa')
