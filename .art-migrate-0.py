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

patch('.github/workflows/build-standalone.yml', 'bea101803003c0c04cedd2de4c3ad9631af98641f3ba090357c1b023ff1cfad8', [
    (48, 0, r'''      - name: Test rigs and animation states
        run: npm test

'''),
    (60, 0, r'''      - name: Test offline gameplay and art
        run: npm run smoke:art

'''),
    (61, 0, r'''        if: always()
'''),
    (64, 1, r'''          cp -R test-results/art /tmp/arbuz-review/ 2>/dev/null || true
'''),
    (67, 0, r'''        if: always()
'''),
], '572739c7f5c85e6aee3e84d52f84484e0eedbe1f43fd7968be6c325632e4f36d')

patch('README.md', '8bf8ca1a1e81b536ac3adbab44ec8088ac4250cd2bdfde861ef5d08de7e74bd4', [
    (80, 0, r'''
## Визуальные исходники и проверки

Модели и материалы создаются локально в `js/art/`. Подробности — в `docs/ART_DIRECTION.md`. Это суставная процедурная геометрия и ключевые анимационные клипы, не внешние Blender/GLB-файлы.

```bash
npm test
npm run check
npm run build
npm run smoke:local
npm run smoke:art
```

Браузерные тесты используют Playwright Chromium (`npx playwright install chromium`). Они открывают HTML через `file://` и проверяют работу без сети. Снимки экранов и отчёт сохраняются в `test-results/art/`. Одиночная игра по-прежнему не требует этих инструментов.
'''),
], 'c33cbe3581f4451aa1b497c04aa1da5474cfc28e9617e0fb45d750afe39db132')

patch('css/game.css', 'a25c6cb033331d916f1aab27b0a8e6c53c8cb72091248b2a51d8621ff4cb5c44', [
    (2, 0, r'''
@import url('./art.css');
'''),
], '5aa077abbe91aa63aba231de3783e922c998dd2c9bf14389a0f2ee99761995cb')

patch('js/boss.js', 'aff13bb258602689932d3c4dd6548068413cc4dba0d7b2c1caa5656ab956a86d', [
    (0, 0, r'''import { createGuardian } from './art/characters.js';
import { animateCreature, releaseAnimator } from './art/animation.js';
import { disposeRig } from './art/geometry.js';
'''),
    (21, 225, r''''''),
    (247, 6, r'''  { name: 'ХРУЩ', emoji: '🪲', create: () => createGuardian(0), hp: 500, xpReward: 200, color: 0xc62828 },
  { name: 'ШАРЛОТТА', emoji: '🐀', create: () => createGuardian(1), hp: 700, xpReward: 350, color: 0x9e9e9e },
  { name: 'КАРЛУША', emoji: '🐦‍⬛', create: () => createGuardian(2), hp: 900, xpReward: 500, color: 0x212121 },
  { name: 'МУСОРНЫЙ ЧЕРВЬ', emoji: '🪱', create: () => createGuardian(3), hp: 1200, xpReward: 700, color: 0x558b2f },
  { name: 'ПОЛКОВНИК НОЖОВ', emoji: '🗡️', create: () => createGuardian(4), hp: 1500, xpReward: 900, color: 0x455a64 },
  { name: 'ЖАН-ПЬЕР ДЮВАЛЬ', emoji: '👨‍🍳', create: () => createGuardian(5), hp: 2000, xpReward: 1500, color: 0xfafafa },
'''),
    (348, 0, r'''  if (bossState.bossObj?.alive) animateCreature(bossState.bossObj.mesh, dt, bossState.bossObj);
'''),
    (701, 1, r'''    releaseAnimator(bossState.bossObj.mesh);
    disposeRig(bossState.bossObj.mesh);
'''),
], 'c5d236d33fbc7a35a17a1d334d29307fa8077c72cd92ff6459e265cb5607c66f')

patch('js/constants.js', '77bd2c852b7154505aad71ba6dd16e453630c9c189442d6374d9480fdc95643c', [
    (17, 1, r'''export const CAM_DIST = 7.5;
'''),
    (20, 1, r'''export const CAM_FOV = 58;
'''),
], 'febadff34ec90ff1125eda5ba40275169a8ef48ac0f2e6d87f7934e3c097ddf8')

patch('js/enemies.js', '7d17a7bfc9d970e13ce0219428caa42369399bff2a954eed7759105b433e4739', [
    (0, 0, r'''import { createCreature } from './art/characters.js';
import { animateCreature, releaseAnimator } from './art/animation.js';
import { disposeRig } from './art/geometry.js';
import { processIncomingDamage } from './combat.js';
'''),
    (67, 1094, r''''''),
    (1184, 1, r'''    const mesh = createCreature(type);
'''),
    (1205, 1, r'''    if (e.mesh) { releaseAnimator(e.mesh); disposeRig(e.mesh); }
'''),
    (1216, 3, r'''      animateCreature(e.mesh, dt, e);
'''),
    (1233, 1, r'''    const dist = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
'''),
    (1247, 1, r'''    if (e.stunTimer > 0) {
      e.windup = 0;
      e.mesh.position.set(e.x, e.y, e.z);
      animateCreature(e.mesh, dt, e);
      continue;
    }
    if (e.windup > 0) {
      e.windup = Math.max(0, e.windup - dt);
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.y = e.facing;
      if (e.windup === 0) {
        e.atkAnim = .3;
        sfxEnemyAttack();
        if (dist < e.type.r + 1.9 && player.invuln <= 0) {
          const damage = processIncomingDamage(e.type.dmg, e);
          player.hp = Math.max(0, player.hp - damage);
          if (damage > 0) {
            player.dmgFlash = .2; player.invuln = .18;
            sfxHit(); triggerScreenShake(.2, .15);
            spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xc98765, 6, 3);
          }
          if (player.hp <= 0) {
            player.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
          }
        }
      }
      animateCreature(e.mesh, dt, e);
      continue;
    }
'''),
    (1270, 20, r'''        e.windup = .32;
        e.atkCd = 1.35;
'''),
    (1322, 36, r'''    animateCreature(e.mesh, dt, e);
'''),
    (1372, 6, r'''
'''),
], '6e66c736495cbf2e7685b9830fc6eb4760ddbb61e40d6687b7ff0d211fb9a427')

patch('js/hud.js', '388ddfba3f31e3418c4dc6af4677229d4cfe050a8eb68ec5c9e0f1e4113bb4bb', [
    (32, 1, r'''  if (seedsEl) seedsEl.textContent = 'Семечки: ' + player.seeds;
'''),
    (36, 1, r'''    compassEl.textContent = 'Земля ' + gameLocation;
'''),
    (38, 1, r'''    compassEl.textContent = '' + def.name + ' — БОСС';
'''),
    (43, 1, r'''    compassEl.textContent = 'Логово ' + def.name + ' — ' + bDist + 'м';
'''),
    (48, 1, r'''    enemyNameEl.textContent = lastTarget.type?.name || def.name;
'''),
    (57, 1, r'''    bossNameEl.textContent = def.name + (b.phase === 2 ? ' — ЯРОСТЬ' : '');
'''),
    (66, 1, r'''  mctx.fillStyle = '#24342d';
'''),
    (72, 1, r'''  mctx.fillStyle = '#415345';
'''),
    (87, 1, r'''    mctx.fillStyle = '#c68c72';
'''),
    (96, 1, r'''    mctx.fillStyle = '#c68c72';
'''),
    (100, 1, r'''    mctx.strokeStyle = '#d4c59e'; mctx.lineWidth = 1;
'''),
    (119, 1, r'''    mctx.fillStyle = n.hostile ? '#ff9800' : '#d4c59e';
'''),
    (125, 1, r'''  mctx.fillStyle = '#dce0c5';
'''),
], '970078149a5f7f865deee5e0a1c6b675d37afe7de346058c288c683ed641c8b4')
