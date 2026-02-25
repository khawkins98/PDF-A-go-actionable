// @vitest-environment happy-dom
/**
 * Tests for dialogs.js — About, Help, and Bookmark placeholder dialogs.
 */
import { describe, it, expect, vi } from 'vitest';
import { showAboutDialog, showHelpDialog, showBookmarkPlaceholder } from './dialogs.js';
import { MENUBAR_HEIGHT } from './menu-bar.js';

function mockWinBox() {
  const instances = [];
  const WinBox = vi.fn(function (opts) {
    this.opts = opts;
    this.title = opts.title || '';
    this.close = vi.fn();
    this.focus = vi.fn();
    this.onclose = opts.onclose || null;
    instances.push(this);
  });
  WinBox._instances = instances;
  return WinBox;
}

function mockRoot() {
  return document.createElement('div');
}

describe('showAboutDialog', () => {
  it('should create a WinBox with title "About"', () => {
    const WinBox = mockWinBox();
    const win = showAboutDialog(mockRoot(), WinBox);

    expect(WinBox).toHaveBeenCalledTimes(1);
    expect(WinBox._instances[0].opts.title).toBe('About');
  });

  it('should use correct WinBox options', () => {
    const WinBox = mockWinBox();
    const root = mockRoot();
    showAboutDialog(root, WinBox);

    const opts = WinBox._instances[0].opts;
    expect(opts.root).toBe(root);
    expect(opts.x).toBe('center');
    expect(opts.y).toBe('center');
    expect(opts.top).toBe(MENUBAR_HEIGHT);
    expect(opts.class).toContain('no-resize');
    expect(opts.class).toContain('white');
  });

  it('should call onClose when the dialog closes', () => {
    const WinBox = mockWinBox();
    const onClose = vi.fn();
    showAboutDialog(mockRoot(), WinBox, onClose);

    const instance = WinBox._instances[0];
    instance.onclose();

    expect(onClose).toHaveBeenCalled();
  });

  it('should return the WinBox instance', () => {
    const WinBox = mockWinBox();
    const win = showAboutDialog(mockRoot(), WinBox);
    expect(win).toBe(WinBox._instances[0]);
  });

  it('should include about content with version info', () => {
    const WinBox = mockWinBox();
    showAboutDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    expect(mountedContent.innerHTML).toContain('PDF-A-go-actionable');
    expect(mountedContent.innerHTML).toContain('Version 1.0.0');
    expect(mountedContent.innerHTML).toContain('pdf-lib');
  });
});

describe('showHelpDialog', () => {
  it('should create a WinBox with title "Help"', () => {
    const WinBox = mockWinBox();
    showHelpDialog(mockRoot(), WinBox);

    expect(WinBox._instances[0].opts.title).toBe('Help');
  });

  it('should include help content with instructions', () => {
    const WinBox = mockWinBox();
    showHelpDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    expect(mountedContent.innerHTML).toContain('How to Use');
    expect(mountedContent.innerHTML).toContain('Open File(s)');
    expect(mountedContent.innerHTML).toContain('Keyboard Shortcuts');
  });

  it('should call onClose when the dialog closes', () => {
    const WinBox = mockWinBox();
    const onClose = vi.fn();
    showHelpDialog(mockRoot(), WinBox, onClose);

    WinBox._instances[0].onclose();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('showBookmarkPlaceholder', () => {
  it('should create a WinBox with bookmark placeholder content', () => {
    const WinBox = mockWinBox();
    showBookmarkPlaceholder(mockRoot(), WinBox);

    expect(WinBox._instances[0].opts.title).toBe('Test PDFs: Bookmarks');
    const content = WinBox._instances[0].opts.mount;
    expect(content.innerHTML).toContain('Bookmarks / Outlines');
    expect(content.innerHTML).toContain('CORS-friendly');
  });
});
