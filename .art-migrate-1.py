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

patch('js/main.js', 'ac664815d780e9b833bccbd077949e0a617e8effeee7bda02fbfb73bd75f4f87', [
    (0, 0, r'''import { createReviewBridge } from './art/review.js';
import { interfaceState, setupInterface, showJournal, closeJournal, updateMission, skillIcon } from './art/interface.js';
import { setBloomEnabled } from './postprocessing.js';
import { animateHero } from './art/animation.js';
import { updateWorld } from './world.js';
'''),
    (97, 0, r'''const initialPlayer = Object.fromEntries(Object.entries(player).map(([key,value]) => [key,
  value?.clone ? value.clone() : value && typeof value === 'object' ? structuredClone(value) : value]));
function resetSession(locationIndex = 0) {
  resetBoss(); removePortal(); clearEnemies(); clearSeeds(); clearNpcs(); clearCaravans();
  clearLoreItems(); clearProjectiles(); clearHazards(); clearLootDrops(); clearSkillEntities();
  clearCompanions(); clearDamageNumbers();
  bossState.bossDefeated = false; bossState.currentBossIndex = locationIndex;
  gameLocation = locationIndex + 1; lastTarget = lockTarget = null; lockActive = false;
  dialogueOpen = shopOpen = inventoryOpen = settingsOpen = false;
  player.attacking = player.dodging = player.blocking = player.parrying = false;
  player.attackCd = player.dodgeCd = player.invuln = player.dmgFlash = 0;
  player.vel.set(0, 0, 0); player._deathMusicStopped = false;
  playerMesh.rotation.set(0, 0, 0); playerMesh.scale.setScalar(1);
  closeJournal();
  spawnEnemies(locationIndex); spawnNpcs(); spawnCaravans(locationIndex); spawnLoreItems(locationIndex);
  setupArena(); applyBiome(locationIndex, worldRefs);
}

'''),
    (98, 0, r'''  for (const [key,value] of Object.entries(initialPlayer)) {
    if (value?.clone) player[key].copy(value);
    else player[key] = value && typeof value === 'object' ? structuredClone(value) : value;
  }
  resetSession(0);
'''),
    (101, 0, r'''  document.body.dataset.gameState = "playing";
'''),
    (111, 0, r'''  document.body.dataset.gameState = "playing";
'''),
    (118, 0, r'''    foundLore: Array.isArray(save.player.foundLore) ? save.player.foundLore : [],
    reputation: Number(save.player.reputation) || 0,
    ngPlus: Number(save.player.ngPlus) || 0,
'''),
    (123, 2, r'''  resetSession(Math.max(0, Math.min(5, Math.trunc(Number(save.gameLocation) || 1) - 1)));
  bossState.currentBossIndex = Math.max(0, Math.min(5, Math.trunc(Number(save.bossIndex) || 0)));
'''),
    (207, 0, r'''setupInterface({ player, location: () => gameLocation, bossState,
  save: () => saveGame(player, gameLocation, bossState.currentBossIndex),
  onMenu: () => {
    saveGame(player, gameLocation, bossState.currentBossIndex); settingsOpen = false; inventoryOpen = false; closeJournal();
    settingsPanel.style.display = 'none'; gameStarted = false; blocker.style.display = 'flex';
    document.exitPointerLock();
    if (btnContinue) btnContinue.style.display = 'block';
  },
  onQuality: () => {
    const quality = getSetting('quality');
    const ratio = quality === 'low' ? 1 : quality === 'high' ? 1.5 : 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
    const shadowSize = quality === 'low' ? 1024 : 2048;
    if (sunLight.shadow.mapSize.x !== shadowSize) {
      sunLight.shadow.mapSize.set(shadowSize, shadowSize);
      sunLight.shadow.map?.dispose(); sunLight.shadow.map = null;
    }
    getComposer()?.setPixelRatio(renderer.getPixelRatio());
    resizePostProcessing(window.innerWidth, window.innerHeight);
    setBloomEnabled(getSetting('bloomEnabled') && quality !== 'low');
  }
});
document.getElementById('set-bloom')?.addEventListener('change', e => {
  setSetting('bloomEnabled', e.target.checked);
  setBloomEnabled(e.target.checked && getSetting('quality') !== 'low');
});
const artReview = createReviewBridge({
  read: () => ({ state: document.body.dataset.gameState, location: gameLocation,
    position: player.pos.toArray(), hp: player.hp, stamina: player.stamina, grounded: player.grounded,
    animation: playerMesh.userData.animationState, enemies: enemies.length, boss: bossState.bossActive,
    art: playerMesh.userData.artVersion, quality: getSetting('quality') }),
  teleport: (x, z) => { player.pos.set(x, getTerrainHeight(x, z), z); player.vel.set(0, 0, 0); },
  refill: () => { player.hp = player.maxHp; player.stamina = player.maxStamina; },
  defeatPlayer: () => { player.hp = 0; player.alive = false; deathScreen.style.display = 'flex'; document.exitPointerLock(); },
  biome: index => {
    if (!Number.isInteger(index) || index < 0 || index > 5) throw new Error('Invalid biome');
    gameLocation = index + 1; bossState.currentBossIndex = index;
    resetBoss(); setupArena(); clearEnemies(); spawnEnemies(index);
    clearCaravans(); spawnCaravans(index); clearLoreItems(); spawnLoreItems(index);
    applyBiome(index, worldRefs); player.pos.set(0, getTerrainHeight(0, 0), 0);
    player.vel.set(0, 0, 0); player.hp = player.maxHp;
  },
});
document.querySelectorAll('.skill-slot').forEach((slot, i) => {
  slot.addEventListener('pointerdown', event => {
    if (!gameStarted || !player.alive) return;
    event.preventDefault(); event.stopPropagation();
    keysJustPressed[['KeyQ','KeyF','KeyC','Digit1','Digit2','Digit3','Digit4'][i]] = true;
  });
});
'''),
    (211, 0, r'''  renderer.info.reset();
  if (artReview.tick(dt)) { getComposer().render(); requestAnimationFrame(update); return; }
'''),
    (212, 0, r'''  if (keysJustPressed['KeyJ'] && gameStarted && player.alive) {
    if (interfaceState.journalOpen) closeJournal(); else showJournal(player, gameLocation, bossState);
  }
'''),
    (214, 1, r'''    if (interfaceState.journalOpen) { closeJournal();
    } else if (settingsOpen) {
'''),
    (247, 0, r'''  document.body.dataset.gameState = !gameStarted ? 'menu' : !player.alive ? 'dead' : settingsOpen || inventoryOpen || interfaceState.journalOpen ? 'paused' : 'playing';
  document.body.classList.toggle('ui-open', !gameStarted || settingsOpen || inventoryOpen || interfaceState.journalOpen || !player.alive);

'''),
    (249, 0, r'''  updateWorld(dt, player.pos, gameLocation - 1, getTimeOfDay());
'''),
    (255, 1, r'''  if (!gameStarted || !player.alive || settingsOpen || inventoryOpen || interfaceState.journalOpen) {
'''),
    (261, 1, r'''    playerMesh.position.copy(player.pos);
    animateHero(playerMesh, !gameStarted || !player.alive ? dt : 0, player, { menu: !gameStarted });
    if (!gameStarted) {
      playerMesh.rotation.set(0, .28, 0);
      camera.position.set(4.1, player.pos.y + 2.9, 6.8);
      camera.lookAt(-1.1, player.pos.y + 1.15, 0);
    }
    const pausedComposer = getComposer();
    if (pausedComposer) pausedComposer.render(); else renderer.render(scene, camera);
    for (const key in keysJustPressed) delete keysJustPressed[key];
'''),
    (270, 1, r'''    camState.yaw -= clampedDx * getSetting('sensitivity');
'''),
    (272, 1, r'''  camState.pitch = Math.max(0.05, Math.min(1.2, camState.pitch + clampedDy * getSetting('sensitivity')));
'''),
    (427, 1, r'''    const dist = Math.max(.001, Math.sqrt(dx * dx + dz * dz));
'''),
    (650, 1, r'''
'''),
    (763, 112, r'''  const visualYaw = player.dodging ? Math.atan2(player.dodgeDir.x, player.dodgeDir.z) : player.yaw + Math.PI;
  playerMesh.rotation.set(0, visualYaw, 0);
  animateHero(playerMesh, dt, player, { moving, sprinting, inWater,
    casting: ['KeyQ','KeyF','KeyC','Digit1','Digit2','Digit3','Digit4'].some(k => keysJustPressed[k]) });
  if (player.grounded && player._wasAirborne) { sfxLand(Math.min(1, Math.abs(player._prevVelY || 0) / 12)); }
  player._wasAirborne = !player.grounded;
'''),
    (876, 18, r''''''),
    (896, 2, r''''''),
    (899, 1, r'''  camTarget.y += 1.45;
'''),
    (906, 1, r'''  desiredPos.y += 1.45;
'''),
    (917, 0, r'''  const fovTarget = sprinting ? 64 : 58;
  camera.fov += (fovTarget - camera.fov) * (1 - Math.exp(-5 * dt));
  camera.updateProjectionMatrix();
'''),
    (935, 0, r'''  updateMission(player, gameLocation, bossState);
'''),
    (944, 1, r'''    if (icon && icon.dataset.unlocked !== String(sk.unlocked)) {
      icon.innerHTML = skillIcon(i, sk.unlocked); icon.dataset.unlocked = String(sk.unlocked);
    }
    slot.setAttribute('aria-disabled', String(!sk.unlocked));
'''),
    (953, 1, r'''    equipDisp.textContent = sw ? sw.name : '';
'''),
    (959, 0, r'''  for (const k in keysJustPressed) delete keysJustPressed[k];
'''),
    (998, 0, r'''  document.body.dataset.gameState = "playing";
'''),
    (1002, 0, r'''  gameStarted = false;
'''),
], '778464b901bf8fedf70e35cda49e667a9d7d1942132eb18b4aa671c07c6793bf')

patch('js/particles.js', '3efdaf145dea6a1946bbe0612fbaef428a102b67b25b12018e1294736dd5d136', [
    (2, 1, r''''''),
    (4, 19, r'''// Fixed pool: combat effects do not allocate a mesh/material per hit.
const MAX=640, particles=Array.from({length:MAX},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:0,scale:0,spin:0,color:new THREE.Color()}));
const geo=new THREE.OctahedronGeometry(.085,0);
const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:.2,emissive:0x251608});
const mesh=new THREE.InstancedMesh(geo,mat,MAX);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;mesh.name='seed-and-rind-particles';scene.add(mesh);
const transform=new THREE.Object3D(); let cursor=0;
export function spawnParticles(pos,color,count=8,speed=4){
  if(!pos||![pos.x,pos.y,pos.z].every(Number.isFinite))return;
  for(let i=0;i<Math.min(MAX,Math.max(0,count));i++){
    const p=particles[cursor];cursor=(cursor+1)%MAX;
    p.x=pos.x;p.y=pos.y;p.z=pos.z;
    p.vx=(Math.random()-.5)*speed;p.vy=(.3+Math.random()*.7)*speed;p.vz=(Math.random()-.5)*speed;
    p.life=.35+Math.random()*.5;p.age=0;p.scale=.5+Math.random();p.spin=Math.random()*6.283;p.color.set(color).lerp(new THREE.Color('#d6ba8b'),.28);
'''),
    (25, 13, r'''export function updateParticles(dt){
  let visible=0;
  for(const p of particles){
    if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
    p.vy-=11*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const t=p.age/p.life;
    transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.spin+t*4,t*3,p.spin);
    const size=p.scale*(1-t*t);transform.scale.set(size*.55,size*1.7,size);transform.updateMatrix();
    mesh.setMatrixAt(visible,transform.matrix);mesh.setColorAt(visible,p.color);visible++;
'''),
    (39, 0, r'''  mesh.count=visible;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
'''),
], 'e6141a0859d83ccc08f5337416d762eb59cd3539f8e64518616838af9ff149d2')
