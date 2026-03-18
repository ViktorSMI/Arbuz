let ctx = null;
let masterGain = null;

let exploreGain = null;
let bossGain = null;
let exploreInterval = null;
let bossInterval = null;
let exploreActive = false;
let bossActive = false;
let exploreBeat = 0;
let bossBeat = 0;
let fadeInterval = null;
let currentLocationIndex = 0;

const LOC_TRACKS = [
  { scale: [261.6, 293.7, 329.6, 392.0, 440.0], bpm: 280, bass: 'triangle', lead: 'sine', mood: 0.3 },
  { scale: [220.0, 261.6, 293.7, 329.6, 392.0], bpm: 300, bass: 'triangle', lead: 'sine', mood: 0.35 },
  { scale: [246.9, 277.2, 329.6, 370.0, 440.0], bpm: 260, bass: 'sawtooth', lead: 'triangle', mood: 0.4 },
  { scale: [233.1, 261.6, 311.1, 370.0, 415.3], bpm: 320, bass: 'sawtooth', lead: 'triangle', mood: 0.5 },
  { scale: [207.7, 246.9, 293.7, 349.2, 415.3], bpm: 340, bass: 'square', lead: 'sawtooth', mood: 0.55 },
  { scale: [196.0, 233.1, 277.2, 329.6, 392.0], bpm: 360, bass: 'square', lead: 'sawtooth', mood: 0.6 },
];

const BOSS_TRACKS = [
  { scale: [130.8, 155.6, 164.8, 196.0, 220.0, 261.6], bpm: 200, feel: 'heavy' },
  { scale: [138.6, 164.8, 185.0, 207.7, 246.9, 277.2], bpm: 190, feel: 'swarm' },
  { scale: [146.8, 174.6, 196.0, 233.1, 261.6, 311.1], bpm: 180, feel: 'aerial' },
  { scale: [123.5, 146.8, 164.8, 196.0, 220.0, 261.6], bpm: 170, feel: 'toxic' },
  { scale: [110.0, 130.8, 155.6, 185.0, 207.7, 246.9], bpm: 160, feel: 'military' },
  { scale: [103.8, 123.5, 146.8, 174.6, 207.7, 246.9], bpm: 150, feel: 'finale' },
];

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.18;
  masterGain.connect(ctx.destination);

  exploreGain = ctx.createGain();
  exploreGain.gain.value = 0;
  exploreGain.connect(masterGain);

  bossGain = ctx.createGain();
  bossGain.gain.value = 0;
  bossGain.connect(masterGain);
}

function playNote(dest, freq, duration, type, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.05);
}

function exploreTickFn() {
  if (!ctx || !exploreActive) return;
  const t = LOC_TRACKS[currentLocationIndex % LOC_TRACKS.length];
  const s = t.scale;
  exploreBeat++;

  if (exploreBeat % 8 === 0) {
    playNote(exploreGain, s[0] / 2, 1.2, t.bass, 0.35);
  }
  if (exploreBeat % 4 === 0) {
    playNote(exploreGain, s[Math.floor(Math.random() * 2)] / 2, 0.8, t.bass, 0.25);
  }
  if (exploreBeat % 2 === 0) {
    const note = s[Math.floor(Math.random() * s.length)];
    playNote(exploreGain, note, 0.6, t.lead, 0.2 * t.mood);
  }
  if (Math.random() < 0.25) {
    const note = s[Math.floor(Math.random() * s.length)] * 2;
    playNote(exploreGain, note, 0.4, 'sine', 0.12);
  }
  if (Math.random() < 0.1) {
    const note = s[Math.floor(Math.random() * s.length)];
    playNote(exploreGain, note * 1.5, 1.5, 'sine', 0.08);
  }
}

function bossTickFn() {
  if (!ctx || !bossActive) return;
  const t = BOSS_TRACKS[currentLocationIndex % BOSS_TRACKS.length];
  const s = t.scale;
  bossBeat++;

  if (bossBeat % 4 === 0) {
    playNote(bossGain, s[0] / 2, 0.5, 'sawtooth', 0.5);
    playNote(bossGain, s[0] / 4, 0.3, 'square', 0.3);
  }
  if (bossBeat % 2 === 0) {
    playNote(bossGain, s[Math.floor(Math.random() * 3)] / 2, 0.4, 'sawtooth', 0.35);
  }

  const note = s[Math.floor(Math.random() * s.length)];
  playNote(bossGain, note, 0.25, 'square', 0.2);

  if (bossBeat % 3 === 0) {
    const high = s[Math.floor(Math.random() * s.length)] * 2;
    playNote(bossGain, high, 0.15, 'sawtooth', 0.25);
  }
  if (Math.random() < 0.3) {
    playNote(bossGain, s[Math.floor(Math.random() * s.length)] * 4, 0.1, 'sine', 0.15);
  }

  if (bossBeat % 8 === 0) {
    const noise = ctx.createOscillator();
    const ng = ctx.createGain();
    noise.type = 'square';
    noise.frequency.value = 60 + Math.random() * 40;
    ng.gain.setValueAtTime(0.15, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    noise.connect(ng);
    ng.connect(bossGain);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.15);
  }
}

function fadeTo(node, target, durationMs) {
  if (fadeInterval) clearInterval(fadeInterval);
  const startVal = node.gain.value;
  const diff = target - startVal;
  const steps = Math.max(1, Math.floor(durationMs / 30));
  let step = 0;
  fadeInterval = setInterval(() => {
    step++;
    const t = step / steps;
    const ease = t * t * (3 - 2 * t);
    node.gain.value = startVal + diff * ease;
    if (step >= steps) {
      node.gain.value = target;
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }, 30);
}

function startExploreLoop() {
  if (exploreInterval) return;
  exploreActive = true;
  exploreBeat = 0;
  const t = LOC_TRACKS[currentLocationIndex % LOC_TRACKS.length];
  exploreInterval = setInterval(exploreTickFn, t.bpm);
}

function stopExploreLoop() {
  exploreActive = false;
  if (exploreInterval) { clearInterval(exploreInterval); exploreInterval = null; }
}

function startBossLoop() {
  if (bossInterval) return;
  bossActive = true;
  bossBeat = 0;
  const t = BOSS_TRACKS[currentLocationIndex % BOSS_TRACKS.length];
  bossInterval = setInterval(bossTickFn, t.bpm);
}

function stopBossLoop() {
  bossActive = false;
  if (bossInterval) { clearInterval(bossInterval); bossInterval = null; }
}

export function startMusic(locationIndex) {
  initAudio();
  if (ctx.state === 'suspended') ctx.resume();
  currentLocationIndex = locationIndex;
  stopExploreLoop();
  stopBossLoop();
  startExploreLoop();
  exploreGain.gain.value = 1;
  bossGain.gain.value = 0;
}

export function switchToBossMusic() {
  initAudio();
  if (!bossActive) {
    startBossLoop();
  }
  fadeTo(exploreGain, 0, 1500);
  fadeTo(bossGain, 1, 1500);
}

export function switchToExploreMusic() {
  initAudio();
  if (!exploreActive) {
    startExploreLoop();
  }
  fadeTo(bossGain, 0, 2000);
  fadeTo(exploreGain, 1, 2000);
}

export function stopMusic() {
  stopExploreLoop();
  stopBossLoop();
  if (exploreGain) exploreGain.gain.value = 0;
  if (bossGain) bossGain.gain.value = 0;
}

export function setMusicVolume(v) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}
