import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';

function parseGlb(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', `${path} magic`);
  assert.equal(buffer.readUInt32LE(4), 2, `${path} version`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${path} byte length`);
  let offset = 12, json = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').trimEnd());
  }
  assert(json, `${path} JSON chunk`);
  return { buffer, json };
}

const required = {
  'hero_arbuzilla.glb': ['body','face_mask','eye_L','eye_R','shoulder_plate','upper_arm','forearm','hand','thigh','shin','foot','shield','sword_blade','cape'],
  'resident_cactus.glb': ['body','eye_L','eye_R','arm','leg'],
  'resident_pumpkin.glb': ['body','eye_L','eye_R','arm','leg','stem'],
  'resident_mushroom.glb': ['body','eye_L','eye_R','arm','leg','cap','gills'],
  'resident_carrot.glb': ['body','eye_L','eye_R','arm','leg','mantle'],
  'resident_eggplant.glb': ['body','eye_L','eye_R','arm','leg','stem','satchel'],
  'enemy_insect.glb': ['body','shell'],
  'enemy_quadruped.glb': ['body','head'],
  'enemy_bird.glb': ['body','wing'],
  'enemy_humanoid.glb': ['torso','head'],
  'prop_orchard_tree.glb': ['trunk','branch_0','leaf_0'],
  'prop_memory_arch.glb': ['pillar_L_0','arch_0','seal','memory_seed'],
  'prop_trellis.glb': ['post_L','bar_0','vine','leaf_0'],
  'prop_rock_cluster.glb': ['rock_0','moss_0'],
  'prop_seed_shrine.glb': ['base','altar','seed','halo'],
  'prop_fallen_log.glb': ['log','branch_0','moss_0'],
};

for (const [file, names] of Object.entries(required)) test(`${file} is a self-contained authored GLB`, () => {
  const { buffer, json } = parseGlb(`assets/models/${file}`);
  const nodes = new Set((json.nodes || []).map(node => node.name));
  for (const name of names) assert(nodes.has(name), `${file} missing ${name}`);
  assert((json.meshes || []).length >= names.length - 1);
  assert((json.materials || []).length > 0);
  assert.equal((json.images || []).length, 0, `${file} unexpectedly needs external images`);
  assert(buffer.length > 4_000 && buffer.length < 250_000, `${file} unreasonable size`);
});

test('model pack contains only checked-in local binaries', () => {
  const files = readdirSync('assets/models').filter(name => name.endsWith('.glb')).sort();
  assert.deepEqual(files, Object.keys(required).sort());
  const manifest = readFileSync('js/art/model-manifest.js','utf8');
  for (const file of files) assert(manifest.includes(file));
  assert(readFileSync('scripts/build-local.mjs','utf8').includes("'.glb': 'base64'"));
});

test('terrain uses warped noise, arena shaping and triplanar material projection', () => {
  const terrain = readFileSync('js/terrain.js','utf8');
  const landscape = readFileSync('js/art/landscape.js','utf8');
  for (const token of ['valueNoise','fbm','warpX','roadWeight','arenaDistance']) assert(terrain.includes(token));
  for (const token of ['sampleX','sampleY','sampleZ','vGroundNormal','orchard-terrain-3-triplanar']) assert(landscape.includes(token));
});
