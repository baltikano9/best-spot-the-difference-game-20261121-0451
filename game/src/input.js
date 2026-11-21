// Pointer and keyboard input. A click is mapped from the window to the 1280x720 logical canvas
// (undoing the renderer's letterbox scale and offset), then to a picture panel and that panel's own
// coordinates, so the rules only ever see (side, x, y) in the same space the scenes are drawn in.
// Key presses become one-shot ACTION_* flags that the loop takes once per frame.
import { PANEL } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_HINT = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const KEYS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyH: ACTION_HINT,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
};

/** The panel under a logical-canvas point, with the point in that panel's coordinates; or null. */
export function panelAt(x, y) {
  const py = y - PANEL.y;
  if (py < 0 || py >= PANEL.height) return null;
  for (const [side, left] of [['left', PANEL.leftX], ['right', PANEL.rightX]]) {
    const px = x - left;
    if (px >= 0 && px < PANEL.width) return { side, x: px, y: py };
  }
  return null;
}

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * `toLogical(clientX, clientY)` is the renderer's inverse mapping. `onGesture` runs inside every
 * user gesture (the browser only lets audio start there).
 */
export function createInput(canvas, toLogical, onGesture) {
  let actions = 0;
  const clicks = [];
  const hover = { x: -1, y: -1 };

  window.addEventListener('keydown', (event) => {
    const action = KEYS[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    onGesture();
    actions |= action;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    onGesture();
    const p = toLogical(event.clientX, event.clientY);
    clicks.push({ x: p.x, y: p.y, panel: panelAt(p.x, p.y) });
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    hover.x = p.x;
    hover.y = p.y;
  });
  canvas.addEventListener('pointerleave', () => {
    hover.x = -1;
    hover.y = -1;
  });

  return {
    hover,
    /** The key presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The clicks since the last call: { x, y, panel } in logical canvas coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
