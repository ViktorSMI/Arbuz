import { player } from './player.js';
import { spawnParticles } from './particles.js';

let blockTimer = 0;
let parrySuccessTimer = 0;

export function updateBlock(dt, mouseRightDown) {
  if (parrySuccessTimer > 0) parrySuccessTimer -= dt;

  if (mouseRightDown && player.stamina > 0 && !player.attacking && !player.dodging) {
    if (!player.blocking) {
      player.blocking = true;
      blockTimer = 0;
      player.parrying = true;
    }

    blockTimer += dt;

    if (blockTimer > 0.15) {
      player.parrying = false;
    }

    player.stamina -= 8 * dt;
    if (player.stamina < 0) player.stamina = 0;
  } else {
    player.blocking = false;
    player.parrying = false;
    blockTimer = 0;
  }
}

export function processIncomingDamage(rawDmg, attackerObj) {
  if (player.blocking) {
    if (player.parrying) {
      player.parrySuccess = true;
      parrySuccessTimer = 0.5;

      attackerObj.stunTimer = 1.0;

      spawnParticles(player.pos.clone().setY(player.pos.y + 1), 0xffd700, 20, 6);

      setTimeout(() => {
        if (parrySuccessTimer <= 0) player.parrySuccess = false;
      }, 500);

      return 0;
    }

    return rawDmg * (1 - player.blockDmgReduction);
  }

  return rawDmg;
}

export function isBlocking() {
  return player.blocking;
}

export function isParrying() {
  return player.parrying;
}
