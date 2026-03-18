const STORAGE_KEY = 'arbuz_souls_save';

export function saveGame(player, gameLocation, bossIndex) {
  const data = {
    version: 1,
    timestamp: Date.now(),
    player: {
      hp: player.hp,
      maxHp: player.maxHp,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      speed: player.speed,
      xp: player.xp,
      level: player.level,
      xpToNext: player.xpToNext,
      kills: player.kills,
      seeds: player.seeds,
      upgrades: { ...player.upgrades },
      equipment: { ...player.equipment },
      inventory: [...player.inventory],
    },
    position: {
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z,
    },
    gameLocation,
    bossIndex,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function deleteSave() {
  localStorage.removeItem(STORAGE_KEY);
}
