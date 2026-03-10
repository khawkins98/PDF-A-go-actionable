/**
 * Window management — tiling, cascading, closing, and layout calculations.
 *
 * Pure functions that operate on sessions and root element dimensions.
 * No shared state — all inputs are explicit parameters.
 */

import { MENUBAR_HEIGHT } from './menu-bar.js';

/** Cascade offset for stacking multiple results windows. */
export const CASCADE_OFFSET = 30;

/**
 * Set ARIA role and label on a WinBox instance's dom element.
 *
 * @param {object} win - WinBox instance
 * @param {string} label - Accessible label
 * @param {string} [role='dialog'] - ARIA role
 */
export function setWinBoxAriaRole(win, label, role = 'dialog') {
  if (win && win.dom) {
    win.dom.setAttribute('role', role);
    win.dom.setAttribute('aria-label', label);
  }
}

/**
 * Tile all active session windows in a grid layout.
 *
 * @param {Map<string, object>} sessions - Active sessions map
 * @param {HTMLElement} root - The app root element
 */
export function tileWindows(sessions, root) {
  const active = [...sessions.values()].filter((s) => s.mainWin);
  const count = active.length;
  if (count === 0) return;

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cw = root.clientWidth;
  const ch = root.clientHeight;
  const tileW = Math.floor(cw / cols);
  const tileH = Math.floor(ch / rows);

  active.forEach((session, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const win = session.mainWin;
    if (win.max) win.restore();
    if (win.min) win.restore();
    win.resize(tileW, tileH);
    win.move(col * tileW, MENUBAR_HEIGHT + row * tileH);
  });
}

/**
 * Cascade all active session windows with offset positioning.
 *
 * @param {Map<string, object>} sessions - Active sessions map
 * @param {HTMLElement} root - The app root element
 */
export function cascadeWindows(sessions, root) {
  const active = [...sessions.values()].filter((s) => s.mainWin);
  if (active.length === 0) return;

  const cw = root.clientWidth;
  const ch = root.clientHeight;
  const w = Math.floor(cw * 0.85);
  const h = Math.floor(ch * 0.85);

  active.forEach((session, i) => {
    const win = session.mainWin;
    if (win.max) win.restore();
    if (win.min) win.restore();
    const offset = (i % 8) * CASCADE_OFFSET;
    win.resize(w, h);
    win.move(40 + offset, MENUBAR_HEIGHT + 30 + offset);
  });
}

/**
 * Close all active session windows.
 *
 * @param {Map<string, object>} sessions - Active sessions map
 */
export function closeAllWindows(sessions) {
  const ids = [...sessions.keys()];
  for (const id of ids) {
    const session = sessions.get(id);
    if (session && session.mainWin) {
      session.mainWin.close(); // triggers onclose -> cleanupSession
    }
  }
}

/**
 * Focus a specific session window.
 *
 * @param {Map<string, object>} sessions - Active sessions map
 * @param {string} sessionId - Session ID to focus
 */
export function focusWindow(sessions, sessionId) {
  const session = sessions.get(sessionId);
  if (session && session.mainWin) {
    if (session.mainWin.min) session.mainWin.restore();
    session.mainWin.focus();
  }
}

/**
 * Calculate layout dimensions for a floating panel.
 *
 * @param {string} id - Panel identifier (structure | fonts | images | preview)
 * @param {number} cascadeIndex - Session cascade index for offset
 * @param {HTMLElement} root - The app root element
 * @returns {object} WinBox layout options { x, y, width, height }
 */
export function getFloatingLayout(id, cascadeIndex, root) {
  const cw = root.clientWidth;
  const ch = root.clientHeight;
  const cascadeOff = (cascadeIndex % 8) * 15;

  // Preview panel gets a larger default size
  if (id === 'preview') {
    const w = Math.min(700, Math.floor(cw * 0.5));
    const h = Math.min(600, Math.floor(ch * 0.7));
    return {
      x: 40 + cascadeOff,
      y: MENUBAR_HEIGHT + 40 + cascadeOff,
      width: w,
      height: h,
    };
  }

  const w = Math.min(500, Math.floor(cw * 0.4));
  const h = Math.min(450, Math.floor(ch * 0.55));
  const offsets = { structure: 0, fonts: 30, images: 60 };
  const panelOffset = offsets[id] || 0;

  return {
    x: Math.floor(cw * 0.55) + panelOffset + cascadeOff,
    y: MENUBAR_HEIGHT + 40 + panelOffset + cascadeOff,
    width: w,
    height: h,
  };
}
