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
      reputation: player.reputation || 0,
      foundLore: [...(player.foundLore || [])],
      ngPlus: player.ngPlus || 0,
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
    return true;
  } catch {
    return false;
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
  try { return Boolean(loadGame()?.player); } catch { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
