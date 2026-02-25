// @vitest-environment happy-dom
/**
 * Tests for menu-bar.js — menu bar creation, submenu mechanics, and keyboard navigation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MENUBAR_HEIGHT,
  createMenuBar,
  setupMenuBarKeyNav,
  setRovingFocus,
  SubmenuController,
  menuBtn,
  menuSep,
  submenuItem,
  buildExportAllSubmenu,
  buildWindowSubmenu,
  buildAdvancedSubmenu,
  buildTestingToolsSubmenu,
} from './menu-bar.js';

describe('MENUBAR_HEIGHT', () => {
  it('should be 28', () => {
    expect(MENUBAR_HEIGHT).toBe(28);
  });
});

describe('createMenuBar', () => {
  it('should return a nav element with role="menubar"', () => {
    const nav = createMenuBar(() => {});
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('role')).toBe('menubar');
    expect(nav.getAttribute('aria-label')).toBe('Application menu');
  });

  it('should include brand text', () => {
    const nav = createMenuBar(() => {});
    const brand = nav.querySelector('.app-menubar__brand');
    expect(brand).not.toBeNull();
    expect(brand.textContent).toBe('PDF-A-go');
  });

  it('should include all expected menu buttons', () => {
    const nav = createMenuBar(() => {});
    expect(nav.querySelector('[data-action="open-files"]')).not.toBeNull();
    expect(nav.querySelector('[data-action="export-all"]')).not.toBeNull();
    expect(nav.querySelector('[data-action="window-menu"]')).not.toBeNull();
    expect(nav.querySelector('[data-action="about"]')).not.toBeNull();
    expect(nav.querySelector('[data-action="help"]')).not.toBeNull();
    expect(nav.querySelector('[data-action="advanced-menu"]')).not.toBeNull();
  });

  it('should set aria-haspopup on buttons with submenus', () => {
    const nav = createMenuBar(() => {});
    for (const action of ['export-all', 'window-menu', 'advanced-menu']) {
      const btn = nav.querySelector(`[data-action="${action}"]`);
      expect(btn.getAttribute('aria-haspopup')).toBe('true');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('should call onAction with the correct action on click', () => {
    const onAction = vi.fn();
    const nav = createMenuBar(onAction);
    document.body.appendChild(nav);

    const aboutBtn = nav.querySelector('[data-action="about"]');
    aboutBtn.click();

    expect(onAction).toHaveBeenCalledWith('about', aboutBtn);

    nav.remove();
  });

  it('should not call onAction for disabled buttons', () => {
    const onAction = vi.fn();
    const nav = createMenuBar(onAction);
    document.body.appendChild(nav);

    const aboutBtn = nav.querySelector('[data-action="about"]');
    aboutBtn.disabled = true;
    aboutBtn.click();

    expect(onAction).not.toHaveBeenCalled();

    nav.remove();
  });
});

describe('menuBtn', () => {
  it('should create a button with role="menuitem"', () => {
    const btn = menuBtn('Test', 'test-action');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('role')).toBe('menuitem');
    expect(btn.textContent).toBe('Test');
    expect(btn.dataset.action).toBe('test-action');
    expect(btn.type).toBe('button');
  });
});

describe('menuSep', () => {
  it('should create a separator with aria-hidden', () => {
    const sep = menuSep();
    expect(sep.className).toBe('app-menubar__sep');
    expect(sep.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('submenuItem', () => {
  it('should create a button with role="menuitem" and click handler', () => {
    const onClick = vi.fn();
    const item = submenuItem('Do Thing', onClick);
    expect(item.tagName).toBe('BUTTON');
    expect(item.getAttribute('role')).toBe('menuitem');
    expect(item.textContent).toBe('Do Thing');

    item.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('setRovingFocus', () => {
  it('should set tabindex=0 on the target and -1 on others', () => {
    const items = [
      document.createElement('button'),
      document.createElement('button'),
      document.createElement('button'),
    ];
    items.forEach((b) => { b.setAttribute('tabindex', '0'); document.body.appendChild(b); });

    setRovingFocus(items, 1);

    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(items[2].getAttribute('tabindex')).toBe('-1');

    items.forEach((b) => b.remove());
  });
});

describe('SubmenuController', () => {
  let menuBar;
  let ctrl;

  beforeEach(() => {
    menuBar = createMenuBar(() => {});
    document.body.appendChild(menuBar);
    ctrl = new SubmenuController(menuBar);
  });

  afterEach(() => {
    ctrl.close();
    menuBar.remove();
    document.querySelectorAll('.app-menubar__submenu').forEach((el) => el.remove());
  });

  it('should open a submenu and set aria-expanded', () => {
    const btn = menuBar.querySelector('[data-action="export-all"]');
    const submenu = document.createElement('div');
    submenu.className = 'app-menubar__submenu';

    ctrl.open(btn, submenu);

    expect(ctrl.active).toBe(submenu);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.contains(submenu)).toBe(true);
  });

  it('should close the active submenu', () => {
    const btn = menuBar.querySelector('[data-action="export-all"]');
    const submenu = document.createElement('div');
    submenu.className = 'app-menubar__submenu';

    ctrl.open(btn, submenu);
    const triggerBtn = ctrl.close();

    expect(ctrl.active).toBeNull();
    expect(ctrl.activeBtn).toBeNull();
    expect(triggerBtn).toBe(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should toggle — close if same button, open if different', () => {
    const btn1 = menuBar.querySelector('[data-action="export-all"]');
    const btn2 = menuBar.querySelector('[data-action="window-menu"]');
    const sub1 = document.createElement('div');
    sub1.className = 'app-menubar__submenu';
    const sub2 = document.createElement('div');
    sub2.className = 'app-menubar__submenu';

    ctrl.toggle(btn1, sub1);
    expect(ctrl.activeBtn).toBe(btn1);

    ctrl.toggle(btn1, sub1);
    expect(ctrl.active).toBeNull();

    ctrl.toggle(btn1, sub1);
    ctrl.toggle(btn2, sub2);
    expect(ctrl.activeBtn).toBe(btn2);
  });
});

describe('buildExportAllSubmenu', () => {
  it('should create a submenu with JSON/CSV/PDF items', () => {
    const onExport = vi.fn();
    const menu = buildExportAllSubmenu(true, onExport);

    const items = menu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels).toContain('Export All as JSON');
    expect(labels).toContain('Export All as CSV');
    expect(labels).toContain('Export All as PDF');
  });

  it('should disable items when hasResults is false', () => {
    const menu = buildExportAllSubmenu(false, vi.fn());
    const items = menu.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      expect(item.disabled).toBe(true);
    }
  });

  it('should enable items when hasResults is true', () => {
    const menu = buildExportAllSubmenu(true, vi.fn());
    const items = menu.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      expect(item.disabled).toBe(false);
    }
  });

  it('should call onExport with the correct format', () => {
    const onExport = vi.fn();
    const menu = buildExportAllSubmenu(true, onExport);
    const items = menu.querySelectorAll('[role="menuitem"]');

    items[0].click(); // JSON
    expect(onExport).toHaveBeenCalledWith('json');

    items[1].click(); // CSV
    expect(onExport).toHaveBeenCalledWith('csv');
  });
});

describe('buildWindowSubmenu', () => {
  it('should include Tile All, Cascade All, Close All items', () => {
    const menu = buildWindowSubmenu([], false, {
      onTile: vi.fn(), onCascade: vi.fn(), onCloseAll: vi.fn(), onFocus: vi.fn(),
    });
    const items = menu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels).toContain('Tile All');
    expect(labels).toContain('Cascade All');
    expect(labels).toContain('Close All');
  });

  it('should disable window actions when hasWindows is false', () => {
    const menu = buildWindowSubmenu([], false, {
      onTile: vi.fn(), onCascade: vi.fn(), onCloseAll: vi.fn(), onFocus: vi.fn(),
    });
    const tileItem = [...menu.querySelectorAll('[role="menuitem"]')].find(i => i.textContent === 'Tile All');
    expect(tileItem.disabled).toBe(true);
  });

  it('should include session names in window list', () => {
    const sessions = [
      { id: 's1', fileName: 'doc1.pdf' },
      { id: 's2', fileName: 'doc2.pdf' },
    ];
    const menu = buildWindowSubmenu(sessions, true, {
      onTile: vi.fn(), onCascade: vi.fn(), onCloseAll: vi.fn(), onFocus: vi.fn(),
    });
    const items = menu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels).toContain('doc1.pdf');
    expect(labels).toContain('doc2.pdf');
  });

  it('should call onFocus with session id when a window is clicked', () => {
    const onFocus = vi.fn();
    const sessions = [{ id: 's1', fileName: 'doc1.pdf' }];
    const menu = buildWindowSubmenu(sessions, true, {
      onTile: vi.fn(), onCascade: vi.fn(), onCloseAll: vi.fn(), onFocus,
    });
    const docItem = [...menu.querySelectorAll('[role="menuitem"]')].find(i => i.textContent === 'doc1.pdf');
    docItem.click();
    expect(onFocus).toHaveBeenCalledWith('s1');
  });
});

describe('buildAdvancedSubmenu', () => {
  it('should include Testing Tools item with aria-haspopup', () => {
    const menu = buildAdvancedSubmenu(vi.fn());
    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].textContent).toBe('Testing Tools');
    expect(items[0].getAttribute('aria-haspopup')).toBe('true');
  });
});

describe('buildTestingToolsSubmenu', () => {
  it('should include Load All items', () => {
    const testPdfs = [
      { name: 'test1', url: 'http://example.com/test1.pdf', expect: 'pass' },
      { name: 'test2', url: 'http://example.com/test2.pdf', expect: 'fail' },
    ];
    const categories = new Map([['Cat1', testPdfs]]);
    const menu = buildTestingToolsSubmenu(testPdfs, categories, {
      onLoadPdfs: vi.fn(), onBookmark: vi.fn(),
    });

    const items = menu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels[0]).toContain('Load All (2)');
    expect(labels[1]).toContain('Load All Pass (1)');
    expect(labels[2]).toContain('Load All Fail (1)');
  });

  it('should call onLoadPdfs when a test PDF item is clicked', () => {
    const onLoadPdfs = vi.fn();
    const testPdfs = [{ name: 'test1', url: 'http://example.com/test1.pdf', expect: 'pass' }];
    const categories = new Map([['Cat1', testPdfs]]);
    const menu = buildTestingToolsSubmenu(testPdfs, categories, {
      onLoadPdfs, onBookmark: vi.fn(),
    });

    // Click "Load All"
    const items = menu.querySelectorAll('[role="menuitem"]');
    items[0].click();
    expect(onLoadPdfs).toHaveBeenCalledWith(testPdfs);
  });
});
