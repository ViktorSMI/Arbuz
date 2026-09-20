import hero from '../../assets/models/hero_arbuzilla.glb';
import cactus from '../../assets/models/resident_cactus.glb';
import pumpkin from '../../assets/models/resident_pumpkin.glb';
import mushroom from '../../assets/models/resident_mushroom.glb';
import carrot from '../../assets/models/resident_carrot.glb';
import eggplant from '../../assets/models/resident_eggplant.glb';
import insect from '../../assets/models/enemy_insect.glb';
import quadruped from '../../assets/models/enemy_quadruped.glb';
import bird from '../../assets/models/enemy_bird.glb';
import humanoid from '../../assets/models/enemy_humanoid.glb';
import tree from '../../assets/models/prop_orchard_tree.glb';
import arch from '../../assets/models/prop_memory_arch.glb';
import trellis from '../../assets/models/prop_trellis.glb';
import rocks from '../../assets/models/prop_rock_cluster.glb';
import shrine from '../../assets/models/prop_seed_shrine.glb';
import log from '../../assets/models/prop_fallen_log.glb';
import { loadModelPack } from './model-assets.js';

const MODEL_PACK = Object.freeze({
  hero,
  resident_cactus: cactus,
  resident_pumpkin: pumpkin,
  resident_mushroom: mushroom,
  resident_carrot: carrot,
  resident_eggplant: eggplant,
  enemy_insect: insect,
  enemy_quadruped: quadruped,
  enemy_bird: bird,
  enemy_humanoid: humanoid,
  prop_orchard_tree: tree,
  prop_memory_arch: arch,
  prop_trellis: trellis,
  prop_rock_cluster: rocks,
  prop_seed_shrine: shrine,
  prop_fallen_log: log,
});

export const MODEL_PACK_VERSION = 'glb-pack-1';
export async function preloadGameModels() {
  return loadModelPack(MODEL_PACK);
}
