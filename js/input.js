export const mouse = { dx: 0, dy: 0, down: false };
export const pointer = { locked: false };
export const keys = {};
export const keysJustPressed = {};
export const lockOn = { toggled: false };

document.addEventListener('keydown', e => {
  if (!keys[e.code]) keysJustPressed[e.code] = true;
  keys[e.code] = true;
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousemove', e => {
  if (!pointer.locked) return;
  if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200) return;
  mouse.dx += e.movementX;
  mouse.dy += e.movementY;
});
document.addEventListener('mousedown', e => {
  if (e.button === 0) mouse.down = true;
  if (e.button === 1 && pointer.locked) { e.preventDefault(); lockOn.toggled = true; }
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
document.addEventListener('pointerlockchange', () => {
  pointer.locked = !!document.pointerLockElement;
});
document.addEventListener('wheel', e => {
  if (pointer.locked) { e.preventDefault(); lockOn.toggled = true; }
}, { passive: false });
