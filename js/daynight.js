import * as THREE from 'three';

let timeOfDay = 0.25;
const cycleSpeed = 1 / 600;

const _dayColor = new THREE.Color(0xfff4e0);
const _nightColor = new THREE.Color(0x4466aa);
const _mixedColor = new THREE.Color();

function updateDayNight(dt, refs) {
  const { sunLight, ambientLight, hemiLight, scene, sunMesh, baseFogDensity } = refs;

  timeOfDay = (timeOfDay + cycleSpeed * dt) % 1.0;

  const sunAngle = timeOfDay * Math.PI * 2;

  const sunFactor = Math.max(0, Math.sin(sunAngle));
  const nightFactor = 1.0 - sunFactor;

  if (sunLight) {
    sunLight.intensity = 0.4 + 1.4 * sunFactor;

    _mixedColor.copy(_dayColor).lerp(_nightColor, nightFactor);
    sunLight.color.copy(_mixedColor);

    const radius = 120;
    const yMin = 20;
    const yMax = 120;
    const y = yMin + (yMax - yMin) * sunFactor;
    const xz = Math.cos(sunAngle);
    sunLight.position.set(
      Math.cos(sunAngle) * radius,
      y,
      Math.sin(sunAngle) * radius
    );
  }

  if (ambientLight) {
    ambientLight.intensity = 0.3 + 0.25 * sunFactor;
  }

  if (hemiLight) {
    hemiLight.intensity = 0.2 + 0.25 * sunFactor;
  }

  if (scene && scene.fog && baseFogDensity !== undefined) {
    const nightMult = 1.0 + 0.25 * nightFactor;
    scene.fog.density = baseFogDensity * nightMult;
  }

  if (sunMesh && sunLight) {
    const dir = sunLight.position.clone().normalize();
    sunMesh.position.copy(dir.multiplyScalar(240));
  }
}

function isNight() {
  return timeOfDay > 0.6 || timeOfDay < 0.1;
}

function getTimeOfDay() {
  return timeOfDay;
}

function setTimeOfDay(t) {
  timeOfDay = ((t % 1.0) + 1.0) % 1.0;
}

function getNightMultiplier() {
  let darkness = 0;

  if (timeOfDay >= 0.5) {
    const t = (timeOfDay - 0.5) * 2;
    darkness = Math.sin(t * Math.PI);
  } else if (timeOfDay < 0.1) {
    const t = 1.0 - timeOfDay / 0.1;
    darkness = t * Math.sin(0.5 * Math.PI);
  }

  return {
    hpMult: 1.0 + 0.5 * darkness,
    dmgMult: 1.0 + 0.2 * darkness,
    xpMult: 1.0 + 0.5 * darkness,
  };
}

export { updateDayNight, isNight, getTimeOfDay, getNightMultiplier, setTimeOfDay };
