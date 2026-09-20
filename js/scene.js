import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAM_FOV } from './constants.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

export const camera = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 600);

export const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

export const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
sunLight.position.set(80, 120, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -45;
sunLight.shadow.camera.right = 45;
sunLight.shadow.camera.top = 45;
sunLight.shadow.camera.bottom = -45;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 300;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = .04;
scene.add(sunLight);

export const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
scene.add(hemiLight);
// Local neutral environment gives metal and chitin readable reflections.
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(room, .04);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = .65;
const fillLight = new THREE.DirectionalLight('#c0d9d1', .8);
fillLight.position.set(-15, 12, -20);
scene.add(fillLight);
room.dispose();
pmrem.dispose();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
