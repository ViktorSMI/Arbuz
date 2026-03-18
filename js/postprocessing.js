import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

let composer = null;
let bloomPass = null;
let vignettePass = null;

// --- Screen Shake ---
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;

export function triggerScreenShake(intensity, duration) {
  shakeIntensity = intensity;
  shakeDuration = duration;
  shakeTimer = duration;
}

export function getScreenShakeOffset() {
  if (shakeTimer <= 0) return { x: 0, y: 0 };
  shakeTimer -= 1 / 60; // approximate dt; will be called each frame
  const decay = shakeTimer / shakeDuration;
  const x = (Math.random() * 2 - 1) * shakeIntensity * decay;
  const y = (Math.random() * 2 - 1) * shakeIntensity * decay;
  if (shakeTimer <= 0) { shakeIntensity = 0; shakeTimer = 0; }
  return { x, y };
}

// --- Vignette Shader ---
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.4 },
    redTint: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float redTint;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      color.rgb *= 1.0 - intensity * dist * dist * 2.0;
      color.r += redTint * dist * dist * 2.0;
      gl_FragColor = color;
    }
  `,
};

// --- Low HP effect ---
let baseBloomStrength = 0.3;

export function setLowHpEffect(hpPercent) {
  if (!bloomPass || !vignettePass) return;
  if (hpPercent < 0.3) {
    const t = 1.0 - hpPercent / 0.3; // 0 at 30%, 1 at 0%
    bloomPass.strength = baseBloomStrength + t * 0.35;
    vignettePass.uniforms.redTint.value = t * 0.4;
    vignettePass.uniforms.intensity.value = 0.4 + t * 0.3;
  } else {
    bloomPass.strength = baseBloomStrength;
    vignettePass.uniforms.redTint.value = 0.0;
    vignettePass.uniforms.intensity.value = 0.4;
  }
}

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

  vignettePass = new ShaderPass(VignetteShader);
  composer.addPass(vignettePass);

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
    baseBloomStrength = strength;
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
