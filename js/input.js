export const mouse = { dx: 0, dy: 0, down: false };
export const pointer = { locked: false };
export const keys = {};
export const keysJustPressed = {};
export const lockOn = { toggled: false };
export const touch = { active: false };

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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

if (isMobile) {
  touch.active = true;
  pointer.locked = true;

  let camTouchId = null;
  let lastCamX = 0, lastCamY = 0;

  const halfW = () => window.innerWidth / 2;

  document.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (t.clientX > halfW() && camTouchId === null) {
        camTouchId = t.identifier;
        lastCamX = t.clientX;
        lastCamY = t.clientY;
      }
    }
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) {
        mouse.dx += (t.clientX - lastCamX) * 1.5;
        mouse.dy += (t.clientY - lastCamY) * 1.5;
        lastCamX = t.clientX;
        lastCamY = t.clientY;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) camTouchId = null;
    }
  });
}
