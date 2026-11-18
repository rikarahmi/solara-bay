// Keyboard + mouse state. Pointer lock on click for real play; drag-to-look
// as a fallback (and the only path in headless screenshots, which set the
// camera directly instead). Scripted tests may write input.keys directly.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    lookDX: 0,
    lookDY: 0,
    dragging: false,
    locked: false,
    down(code) {
      return input.keys.has(code);
    },
    consumeLook() {
      const dx = input.lookDX;
      const dy = input.lookDY;
      input.lookDX = 0;
      input.lookDY = 0;
      return { dx, dy };
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    if (canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (_) { /* pointer lock unavailable; drag still works */ }
    }
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.lookDX += e.movementX;
      input.lookDY += e.movementY;
    } else if (input.dragging) {
      input.lookDX += e.clientX - (input.lastX ?? e.clientX);
      input.lookDY += e.clientY - (input.lastY ?? e.clientY);
      input.lastX = e.clientX;
      input.lastY = e.clientY;
    }
  });
  return input;
}
