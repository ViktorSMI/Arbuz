import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer = null;
let bloomPass = null;

function initPostProcessing(renderer, scene, camera) {
  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const resolution = new THREE.Vector2(
    renderer.domElement.clientWidth,
    renderer.domElement.clientHeight
  );
  bloomPass = new UnrealBloomPass(resolution, 0.3, 0.4, 0.85);
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}

function resizePostProcessing(width, height) {
  if (composer) {
    composer.setSize(width, height);
  }
  if (bloomPass) {
    bloomPass.resolution.set(width, height);
  }
}

function setBloomIntensity(strength) {
  if (bloomPass) {
    bloomPass.strength = strength;
  }
}

function setBloomEnabled(enabled) {
  if (bloomPass) {
    bloomPass.enabled = enabled;
  }
}

function getComposer() {
  return composer;
}

export { initPostProcessing, resizePostProcessing, setBloomIntensity, setBloomEnabled, getComposer };
