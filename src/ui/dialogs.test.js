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
    this.dom = document.createElement('div');
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

  it('should set role="dialog" and aria-label on the About dialog dom', () => {
    const WinBox = mockWinBox();
    showAboutDialog(mockRoot(), WinBox);

    const instance = WinBox._instances[0];
    expect(instance.dom.getAttribute('role')).toBe('dialog');
    expect(instance.dom.getAttribute('aria-label')).toBe('About');
  });

  it('should include about content with version info', () => {
    const WinBox = mockWinBox();
    showAboutDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    expect(mountedContent.innerHTML).toContain('PDF-A-go-actionable');
    expect(mountedContent.innerHTML).toContain('Version ');
    expect(mountedContent.innerHTML).toContain('pdf-lib');
  });

  it('should have NeXTSTEP-style two-zone layout with hero and info panel', () => {
    const WinBox = mockWinBox();
    showAboutDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    expect(mountedContent.classList.contains('about-dialog')).toBe(true);

    const hero = mountedContent.querySelector('.about-hero');
    expect(hero).not.toBeNull();
    expect(hero.querySelector('.about-hero__icon')).not.toBeNull();
    expect(hero.querySelector('.about-hero__name').textContent).toBe('PDF-A-go-actionable');

    const panel = mountedContent.querySelector('.about-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('.about-info-grid')).not.toBeNull();
  });

  it('should include NeXTSTEP design trivia in expandable details', () => {
    const WinBox = mockWinBox();
    showAboutDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    const details = mountedContent.querySelectorAll('.about-details');
    expect(details.length).toBe(2);

    const summaries = [...details].map(d => d.querySelector('summary').textContent);
    expect(summaries).toContain('Built With');
    expect(summaries).toContain('Why NeXTSTEP?');

    expect(mountedContent.innerHTML).toContain('Display PostScript');
    expect(mountedContent.innerHTML).toContain('Quartz');

    const wikiLinks = mountedContent.querySelectorAll('a[href*="wikipedia.org"]');
    expect(wikiLinks.length).toBe(4);
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

  it('should include complementary tools section', () => {
    const WinBox = mockWinBox();
    showHelpDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    expect(mountedContent.innerHTML).toContain('Complementary Tools');
    expect(mountedContent.innerHTML).toContain('PAC');
    expect(mountedContent.innerHTML).toContain('NVDA');
    expect(mountedContent.innerHTML).toContain('VoiceOver');
  });

  it('should render tool links with correct attributes', () => {
    const WinBox = mockWinBox();
    showHelpDialog(mockRoot(), WinBox);

    const mountedContent = WinBox._instances[0].opts.mount;
    const links = mountedContent.querySelectorAll('.help-tools-list a');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('should call onClose when the dialog closes', () => {
    const WinBox = mockWinBox();
    const onClose = vi.fn();
    showHelpDialog(mockRoot(), WinBox, onClose);

    WinBox._instances[0].onclose();
    expect(onClose).toHaveBeenCalled();
  });

  it('should set role="dialog" and aria-label on the Help dialog dom', () => {
    const WinBox = mockWinBox();
    showHelpDialog(mockRoot(), WinBox);

    const instance = WinBox._instances[0];
    expect(instance.dom.getAttribute('role')).toBe('dialog');
    expect(instance.dom.getAttribute('aria-label')).toBe('Help');
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

  it('should set role="dialog" and aria-label on the Bookmark dialog dom', () => {
    const WinBox = mockWinBox();
    showBookmarkPlaceholder(mockRoot(), WinBox);

    const instance = WinBox._instances[0];
    expect(instance.dom.getAttribute('role')).toBe('dialog');
    expect(instance.dom.getAttribute('aria-label')).toBe('Bookmarks');
  });
});
