from pathlib import Path

GENERATOR = Path('tools/generate_models.py')
TESTS = Path('tests/model-assets.test.mjs')

source = GENERATOR.read_text(encoding='utf-8')
old = "    rgb = trimesh.visual.color.hex_to_rgba(color)\n"
new = "    rgb = trimesh.visual.color.hex_to_rgba(color) / 255.0\n"
assert source.count(old) == 1, 'unexpected GLB material colour source'
source = source.replace(old, new, 1)
GENERATOR.write_text(source, encoding='utf-8')

tests = TESTS.read_text(encoding='utf-8')
marker = "test('GLB PBR colours remain normalized and distinct'"
if marker not in tests:
    tests += r'''

test('GLB PBR colours remain normalized and distinct', () => {
  const colours = [];
  for (const file of Object.keys(required)) {
    const { json } = parseGlb(`assets/models/${file}`);
    for (const entry of json.materials || []) {
      const colour = entry.pbrMetallicRoughness?.baseColorFactor;
      if (!colour) continue;
      assert(colour.every(value => Number.isFinite(value) && value >= 0 && value <= 1), `${file} has invalid PBR colour`);
      colours.push(colour.map(value => value.toFixed(3)).join(','));
    }
  }
  assert(new Set(colours).size >= 14, 'authored palette collapsed during GLB export');
  const hero = parseGlb('assets/models/hero_arbuzilla.glb').json;
  const rind = hero.materials.find(entry => entry.name === 'rind')?.pbrMetallicRoughness?.baseColorFactor;
  assert(rind && rind[1] > rind[0] && rind[1] > rind[2], 'hero rind lost its green material');
  assert(rind.slice(0, 3).some(value => value < .8), 'hero rind was clamped to white');
});
'''
    TESTS.write_text(tests, encoding='utf-8')

print('Normalized authored GLB PBR colours and added regression coverage')
