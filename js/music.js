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

function playDrum(freq, dur, vol) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g); g.connect(bossGain);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.02);
}

function bossTickFn() {
  if (!ctx || !bossActive) return;
  const t = BOSS_TRACKS[currentLocationIndex % BOSS_TRACKS.length];
  const s = t.scale;
  bossBeat++;
  const feel = t.feel;

  if (feel === 'heavy') {
    if (bossBeat % 4 === 0) {
      playNote(bossGain, s[0] / 4, 0.6, 'sawtooth', 0.55);
      playDrum(50, 0.15, 0.4);
    }
    if (bossBeat % 2 === 0) {
      playNote(bossGain, s[Math.floor(Math.random() * 2)] / 2, 0.5, 'sawtooth', 0.4);
      playDrum(70 + Math.random() * 20, 0.1, 0.25);
    }
    if (bossBeat % 8 === 0) playNote(bossGain, s[0] / 8, 1.0, 'square', 0.3);
    if (Math.random() < 0.2) playNote(bossGain, s[Math.floor(Math.random() * 3)], 0.3, 'square', 0.18);
  } else if (feel === 'swarm') {
    if (bossBeat % 3 === 0) {
      playNote(bossGain, s[0] / 2, 0.3, 'sawtooth', 0.35);
    }
    const idx = bossBeat % s.length;
    playNote(bossGain, s[idx], 0.12, 'square', 0.22);
    if (bossBeat % 2 === 0) {
      playNote(bossGain, s[(idx + 2) % s.length] * 2, 0.08, 'sawtooth', 0.18);
    }
    if (Math.random() < 0.4) {
      playNote(bossGain, s[Math.floor(Math.random() * s.length)] * 2, 0.06, 'sine', 0.15);
    }
    if (bossBeat % 6 === 0) playDrum(90, 0.08, 0.2);
  } else if (feel === 'aerial') {
    if (bossBeat % 4 === 0) playNote(bossGain, s[0] / 2, 0.8, 'triangle', 0.3);
    const sweep = s[Math.floor(Math.random() * s.length)] * 2;
    playNote(bossGain, sweep, 0.4, 'sine', 0.25);
    if (bossBeat % 3 === 0) {
      playNote(bossGain, s[Math.floor(Math.random() * s.length)] * 4, 0.3, 'sine', 0.15);
    }
    if (bossBeat % 8 === 0) {
      playNote(bossGain, s[s.length - 1] * 4, 0.6, 'triangle', 0.2);
    }
    if (Math.random() < 0.15) playDrum(60, 0.12, 0.15);
  } else if (feel === 'toxic') {
    if (bossBeat % 4 === 0) {
      playNote(bossGain, s[0] / 2, 0.5, 'sawtooth', 0.4);
      playNote(bossGain, s[0] / 2 * 1.05, 0.5, 'sawtooth', 0.35);
    }
    if (bossBeat % 2 === 0) {
      const n = s[Math.floor(Math.random() * s.length)];
      playNote(bossGain, n, 0.3, 'square', 0.2);
      playNote(bossGain, n * 1.03, 0.3, 'square', 0.15);
    }
    if (bossBeat % 6 === 0) playDrum(40, 0.2, 0.3);
    if (Math.random() < 0.25) playNote(bossGain, s[Math.floor(Math.random() * s.length)] * 3, 0.15, 'sawtooth', 0.12);
  } else if (feel === 'military') {
    if (bossBeat % 2 === 0) playDrum(80, 0.08, 0.35);
    if (bossBeat % 4 === 0) {
      playDrum(50, 0.12, 0.4);
      playNote(bossGain, s[0] / 2, 0.4, 'square', 0.35);
    }
    if (bossBeat % 4 === 2) playDrum(80, 0.06, 0.3);
    if (bossBeat % 8 === 0) {
      playNote(bossGain, s[Math.floor(Math.random() * 3)], 0.5, 'sawtooth', 0.25);
    }
    if (bossBeat % 8 === 4) {
      playNote(bossGain, s[Math.floor(Math.random() * 3)] * 2, 0.3, 'square', 0.2);
    }
  } else if (feel === 'finale') {
    if (bossBeat % 4 === 0) {
      playNote(bossGain, s[0] / 4, 0.6, 'sawtooth', 0.5);
      playDrum(45, 0.15, 0.4);
    }
    if (bossBeat % 2 === 0) {
      playNote(bossGain, s[Math.floor(Math.random() * 3)] / 2, 0.4, 'sawtooth', 0.35);
      playDrum(75 + Math.random() * 30, 0.08, 0.25);
    }
    const idx = bossBeat % s.length;
    playNote(bossGain, s[idx] * 2, 0.15, 'square', 0.2);
    if (bossBeat % 3 === 0) playNote(bossGain, s[Math.floor(Math.random() * s.length)] * 4, 0.1, 'sine', 0.18);
    if (bossBeat % 8 === 0) {
      playNote(bossGain, s[s.length - 1] * 4, 0.5, 'triangle', 0.2);
      playNote(bossGain, s[0] / 8, 0.8, 'square', 0.25);
    }
  }
}

const fadeIntervals = new Map();

function fadeTo(node, target, durationMs) {
  if (fadeIntervals.has(node)) clearInterval(fadeIntervals.get(node));
  const startVal = node.gain.value;
  const diff = target - startVal;
  if (Math.abs(diff) < 0.001) { node.gain.value = target; return; }
  const steps = Math.max(1, Math.floor(durationMs / 30));
  let step = 0;
  const iv = setInterval(() => {
    step++;
    const t = step / steps;
    const ease = t * t * (3 - 2 * t);
    node.gain.value = startVal + diff * ease;
    if (step >= steps) {
      node.gain.value = target;
      clearInterval(iv);
      fadeIntervals.delete(node);
    }
  }, 30);
  fadeIntervals.set(node, iv);
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

/* ── SFX system ── */
let sfxCtx = null;
let sfxGainNode = null;

function initSfxCtx() {
  if (sfxCtx) return;
  sfxCtx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  sfxGainNode = sfxCtx.createGain();
  sfxGainNode.gain.value = 0.25;
  sfxGainNode.connect(sfxCtx.destination);
}

function sfxNote(freq, dur, type, vol) {
  if (!sfxCtx) return;
  const o = sfxCtx.createOscillator();
  const g = sfxCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, sfxCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + dur);
  o.connect(g); g.connect(sfxGainNode);
  o.start(sfxCtx.currentTime); o.stop(sfxCtx.currentTime + dur + 0.02);
}

function sfxNoise(dur, vol) {
  if (!sfxCtx) return;
  const bufSize = sfxCtx.sampleRate * dur;
  const buf = sfxCtx.createBuffer(1, bufSize, sfxCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = sfxCtx.createBufferSource();
  src.buffer = buf;
  const g = sfxCtx.createGain();
  g.gain.setValueAtTime(vol, sfxCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + dur);
  src.connect(g); g.connect(sfxGainNode);
  src.start(); src.stop(sfxCtx.currentTime + dur + 0.02);
}

export function sfxJump() {
  initSfxCtx();
  sfxNote(320, 0.12, 'sine', 0.3);
  sfxNote(480, 0.1, 'sine', 0.2);
}

export function sfxLand(impact) {
  initSfxCtx();
  const v = Math.min(0.4, impact * 0.5);
  sfxNote(60, 0.15, 'triangle', v);
  sfxNote(45, 0.2, 'sine', v * 0.6);
}

export function sfxAttack(combo) {
  initSfxCtx();
  sfxNoise(0.1, 0.2);
  const pitches = [400, 500, 350];
  sfxNote(pitches[(combo - 1) % 3], 0.08, 'sawtooth', 0.15);
  if (combo === 3) {
    sfxNote(200, 0.15, 'square', 0.12);
  }
}

export function sfxDodge() {
  initSfxCtx();
  sfxNoise(0.07, 0.15);
  sfxNote(600, 0.06, 'sine', 0.12);
}

export function sfxHit() {
  initSfxCtx();
  sfxNote(150, 0.12, 'square', 0.25);
  sfxNote(80, 0.15, 'sawtooth', 0.15);
}

export function sfxEnemyHit() {
  initSfxCtx();
  sfxNote(250, 0.08, 'square', 0.2);
  sfxNote(180, 0.1, 'triangle', 0.15);
}

export function sfxBossHit() {
  initSfxCtx();
  sfxNote(120, 0.15, 'sawtooth', 0.3);
  sfxNote(80, 0.2, 'square', 0.2);
  sfxNote(200, 0.1, 'triangle', 0.15);
}

export function sfxBossSlam() {
  initSfxCtx();
  sfxNote(40, 0.3, 'sawtooth', 0.4);
  sfxNote(60, 0.25, 'square', 0.3);
  sfxNoise(0.15, 0.25);
}

export function sfxBossCharge() {
  initSfxCtx();
  sfxNote(100, 0.2, 'sawtooth', 0.2);
  sfxNote(150, 0.15, 'square', 0.15);
}

export function sfxBossSwipe() {
  initSfxCtx();
  sfxNoise(0.12, 0.2);
  sfxNote(300, 0.1, 'sawtooth', 0.2);
}

export function sfxDeath() {
  initSfxCtx();
  sfxNote(300, 0.3, 'sawtooth', 0.3);
  setTimeout(() => sfxNote(200, 0.3, 'sawtooth', 0.25), 100);
  setTimeout(() => sfxNote(120, 0.4, 'sawtooth', 0.2), 220);
  setTimeout(() => sfxNote(60, 0.5, 'square', 0.2), 350);
}

export function sfxNpcBabble() {
  initSfxCtx();
  const vowels = [300, 400, 500, 350, 450, 550, 280, 420];
  const count = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const t = sfxCtx.currentTime + i * 0.06;
    const freq = vowels[Math.floor(Math.random() * vowels.length)] * (0.8 + Math.random() * 0.5);
    const o = sfxCtx.createOscillator();
    const g = sfxCtx.createGain();
    o.type = Math.random() > 0.5 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.linearRampToValueAtTime(freq * (0.85 + Math.random() * 0.3), t + 0.05);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    o.connect(g); g.connect(sfxGainNode);
    o.start(t); o.stop(t + 0.07);
  }
}

export function sfxLevelUp() {
  initSfxCtx();
  sfxNote(523, 0.15, 'sine', 0.25);
  setTimeout(() => sfxNote(659, 0.15, 'sine', 0.25), 100);
  setTimeout(() => sfxNote(784, 0.2, 'sine', 0.3), 200);
}

export function sfxPickup() {
  initSfxCtx();
  sfxNote(600, 0.08, 'sine', 0.2);
  sfxNote(800, 0.1, 'sine', 0.15);
}
