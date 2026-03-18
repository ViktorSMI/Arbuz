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
  let joyTouchId = null;
  let joyCenterX = 0, joyCenterY = 0;

  const btnIds = new Set(['touch-attack', 'touch-dodge', 'touch-jump', 'touch-lock', 'touch-sprint', 'touch-joystick', 'touch-stick']);

  function isBtnTouch(t) {
    let el = document.elementFromPoint(t.clientX, t.clientY);
    while (el) {
      if (el.id && btnIds.has(el.id)) return true;
      if (el.classList && el.classList.contains('touch-btn')) return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (!isBtnTouch(t) && camTouchId === null) {
        camTouchId = t.identifier;
        lastCamX = t.clientX;
        lastCamY = t.clientY;
      }
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) {
        mouse.dx += (t.clientX - lastCamX) * 1.5;
        mouse.dy += (t.clientY - lastCamY) * 1.5;
        lastCamX = t.clientX;
        lastCamY = t.clientY;
      }
      if (t.identifier === joyTouchId) {
        updateJoystick(t.clientX, t.clientY);
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) camTouchId = null;
      if (t.identifier === joyTouchId) {
        joyTouchId = null;
        keys['KeyW'] = false; keys['KeyS'] = false;
        keys['KeyA'] = false; keys['KeyD'] = false;
        const stick = document.getElementById('touch-stick');
        if (stick) { stick.style.left = '40px'; stick.style.top = '40px'; }
      }
    }
  });

  function updateJoystick(tx, ty) {
    const dx = tx - joyCenterX, dy = ty - joyCenterY;
    const maxR = 45;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const cx = Math.cos(angle) * clampedDist;
    const cy = Math.sin(angle) * clampedDist;
    const stick = document.getElementById('touch-stick');
    if (stick) { stick.style.left = (40 + cx) + 'px'; stick.style.top = (40 + cy) + 'px'; }
    const deadzone = 15;
    keys['KeyW'] = dy < -deadzone;
    keys['KeyS'] = dy > deadzone;
    keys['KeyA'] = dx < -deadzone;
    keys['KeyD'] = dx > deadzone;
  }

  const joy = document.getElementById('touch-joystick');
  if (joy) {
    joy.addEventListener('touchstart', e => {
      e.stopPropagation();
      const t = e.changedTouches[0];
      joyTouchId = t.identifier;
      const rect = joy.getBoundingClientRect();
      joyCenterX = rect.left + rect.width / 2;
      joyCenterY = rect.top + rect.height / 2;
      updateJoystick(t.clientX, t.clientY);
    }, { passive: true });
  }

  function touchBtn(id, keyDown, keyUp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.stopPropagation();
      e.preventDefault();
      keyDown();
    }, { passive: false });
    el.addEventListener('touchend', e => {
      e.stopPropagation();
      keyUp();
    });
    el.addEventListener('touchcancel', e => {
      keyUp();
    });
  }

  touchBtn('touch-attack',
    () => { mouse.down = true; },
    () => { mouse.down = false; }
  );
  touchBtn('touch-dodge',
    () => { if (!keys['ShiftLeft']) keysJustPressed['ShiftLeft'] = true; keys['ShiftLeft'] = true; },
    () => { keys['ShiftLeft'] = false; }
  );
  touchBtn('touch-jump',
    () => { keys['Space'] = true; },
    () => { keys['Space'] = false; }
  );
  touchBtn('touch-lock',
    () => { lockOn.toggled = true; },
    () => {}
  );
  touchBtn('touch-sprint',
    () => { keys['KeyR'] = true; },
    () => { keys['KeyR'] = false; }
  );
  touchBtn('touch-interact',
    () => { if (!keys['KeyE']) keysJustPressed['KeyE'] = true; keys['KeyE'] = true; },
    () => { keys['KeyE'] = false; }
  );
}
