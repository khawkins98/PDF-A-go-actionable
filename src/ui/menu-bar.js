/**
 * Menu bar — DOM creation, submenu mechanics, and keyboard navigation.
 *
 * Creates the persistent application menu bar with ARIA menubar pattern.
 * Submenu lifecycle is managed by SubmenuController.
 * Submenu content builders take explicit data parameters to stay decoupled from app state.
 */

/** Menu bar height in pixels — must match --menubar-height in CSS. */
export const MENUBAR_HEIGHT = 28;

/**
 * Create the application menu bar.
 *
 * @param {Function} onAction - Callback receiving (actionName, buttonElement) on click
 * @returns {HTMLElement}
 */
export function createMenuBar(onAction) {
  const nav = document.createElement('nav');
  nav.className = 'app-menubar';
  nav.setAttribute('role', 'menubar');
  nav.setAttribute('aria-label', 'Application menu');

  // Brand
  const brand = document.createElement('span');
  brand.className = 'app-menubar__brand';
  brand.textContent = 'PDF-A-go';
  nav.appendChild(brand);

  nav.appendChild(menuSep());

  // Open File(s)
  const openBtn = menuBtn('Open File(s)', 'open-files');
  nav.appendChild(openBtn);

  nav.appendChild(menuSep());

  // Export All (with format submenu)
  const exportAllBtn = menuBtn('Export All', 'export-all');
  exportAllBtn.setAttribute('aria-haspopup', 'true');
  exportAllBtn.setAttribute('aria-expanded', 'false');
  nav.appendChild(exportAllBtn);

  // Window (with submenu)
  const windowBtn = menuBtn('Window', 'window-menu');
  windowBtn.setAttribute('aria-haspopup', 'true');
  windowBtn.setAttribute('aria-expanded', 'false');
  nav.appendChild(windowBtn);

  nav.appendChild(menuSep());

  // About
  nav.appendChild(menuBtn('About', 'about'));

  // Help
  nav.appendChild(menuBtn('Help', 'help'));

  // Advanced
  nav.appendChild(menuSep());
  const advancedBtn = menuBtn('Advanced', 'advanced-menu');
  advancedBtn.setAttribute('aria-haspopup', 'true');
  advancedBtn.setAttribute('aria-expanded', 'false');
  nav.appendChild(advancedBtn);

  // Click delegation
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.app-menubar__btn');
    if (!btn || btn.disabled) return;
    onAction(btn.dataset.action, btn);
  });

  return nav;
}

// === Helper functions ===

export function menuBtn(label, action) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'app-menubar__btn';
  btn.dataset.action = action;
  btn.setAttribute('role', 'menuitem');
  btn.textContent = label;
  return btn;
}

export function menuSep() {
  const sep = document.createElement('span');
  sep.className = 'app-menubar__sep';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

export function submenuItem(label, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'app-menubar__submenu-item';
  item.setAttribute('role', 'menuitem');
  item.textContent = label;
  item.addEventListener('click', onClick);
  return item;
}

// === Keyboard navigation (ARIA menubar pattern) ===

/** Move roving tabindex to `index` and focus that item. */
export function setRovingFocus(items, index) {
  for (const item of items) item.setAttribute('tabindex', '-1');
  items[index].setAttribute('tabindex', '0');
  items[index].focus();
}

/**
 * Set up arrow-key navigation on the menu bar.
 *
 * @param {HTMLElement} nav - The menu bar element
 * @param {SubmenuController} submenuCtrl - Submenu controller for coordinated keyboard behavior
 */
export function setupMenuBarKeyNav(nav, submenuCtrl) {
  const getItems = () => [...nav.querySelectorAll('.app-menubar__btn')];

  // Roving tabindex: first item tabbable, rest removed from tab order
  const items = getItems();
  items.forEach((item, i) => {
    item.setAttribute('tabindex', i === 0 ? '0' : '-1');
  });

  nav.addEventListener('keydown', (e) => {
    const items = getItems();
    const idx = items.indexOf(document.activeElement);
    if (idx === -1) return;

    let nextIdx;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIdx = (idx + 1) % items.length;
        setRovingFocus(items, nextIdx);
        if (submenuCtrl.active) {
          submenuCtrl.close();
          if (items[nextIdx].getAttribute('aria-haspopup') === 'true') {
            items[nextIdx].click();
          }
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIdx = (idx - 1 + items.length) % items.length;
        setRovingFocus(items, nextIdx);
        if (submenuCtrl.active) {
          submenuCtrl.close();
          if (items[nextIdx].getAttribute('aria-haspopup') === 'true') {
            items[nextIdx].click();
          }
        }
        break;
      case 'ArrowDown':
        if (items[idx].getAttribute('aria-haspopup') === 'true') {
          e.preventDefault();
          if (!submenuCtrl.active) items[idx].click();
        }
        break;
      case 'Home':
        e.preventDefault();
        setRovingFocus(items, 0);
        break;
      case 'End':
        e.preventDefault();
        setRovingFocus(items, items.length - 1);
        break;
    }
  });
}

// === Submenu Controller ===

/**
 * Manages submenu lifecycle — open, close, toggle, and nested submenus.
 */
export class SubmenuController {
  constructor(menuBarEl) {
    this.menuBar = menuBarEl;
    this.active = null;
    this.activeBtn = null;
    this._nestedActive = null;
    this._nestedBtn = null;
    this._outsideClickHandler = null;
    this._escapeHandler = null;
  }

  toggle(btn, submenuEl) {
    if (this.activeBtn === btn) {
      this.close();
      return;
    }
    this.close();
    this.open(btn, submenuEl);
  }

  open(btn, submenuEl) {
    const rect = btn.getBoundingClientRect();
    submenuEl.style.left = `${rect.left}px`;

    document.body.appendChild(submenuEl);
    this.active = submenuEl;
    this.activeBtn = btn;
    btn.setAttribute('aria-expanded', 'true');

    // Keyboard navigation within the submenu
    const getSubmenuItems = () =>
      [...submenuEl.querySelectorAll('.app-menubar__submenu-item:not([disabled])')];

    const self = this;

    submenuEl.addEventListener('keydown', (e) => {
      const items = getSubmenuItems();
      const idx = items.indexOf(document.activeElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (items.length) items[idx < items.length - 1 ? idx + 1 : 0].focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (items.length) items[idx > 0 ? idx - 1 : items.length - 1].focus();
          break;
        case 'Home':
          e.preventDefault();
          if (items.length) items[0].focus();
          break;
        case 'End':
          e.preventDefault();
          if (items.length) items[items.length - 1].focus();
          break;
        case 'Escape':
          e.preventDefault();
          self.close();
          btn.focus();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          // Move to adjacent menu bar item (and open its submenu if it has one)
          e.preventDefault();
          const menuBtns = [...self.menuBar.querySelectorAll('.app-menubar__btn')];
          const btnIdx = menuBtns.indexOf(btn);
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          const nextIdx = (btnIdx + delta + menuBtns.length) % menuBtns.length;
          self.close();
          setRovingFocus(menuBtns, nextIdx);
          if (menuBtns[nextIdx].getAttribute('aria-haspopup') === 'true') {
            menuBtns[nextIdx].click();
          }
          break;
        }
      }
    });

    // Close on outside click and Escape (next tick to avoid immediate close)
    this._outsideClickHandler = (e) => {
      if (this.active && !this.active.contains(e.target) && e.target !== this.activeBtn) {
        this.close();
      }
    };
    this._escapeHandler = (e) => {
      if (e.key === 'Escape') {
        const triggerBtn = this.close();
        if (triggerBtn) triggerBtn.focus();
      }
    };

    requestAnimationFrame(() => {
      document.addEventListener('click', this._outsideClickHandler);
      document.addEventListener('keydown', this._escapeHandler);
      // Focus the first submenu item
      const items = getSubmenuItems();
      if (items.length) items[0].focus();
    });
  }

  close() {
    this.closeNested();
    const triggerBtn = this.activeBtn;
    if (this.active) {
      this.active.remove();
      this.active = null;
    }
    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', 'false');
      this.activeBtn = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    return triggerBtn;
  }

  toggleNested(btn, submenuEl, menuBarHeight) {
    if (this._nestedBtn === btn) {
      this.closeNested();
      return;
    }
    this.closeNested();

    const rect = btn.getBoundingClientRect();
    submenuEl.style.left = `${rect.right + 2}px`;
    submenuEl.style.top = `${rect.top}px`;

    document.body.appendChild(submenuEl);
    this._nestedActive = submenuEl;
    this._nestedBtn = btn;

    // Reposition if it overflows
    requestAnimationFrame(() => {
      const menuRect = submenuEl.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        submenuEl.style.left = `${rect.left - menuRect.width - 2}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        const mbh = menuBarHeight || MENUBAR_HEIGHT;
        submenuEl.style.top = `${Math.max(mbh, window.innerHeight - menuRect.height)}px`;
      }
    });
  }

  closeNested() {
    if (this._nestedActive) {
      this._nestedActive.remove();
      this._nestedActive = null;
      this._nestedBtn = null;
    }
  }
}

// === Submenu builders ===

/**
 * Build the Export All submenu.
 *
 * @param {boolean} hasResults - Whether any session has completed results
 * @param {Function} onExport - Callback receiving format string ('json'|'csv'|'pdf')
 * @returns {HTMLElement}
 */
export function buildExportAllSubmenu(hasResults, onExport) {
  const menu = document.createElement('div');
  menu.className = 'app-menubar__submenu';
  menu.setAttribute('role', 'menu');

  for (const [format, label] of [
    ['json', 'Export All as JSON'],
    ['csv', 'Export All as CSV'],
    ['pdf', 'Export All as PDF'],
  ]) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'app-menubar__submenu-item';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    if (!hasResults) item.disabled = true;
    item.addEventListener('click', () => onExport(format));
    menu.appendChild(item);
  }

  return menu;
}

/**
 * Build the Window submenu.
 *
 * @param {Array<{id: string, fileName: string}>} activeSessions - Sessions with main windows
 * @param {boolean} hasWindows - Whether any session has a main window
 * @param {object} actions - Callback object { onTile, onCascade, onCloseAll, onFocus(sessionId) }
 * @returns {HTMLElement}
 */
export function buildWindowSubmenu(activeSessions, hasWindows, actions) {
  const menu = document.createElement('div');
  menu.className = 'app-menubar__submenu';
  menu.setAttribute('role', 'menu');

  // Tile
  const tileItem = submenuItem('Tile All', actions.onTile);
  if (!hasWindows) tileItem.disabled = true;
  menu.appendChild(tileItem);

  // Cascade
  const cascadeItem = submenuItem('Cascade All', actions.onCascade);
  if (!hasWindows) cascadeItem.disabled = true;
  menu.appendChild(cascadeItem);

  // Close All
  const closeAllItem = submenuItem('Close All', actions.onCloseAll);
  if (!hasWindows) closeAllItem.disabled = true;
  menu.appendChild(closeAllItem);

  // Divider + window list
  if (activeSessions.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'app-menubar__submenu-divider';
    divider.setAttribute('role', 'separator');
    menu.appendChild(divider);

    for (const session of activeSessions) {
      const item = submenuItem(session.fileName, () => actions.onFocus(session.id));
      menu.appendChild(item);
    }
  }

  return menu;
}

/**
 * Build the Advanced submenu.
 *
 * @param {Function} onTestingTools - Callback receiving the button element for nested submenu
 * @returns {HTMLElement}
 */
export function buildAdvancedSubmenu(onTestingTools) {
  const menu = document.createElement('div');
  menu.className = 'app-menubar__submenu';
  menu.setAttribute('role', 'menu');

  const testingItem = document.createElement('button');
  testingItem.type = 'button';
  testingItem.className = 'app-menubar__submenu-item app-menubar__submenu-item--parent';
  testingItem.setAttribute('role', 'menuitem');
  testingItem.setAttribute('aria-haspopup', 'true');
  testingItem.textContent = 'Testing Tools';
  testingItem.addEventListener('click', (e) => {
    e.stopPropagation();
    onTestingTools(testingItem);
  });
  menu.appendChild(testingItem);

  return menu;
}

/**
 * Build the Testing Tools nested submenu.
 *
 * @param {Array} testPdfs - Test PDF definitions
 * @param {Map<string, Array>} categories - Test PDFs grouped by category
 * @param {object} actions - { onLoadPdfs(pdfs), onBookmark() }
 * @returns {HTMLElement}
 */
export function buildTestingToolsSubmenu(testPdfs, categories, actions) {
  const menu = document.createElement('div');
  menu.className = 'app-menubar__submenu';
  menu.setAttribute('role', 'menu');
  menu.style.maxHeight = '70vh';
  menu.style.overflowY = 'auto';

  // Load All
  menu.appendChild(submenuItem(`Load All (${testPdfs.length})`, () => actions.onLoadPdfs(testPdfs)));

  // Load All Pass
  const passPdfs = testPdfs.filter(p => p.expect === 'pass');
  menu.appendChild(submenuItem(`Load All Pass (${passPdfs.length})`, () => actions.onLoadPdfs(passPdfs)));

  // Load All Fail
  const failPdfs = testPdfs.filter(p => p.expect === 'fail');
  menu.appendChild(submenuItem(`Load All Fail (${failPdfs.length})`, () => actions.onLoadPdfs(failPdfs)));

  // Individual test PDFs grouped by category
  for (const [category, pdfs] of categories) {
    const divider = document.createElement('div');
    divider.className = 'app-menubar__submenu-divider';
    divider.setAttribute('role', 'separator');
    menu.appendChild(divider);

    const heading = document.createElement('div');
    heading.className = 'app-menubar__submenu-heading';
    heading.textContent = category;
    heading.style.cssText = 'padding: 4px 12px; font-size: 11px; font-weight: 600; color: var(--color-text-muted, #888); text-transform: uppercase; letter-spacing: 0.05em;';
    menu.appendChild(heading);

    for (const pdf of pdfs) {
      const badge = pdf.expect === 'pass' ? '\u2705'
        : pdf.expect === 'fail' ? '\u274C'
        : pdf.expect === 'error' ? '\u26A0\uFE0F'
        : '\u2753';
      menu.appendChild(submenuItem(`${badge}  ${pdf.name}`, () => actions.onLoadPdfs([pdf])));
    }
  }

  // Bookmarks / Outlines placeholder
  const bookmarkDivider = document.createElement('div');
  bookmarkDivider.className = 'app-menubar__submenu-divider';
  bookmarkDivider.setAttribute('role', 'separator');
  menu.appendChild(bookmarkDivider);

  const bookmarkHeading = document.createElement('div');
  bookmarkHeading.className = 'app-menubar__submenu-heading';
  bookmarkHeading.textContent = 'Bookmarks / Outlines';
  bookmarkHeading.style.cssText = 'padding: 4px 12px; font-size: 11px; font-weight: 600; color: var(--color-text-muted, #888); text-transform: uppercase; letter-spacing: 0.05em;';
  menu.appendChild(bookmarkHeading);

  menu.appendChild(submenuItem('\u{1F6A7}  Coming soon\u2026', actions.onBookmark));

  return menu;
}
