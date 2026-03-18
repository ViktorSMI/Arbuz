const STORAGE_KEY = 'arbuz_souls_settings';

export const DEFAULTS = {
  masterVolume: 0.18,
  sfxVolume: 0.25,
  sensitivity: 0.002,
  bloomEnabled: true,
  showFps: false,
};

let cache = null;

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...DEFAULTS, ...parsed };
    } else {
      cache = { ...DEFAULTS };
    }
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function saveSettings() {
  if (!cache) cache = { ...DEFAULTS };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage full or unavailable
  }
}

export function getSetting(key) {
  if (!cache) loadSettings();
  return key in cache ? cache[key] : DEFAULTS[key];
}

export function setSetting(key, value) {
  if (!cache) loadSettings();
  cache[key] = value;
  saveSettings();
}
