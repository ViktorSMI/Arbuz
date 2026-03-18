export const mouse = { dx: 0, dy: 0, down: false };
export const pointer = { locked: false };
export const keys = {};
export const keysJustPressed = {};

document.addEventListener('keydown', e => {
  if (!keys[e.code]) keysJustPressed[e.code] = true;
  keys[e.code] = true;
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousemove', e => {
  if (!pointer.locked) return;
  mouse.dx += e.movementX;
  mouse.dy += e.movementY;
});
document.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
document.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
document.addEventListener('pointerlockchange', () => {
  pointer.locked = !!document.pointerLockElement;
});
