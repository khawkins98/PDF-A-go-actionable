// @vitest-environment happy-dom
/**
 * Tests for window-manager.js — tiling, cascading, closing, focusing, and layout.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CASCADE_OFFSET,
  tileWindows,
  cascadeWindows,
  closeAllWindows,
  focusWindow,
  getFloatingLayout,
  setWinBoxAriaRole,
} from './window-manager.js';
import { MENUBAR_HEIGHT } from './menu-bar.js';

function mockWin() {
  return {
    min: false,
    max: false,
    restore: vi.fn(function () { this.min = false; this.max = false; }),
    resize: vi.fn(),
    move: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
  };
}

function mockRoot(w = 1024, h = 768) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w });
  Object.defineProperty(el, 'clientHeight', { value: h });
  return el;
}

describe('CASCADE_OFFSET', () => {
  it('should be 30', () => {
    expect(CASCADE_OFFSET).toBe(30);
  });
});

describe('tileWindows', () => {
  it('should do nothing when no sessions have main windows', () => {
    const sessions = new Map([['s1', { mainWin: null }]]);
    tileWindows(sessions, mockRoot());
    // No error, no calls
  });

  it('should tile a single window to fill the root', () => {
    const win = mockWin();
    const sessions = new Map([['s1', { mainWin: win }]]);
    const root = mockRoot(1024, 768);

    tileWindows(sessions, root);

    expect(win.resize).toHaveBeenCalledWith(1024, 768);
    expect(win.move).toHaveBeenCalledWith(0, MENUBAR_HEIGHT);
  });

  it('should tile two windows side by side', () => {
    const win1 = mockWin();
    const win2 = mockWin();
    const sessions = new Map([
      ['s1', { mainWin: win1 }],
      ['s2', { mainWin: win2 }],
    ]);
    const root = mockRoot(1024, 768);

    tileWindows(sessions, root);

    // 2 windows => 2 cols, 1 row
    expect(win1.resize).toHaveBeenCalledWith(512, 768);
    expect(win2.resize).toHaveBeenCalledWith(512, 768);
  });

  it('should restore maximized windows before tiling', () => {
    const win = mockWin();
    win.max = true;
    const sessions = new Map([['s1', { mainWin: win }]]);

    tileWindows(sessions, mockRoot());

    expect(win.restore).toHaveBeenCalled();
  });
});

describe('cascadeWindows', () => {
  it('should cascade windows at 85% size with offset', () => {
    const win1 = mockWin();
    const win2 = mockWin();
    const sessions = new Map([
      ['s1', { mainWin: win1 }],
      ['s2', { mainWin: win2 }],
    ]);
    const root = mockRoot(1024, 768);

    cascadeWindows(sessions, root);

    const w = Math.floor(1024 * 0.85);
    const h = Math.floor(768 * 0.85);
    expect(win1.resize).toHaveBeenCalledWith(w, h);
    expect(win1.move).toHaveBeenCalledWith(40, MENUBAR_HEIGHT + 30);
    expect(win2.move).toHaveBeenCalledWith(40 + CASCADE_OFFSET, MENUBAR_HEIGHT + 30 + CASCADE_OFFSET);
  });

  it('should do nothing when no active windows', () => {
    const sessions = new Map();
    cascadeWindows(sessions, mockRoot());
    // No error
  });
});

describe('closeAllWindows', () => {
  it('should close all windows with main windows', () => {
    const win1 = mockWin();
    const win2 = mockWin();
    const sessions = new Map([
      ['s1', { mainWin: win1 }],
      ['s2', { mainWin: win2 }],
    ]);

    closeAllWindows(sessions);

    expect(win1.close).toHaveBeenCalled();
    expect(win2.close).toHaveBeenCalled();
  });

  it('should skip sessions without main windows', () => {
    const sessions = new Map([['s1', { mainWin: null }]]);
    closeAllWindows(sessions);
    // No error
  });
});

describe('focusWindow', () => {
  it('should focus the window for the given session', () => {
    const win = mockWin();
    const sessions = new Map([['s1', { mainWin: win }]]);

    focusWindow(sessions, 's1');

    expect(win.focus).toHaveBeenCalled();
  });

  it('should restore minimized window before focusing', () => {
    const win = mockWin();
    win.min = true;
    const sessions = new Map([['s1', { mainWin: win }]]);

    focusWindow(sessions, 's1');

    expect(win.restore).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
  });

  it('should do nothing for non-existent session', () => {
    const sessions = new Map();
    focusWindow(sessions, 'nonexistent');
    // No error
  });
});

describe('setWinBoxAriaRole', () => {
  it('should set role and aria-label on win.dom', () => {
    const dom = document.createElement('div');
    setWinBoxAriaRole({ dom }, 'About');
    expect(dom.getAttribute('role')).toBe('dialog');
    expect(dom.getAttribute('aria-label')).toBe('About');
  });

  it('should accept a custom role', () => {
    const dom = document.createElement('div');
    setWinBoxAriaRole({ dom }, 'Results', 'region');
    expect(dom.getAttribute('role')).toBe('region');
    expect(dom.getAttribute('aria-label')).toBe('Results');
  });

  it('should not throw when win is null or has no dom', () => {
    expect(() => setWinBoxAriaRole(null, 'Test')).not.toThrow();
    expect(() => setWinBoxAriaRole({}, 'Test')).not.toThrow();
  });
});

describe('getFloatingLayout', () => {
  it('should return a larger layout for preview panels', () => {
    const root = mockRoot(1024, 768);
    const layout = getFloatingLayout('preview', 0, root);

    expect(layout.width).toBeLessThanOrEqual(700);
    expect(layout.height).toBeLessThanOrEqual(600);
    expect(layout.y).toBeGreaterThanOrEqual(MENUBAR_HEIGHT);
  });

  it('should return a smaller layout for structure/fonts/images', () => {
    const root = mockRoot(1024, 768);
    const layout = getFloatingLayout('structure', 0, root);

    expect(layout.width).toBeLessThanOrEqual(500);
    expect(layout.height).toBeLessThanOrEqual(450);
  });

  it('should apply cascade offset', () => {
    const root = mockRoot(1024, 768);
    const layout0 = getFloatingLayout('fonts', 0, root);
    const layout1 = getFloatingLayout('fonts', 1, root);

    expect(layout1.x).toBeGreaterThan(layout0.x);
    expect(layout1.y).toBeGreaterThan(layout0.y);
  });

  it('should apply panel-specific offsets', () => {
    const root = mockRoot(1024, 768);
    const structLayout = getFloatingLayout('structure', 0, root);
    const fontsLayout = getFloatingLayout('fonts', 0, root);
    const imagesLayout = getFloatingLayout('images', 0, root);

    expect(fontsLayout.x).toBeGreaterThan(structLayout.x);
    expect(imagesLayout.x).toBeGreaterThan(fontsLayout.x);
  });
});
