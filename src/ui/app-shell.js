/**
 * App shell — WinBox-based window management with multi-PDF support.
 *
 * Manages the application lifecycle: menu bar + welcome dialog -> progress -> results.
 * Each analyzed PDF spawns its own results window with a scoped event bus,
 * so finding selection in one window doesn't affect others.
 *
 * The persistent menu bar provides app-level actions (Open, Export All,
 * Window management, About, Help). Per-session toolbars provide session-scoped
 * actions (floating panels, per-file export).
 */
import WinBox from 'winbox/src/js/winbox.js';
import { createSessionBus } from './state.js';
import { createUploadZone, filterPdfs } from './drop-zone.js';
import { renderSummaryPanel } from './report.js';
import { renderFindingsPanel } from './findings-list.js';
import { renderDetailsPanel } from './details.js';
import { renderTreeExplorer } from './tree-explorer.js';
import { renderFontTable } from './font-table.js';
import { renderImageTable } from './image-table.js';
import { initExport } from './export.js';

import { getTestPdfsByCategory, fetchTestPdf, testPdfs } from './dev-test-pdfs.js';

import 'winbox/dist/css/winbox.min.css';
import 'winbox/dist/css/themes/white.min.css';


/** Menu bar height in pixels — must match --menubar-height in CSS. */
const MENUBAR_HEIGHT = 28;

/** Map of floating panel names to their render functions. */
const PANEL_RENDERERS = {
  structure: renderTreeExplorer,
  fonts: renderFontTable,
  images: renderImageTable,
};

/** Floating panel definitions (opened via toolbar). */
const FLOATING_PANELS = [
  { id: 'structure', title: 'Structure Tree' },
  { id: 'fonts', title: 'Font Inventory' },
  { id: 'images', title: 'Image Inventory' },
];

/** Cascade offset for stacking multiple results windows. */
const CASCADE_OFFSET = 30;

/**
 * Create a floating panel's content element and render into it.
 *
 * Only used for floating tool panels (structure, fonts, images).
 *
 * @param {string} name - Panel identifier (structure | fonts | images)
 * @param {object} data - Audit result data
 * @returns {HTMLElement}
 */
export function createPanelElement(name, data) {
  const el = document.createElement('div');
  el.style.overflow = 'auto';
  el.style.padding = '16px';
  el.style.fontFamily = 'var(--font-family)';
  el.style.height = '100%';

  const render = PANEL_RENDERERS[name];
  if (render) render(el, data);

  return el;
}

/** Generate a unique session ID. */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Initialize the application shell.
 *
 * @param {HTMLElement} container - The #app element
 * @param {Worker} worker - The audit Web Worker
 */
export function initAppShell(container, worker) {
  const root = document.createElement('div');
  root.className = 'app-root';
  root.style.cssText = 'flex:1;position:relative;';

  /** @type {Map<string, object>} Active sessions by sessionId */
  const sessions = new Map();

  let welcomeWin = null;
  let sessionCount = 0;

  // Hidden file input for "Open File(s)"
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,application/pdf';
  fileInput.multiple = true;
  fileInput.className = 'visually-hidden';
  fileInput.setAttribute('aria-label', 'Choose PDF files');
  container.appendChild(fileInput);

  fileInput.addEventListener('change', () => {
    const files = filterPdfs(fileInput.files);
    if (files.length > 0) handleFiles(files);
    fileInput.value = '';
  });

  // Create menu bar and app root
  const menuBar = createMenuBar();
  container.appendChild(menuBar);
  container.appendChild(root);

  // Show welcome on init
  showWelcome();

  // Route worker messages to sessions
  worker.addEventListener('message', (e) => {
    const { type, sessionId, ...rest } = e.data;
    const session = sessions.get(sessionId);
    if (!session) return;

    switch (type) {
      case 'progress':
        onProgress(session, rest);
        break;
      case 'result':
        onResult(session, rest);
        break;
      case 'error':
        onError(session, rest);
        break;
    }
  });

  // === Menu Bar ===

  function createMenuBar() {
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

      const action = btn.dataset.action;
      switch (action) {
        case 'open-files':
          if (welcomeWin) {
            welcomeWin.focus();
          } else {
            showWelcome(null, { closable: sessions.size > 0 });
          }
          break;
        case 'export-all':
          toggleSubmenu(btn, buildExportAllSubmenu());
          break;
        case 'window-menu':
          toggleSubmenu(btn, buildWindowSubmenu());
          break;
        case 'about':
          showAbout();
          break;
        case 'help':
          showHelp();
          break;
        case 'advanced-menu':
          toggleSubmenu(btn, buildAdvancedSubmenu());
          break;
      }
    });

    return nav;
  }

  function menuBtn(label, action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'app-menubar__btn';
    btn.dataset.action = action;
    btn.setAttribute('role', 'menuitem');
    btn.textContent = label;
    return btn;
  }

  function menuSep() {
    const sep = document.createElement('span');
    sep.className = 'app-menubar__sep';
    sep.setAttribute('aria-hidden', 'true');
    return sep;
  }

  // === Submenus ===

  let activeSubmenu = null;
  let activeSubmenuBtn = null;

  function toggleSubmenu(btn, submenuEl) {
    if (activeSubmenuBtn === btn) {
      closeSubmenu();
      return;
    }
    closeSubmenu();
    openSubmenu(btn, submenuEl);
  }

  function openSubmenu(btn, submenuEl) {
    const rect = btn.getBoundingClientRect();
    submenuEl.style.left = `${rect.left}px`;

    document.body.appendChild(submenuEl);
    activeSubmenu = submenuEl;
    activeSubmenuBtn = btn;
    btn.setAttribute('aria-expanded', 'true');

    // Close on outside click (next tick to avoid immediate close)
    requestAnimationFrame(() => {
      document.addEventListener('click', onSubmenuOutsideClick);
      document.addEventListener('keydown', onSubmenuEscape);
    });
  }

  function closeSubmenu() {
    closeNestedSubmenu();
    if (activeSubmenu) {
      activeSubmenu.remove();
      activeSubmenu = null;
    }
    if (activeSubmenuBtn) {
      activeSubmenuBtn.setAttribute('aria-expanded', 'false');
      activeSubmenuBtn = null;
    }
    document.removeEventListener('click', onSubmenuOutsideClick);
    document.removeEventListener('keydown', onSubmenuEscape);
  }

  function onSubmenuOutsideClick(e) {
    if (activeSubmenu && !activeSubmenu.contains(e.target) && e.target !== activeSubmenuBtn) {
      closeSubmenu();
    }
  }

  function onSubmenuEscape(e) {
    if (e.key === 'Escape') {
      closeSubmenu();
    }
  }

  function buildExportAllSubmenu() {
    const menu = document.createElement('div');
    menu.className = 'app-menubar__submenu';
    menu.setAttribute('role', 'menu');

    const hasResults = [...sessions.values()].some((s) => s.data);

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
      item.addEventListener('click', () => {
        closeSubmenu();
        exportAll(format);
      });
      menu.appendChild(item);
    }

    return menu;
  }

  function buildWindowSubmenu() {
    const menu = document.createElement('div');
    menu.className = 'app-menubar__submenu';
    menu.setAttribute('role', 'menu');

    const hasWindows = [...sessions.values()].some((s) => s.mainWin);

    // Tile
    const tileItem = submenuItem('Tile All', () => {
      closeSubmenu();
      tileWindows();
    });
    if (!hasWindows) tileItem.disabled = true;
    menu.appendChild(tileItem);

    // Cascade
    const cascadeItem = submenuItem('Cascade All', () => {
      closeSubmenu();
      cascadeWindows();
    });
    if (!hasWindows) cascadeItem.disabled = true;
    menu.appendChild(cascadeItem);

    // Close All
    const closeAllItem = submenuItem('Close All', () => {
      closeSubmenu();
      closeAllWindows();
    });
    if (!hasWindows) closeAllItem.disabled = true;
    menu.appendChild(closeAllItem);

    // Divider + window list
    const activeSessions = [...sessions.values()].filter((s) => s.mainWin);
    if (activeSessions.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'app-menubar__submenu-divider';
      divider.setAttribute('role', 'separator');
      menu.appendChild(divider);

      for (const session of activeSessions) {
        const item = submenuItem(session.fileName, () => {
          closeSubmenu();
          focusWindow(session.id);
        });
        menu.appendChild(item);
      }
    }

    return menu;
  }

  function buildAdvancedSubmenu() {
    const menu = document.createElement('div');
    menu.className = 'app-menubar__submenu';
    menu.setAttribute('role', 'menu');

    // Testing Tools — opens a nested submenu
    const testingItem = document.createElement('button');
    testingItem.type = 'button';
    testingItem.className = 'app-menubar__submenu-item app-menubar__submenu-item--parent';
    testingItem.setAttribute('role', 'menuitem');
    testingItem.setAttribute('aria-haspopup', 'true');
    testingItem.textContent = 'Testing Tools';
    testingItem.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNestedSubmenu(testingItem, buildTestingToolsSubmenu());
    });
    menu.appendChild(testingItem);

    return menu;
  }

  // --- Nested submenu support ---

  let activeNestedSubmenu = null;
  let activeNestedBtn = null;

  function toggleNestedSubmenu(btn, submenuEl) {
    if (activeNestedBtn === btn) {
      closeNestedSubmenu();
      return;
    }
    closeNestedSubmenu();

    const rect = btn.getBoundingClientRect();
    submenuEl.style.left = `${rect.right + 2}px`;
    submenuEl.style.top = `${rect.top}px`;

    document.body.appendChild(submenuEl);
    activeNestedSubmenu = submenuEl;
    activeNestedBtn = btn;

    // Reposition if it overflows the right edge
    requestAnimationFrame(() => {
      const menuRect = submenuEl.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        submenuEl.style.left = `${rect.left - menuRect.width - 2}px`;
      }
      // Reposition if it overflows the bottom edge
      if (menuRect.bottom > window.innerHeight) {
        submenuEl.style.top = `${Math.max(MENUBAR_HEIGHT, window.innerHeight - menuRect.height)}px`;
      }
    });
  }

  function closeNestedSubmenu() {
    if (activeNestedSubmenu) {
      activeNestedSubmenu.remove();
      activeNestedSubmenu = null;
      activeNestedBtn = null;
    }
  }

  function buildTestingToolsSubmenu() {
    const menu = document.createElement('div');
    menu.className = 'app-menubar__submenu';
    menu.setAttribute('role', 'menu');
    menu.style.maxHeight = '70vh';
    menu.style.overflowY = 'auto';

    // Load All
    menu.appendChild(submenuItem(`Load All (${testPdfs.length})`, () => {
      closeSubmenu();
      handleTestPdfs(testPdfs);
    }));

    // Load All Pass
    const passPdfs = testPdfs.filter(p => p.expect === 'pass');
    menu.appendChild(submenuItem(`Load All Pass (${passPdfs.length})`, () => {
      closeSubmenu();
      handleTestPdfs(passPdfs);
    }));

    // Load All Fail
    const failPdfs = testPdfs.filter(p => p.expect === 'fail');
    menu.appendChild(submenuItem(`Load All Fail (${failPdfs.length})`, () => {
      closeSubmenu();
      handleTestPdfs(failPdfs);
    }));

    // Individual test PDFs grouped by category
    const groups = getTestPdfsByCategory();
    for (const [category, pdfs] of groups) {
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
        menu.appendChild(submenuItem(`${badge}  ${pdf.name}`, () => {
          closeSubmenu();
          handleTestPdfs([pdf]);
        }));
      }
    }

    // Bookmarks / Outlines — placeholder (no test PDFs available yet)
    const bookmarkDivider = document.createElement('div');
    bookmarkDivider.className = 'app-menubar__submenu-divider';
    bookmarkDivider.setAttribute('role', 'separator');
    menu.appendChild(bookmarkDivider);

    const bookmarkHeading = document.createElement('div');
    bookmarkHeading.className = 'app-menubar__submenu-heading';
    bookmarkHeading.textContent = 'Bookmarks / Outlines';
    bookmarkHeading.style.cssText = 'padding: 4px 12px; font-size: 11px; font-weight: 600; color: var(--color-text-muted, #888); text-transform: uppercase; letter-spacing: 0.05em;';
    menu.appendChild(bookmarkHeading);

    menu.appendChild(submenuItem('\u{1F6A7}  Coming soon\u2026', () => {
      closeSubmenu();
      showBookmarkPlaceholder();
    }));

    return menu;
  }

  function showBookmarkPlaceholder() {
    const content = document.createElement('div');
    content.className = 'dialog-content';
    content.innerHTML = `
      <h2>Bookmarks / Outlines</h2>
      <p>No CORS-friendly test PDFs for bookmarks have been found
      in the public test corpus repositories yet.</p>
      <p>The audit checks for <code>/Outlines</code> in the document catalog
      and reports whether bookmarks exist. It's a simple metadata check,
      so it doesn't need complex pass/fail test fixtures.</p>
      <h3>Can you help?</h3>
      <p>If you know of a public, CORS-accessible PDF with bookmarks (or without),
      open an issue on GitHub and we'll add it to the test suite.</p>
    `;

    new WinBox({
      title: 'Test PDFs: Bookmarks',
      mount: content,
      root,
      x: 'center',
      y: 'center',
      width: 440,
      height: 340,
      top: MENUBAR_HEIGHT,
      overflow: true,
      class: ['white', 'no-full', 'no-max', 'no-min'],
      border: 1,
    });
  }

  async function handleTestPdfs(pdfs) {
    closeWelcome();

    for (const pdf of pdfs) {
      const sessionId = generateSessionId();
      const bus = createSessionBus();

      // Derive a display name from the PDF URL
      const urlPath = new URL(pdf.url).pathname;
      const fileName = decodeURIComponent(urlPath.split('/').pop());

      const session = {
        id: sessionId,
        fileName,
        bus,
        file: null,
        progressWin: null,
        progressFill: null,
        progressPhase: null,
        progressStatus: null,
        mainWin: null,
        floatingPanels: new Map(),
        data: null,
        cascadeIndex: sessionCount++,
      };

      sessions.set(sessionId, session);
      showProgressDialog(session);

      // Fetch in the background, then post to worker
      fetchTestPdf(pdf)
        .then(async (file) => {
          session.file = file;
          const buffer = await file.arrayBuffer();
          worker.postMessage(
            { type: 'audit', buffer, fileName: file.name, sessionId },
            [buffer]
          );
        })
        .catch((err) => {
          onError(session, { message: `Fetch failed: ${err.message}` });
        });
    }
  }

  function submenuItem(label, onClick) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'app-menubar__submenu-item';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    item.addEventListener('click', onClick);
    return item;
  }

  // === Window Management ===

  function tileWindows() {
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

  function cascadeWindows() {
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

  function closeAllWindows() {
    const ids = [...sessions.keys()];
    for (const id of ids) {
      const session = sessions.get(id);
      if (session && session.mainWin) {
        session.mainWin.close(); // triggers onclose -> cleanupSession
      }
    }
  }

  function focusWindow(sessionId) {
    const session = sessions.get(sessionId);
    if (session && session.mainWin) {
      if (session.mainWin.min) session.mainWin.restore();
      session.mainWin.focus();
    }
  }

  function exportAll(format) {
    let delay = 0;
    for (const session of sessions.values()) {
      if (!session.data) continue;
      const exportFns = initExport(session.data);
      // Stagger downloads to avoid browser blocking
      setTimeout(() => {
        switch (format) {
          case 'json':
            exportFns.exportJSON();
            break;
          case 'csv':
            exportFns.exportCSV();
            break;
          case 'pdf':
            exportFns.exportPDF();
            break;
        }
      }, delay);
      delay += 300;
    }
  }

  // === About / Help Dialogs ===

  let aboutWin = null;
  function showAbout() {
    if (aboutWin) {
      aboutWin.focus();
      return;
    }
    const content = document.createElement('div');
    content.className = 'dialog-content';
    content.innerHTML = `
      <h2>PDF-A-go-actionable</h2>
      <p style="color:var(--color-text);font-size:var(--font-size-base);">Version 1.0.0</p>
      <p>Free, browser-based PDF accessibility checker. Everything runs
      in your browser. No files are uploaded, no accounts needed.</p>
      <p>Covers the 13-point PDF accessibility checklist: 10 automated
      checks and 3 manual review items.</p>
      <h3>Built With</h3>
      <ul>
        <li><strong>pdf-lib</strong> -- PDF object access</li>
        <li><strong>fflate</strong> -- stream decompression</li>
        <li><strong>WinBox</strong> -- window management</li>
      </ul>
      <p>Licensed under MIT.</p>
    `;

    aboutWin = new WinBox({
      title: 'About',
      mount: content,
      root,
      x: 'center',
      y: 'center',
      width: 420,
      height: 380,
      top: MENUBAR_HEIGHT,
      overflow: true,
      class: ['white', 'no-full', 'no-max', 'no-min', 'no-resize'],
      border: 1,
      onclose: function () {
        aboutWin = null;
      },
    });
  }

  let helpWin = null;
  function showHelp() {
    if (helpWin) {
      helpWin.focus();
      return;
    }
    const content = document.createElement('div');
    content.className = 'dialog-content';
    content.innerHTML = `
      <h2>How to Use</h2>
      <ol>
        <li>Click <strong>Open File(s)</strong> in the menu bar, or drag PDFs onto the welcome window</li>
        <li>Wait for each analysis to complete</li>
        <li>Review findings in the results window. Click any finding for details</li>
        <li>Use the toolbar to open Structure Tree, Font, or Image panels</li>
        <li>Export results as JSON, CSV, or PDF</li>
      </ol>
      <h3>Tips</h3>
      <ul>
        <li>Open multiple PDFs at once for batch analysis</li>
        <li>Use <strong>Window &gt; Tile All</strong> to see results side by side</li>
        <li>Each result window has its own export and panel buttons</li>
        <li><strong>Export All</strong> downloads results for every open analysis</li>
      </ul>
      <h3>Keyboard Shortcuts</h3>
      <ul>
        <li><strong>Tab</strong> -- navigate between controls</li>
        <li><strong>Enter / Space</strong> -- activate buttons</li>
        <li><strong>Escape</strong> -- close menus</li>
      </ul>
    `;

    helpWin = new WinBox({
      title: 'Help',
      mount: content,
      root,
      x: 'center',
      y: 'center',
      width: 480,
      height: 440,
      top: MENUBAR_HEIGHT,
      overflow: true,
      class: ['white', 'no-full', 'no-max', 'no-min'],
      border: 1,
      onclose: function () {
        helpWin = null;
      },
    });
  }

  // === Welcome ===

  function showWelcome(errorMessage, { closable = false } = {}) {
    if (welcomeWin) {
      welcomeWin.focus();
      return;
    }

    const content = document.createElement('div');
    content.className = 'welcome';

    if (errorMessage) {
      const errorEl = document.createElement('div');
      errorEl.className = 'welcome__error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = errorMessage;
      content.appendChild(errorEl);
    }

    content.insertAdjacentHTML(
      'beforeend',
      `
      <h1 class="welcome__title">PDF-A-go-actionable</h1>
      <p class="welcome__tagline">Free, browser-based PDF accessibility checker</p>
      <ul class="welcome__features">
        <li>Runs entirely in your browser, no file uploads</li>
        <li>Fix-it guidance for every finding</li>
        <li>Covers the UNDRR 13-point accessibility checklist</li>
      </ul>
    `
    );

    const uploadWrapper = document.createElement('div');
    uploadWrapper.className = 'welcome__upload';
    uploadWrapper.appendChild(createUploadZone(handleFiles));
    content.appendChild(uploadWrapper);

    const version = document.createElement('p');
    version.className = 'welcome__version';
    version.textContent = 'v1.0.0';
    content.appendChild(version);

    const classes = ['white', 'no-full', 'no-max', 'no-min', 'no-resize'];
    if (!closable) classes.push('no-close');

    welcomeWin = new WinBox({
      title: 'Welcome',
      mount: content,
      root,
      x: 'center',
      y: 'center',
      width: 480,
      height: 460,
      top: MENUBAR_HEIGHT,
      class: classes,
      border: 1,
      ...(closable ? { onclose: function () { welcomeWin = null; } } : {}),
    });
  }

  function closeWelcome() {
    if (welcomeWin) {
      const win = welcomeWin;
      welcomeWin = null;
      win.onclose = null;
      win.close();
    }
  }

  // === File handling ===

  async function handleFiles(files) {
    closeWelcome();

    for (const file of files) {
      const sessionId = generateSessionId();
      const bus = createSessionBus();

      const session = {
        id: sessionId,
        fileName: file.name,
        bus,
        file,
        progressWin: null,
        progressFill: null,
        progressPhase: null,
        progressStatus: null,
        mainWin: null,
        floatingPanels: new Map(),
        data: null,
        cascadeIndex: sessionCount++,
      };

      sessions.set(sessionId, session);

      showProgressDialog(session);

      const buffer = await file.arrayBuffer();
      worker.postMessage(
        { type: 'audit', buffer, fileName: file.name, sessionId },
        [buffer]
      );
    }
  }

  // === Progress dialog ===

  function showProgressDialog(session) {
    const content = document.createElement('div');
    content.className = 'progress-dialog';
    content.innerHTML = `
      <p class="progress-dialog__file">${escapeHtml(session.fileName)}</p>
      <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar__fill" style="width:0%"></div>
      </div>
      <p class="progress-dialog__phase">Starting analysis...</p>
      <div role="status" aria-live="polite" class="visually-hidden">Starting analysis</div>
    `;

    session.progressFill = content.querySelector('.progress-bar__fill');
    session.progressPhase = content.querySelector('.progress-dialog__phase');
    session.progressStatus = content.querySelector('[role="status"]');

    session.progressWin = new WinBox({
      title: `Analyzing: ${session.fileName}`,
      mount: content,
      root,
      x: 'center',
      y: 'center',
      width: 400,
      height: 180,
      top: MENUBAR_HEIGHT,
      class: [
        'white',
        'no-full',
        'no-max',
        'no-min',
        'no-resize',
        'no-close',
        'no-move',
      ],
      border: 1,
    });
  }

  function onProgress(session, { phase, percent }) {
    if (!session.progressFill) return;
    session.progressFill.style.width = `${percent}%`;
    session.progressFill.parentElement.setAttribute('aria-valuenow', String(percent));
    session.progressPhase.textContent = `${phase} (${percent}%)`;
    session.progressStatus.textContent = `Analyzing: ${phase} (${percent}%)`;
  }

  // === Results ===

  function onResult(session, data) {
    closeProgressDialog(session);
    session.data = data;
    showResults(session, data);
  }

  function showResults(session, data) {
    const content = document.createElement('div');
    content.className = 'results-main';

    // Summary section
    const summaryEl = document.createElement('div');
    summaryEl.className = 'results-summary';
    renderSummaryPanel(summaryEl, data, session.bus);
    content.appendChild(summaryEl);

    // Toolbar (session-scoped actions only)
    const toolbar = document.createElement('div');
    toolbar.className = 'results-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Report tools');

    for (const panel of FLOATING_PANELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toolbar-btn';
      btn.dataset.panel = panel.id;
      btn.textContent = panel.title;
      toolbar.appendChild(btn);
    }

    toolbar.appendChild(toolbarSep());

    // View PDF button
    const viewPdfBtn = document.createElement('button');
    viewPdfBtn.type = 'button';
    viewPdfBtn.className = 'toolbar-btn';
    viewPdfBtn.dataset.action = 'view-pdf';
    viewPdfBtn.textContent = 'View PDF';
    toolbar.appendChild(viewPdfBtn);

    toolbar.appendChild(toolbarSep());

    for (const [action, label] of [
      ['export-json', 'JSON'],
      ['export-csv', 'CSV'],
      ['export-pdf', 'PDF'],
    ]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toolbar-btn';
      btn.dataset.action = action;
      btn.textContent = `Export ${label}`;
      toolbar.appendChild(btn);
    }

    content.appendChild(toolbar);

    // Split view: findings + details (using scoped bus)
    const split = document.createElement('div');
    split.className = 'results-split';

    const findingsEl = document.createElement('div');
    findingsEl.className = 'results-findings';
    renderFindingsPanel(findingsEl, data, session.bus);
    split.appendChild(findingsEl);

    const detailsEl = document.createElement('div');
    detailsEl.className = 'results-details';
    renderDetailsPanel(detailsEl, data, session.bus);
    split.appendChild(detailsEl);

    content.appendChild(split);

    // Wire toolbar events
    toolbar.addEventListener('click', (e) => {
      const panelBtn = e.target.closest('[data-panel]');
      if (panelBtn) {
        toggleFloatingPanel(session, panelBtn.dataset.panel);
        return;
      }
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        handleToolbarAction(session, actionBtn.dataset.action);
      }
    });

    // Create results window with cascade positioning
    requestAnimationFrame(() => {
      const cw = root.clientWidth;
      const ch = root.clientHeight;
      const w = Math.floor(cw * 0.85);
      const h = Math.floor(ch * 0.85);

      const cascadeX = 40 + (session.cascadeIndex % 8) * CASCADE_OFFSET;
      const cascadeY = MENUBAR_HEIGHT + 30 + (session.cascadeIndex % 8) * CASCADE_OFFSET;

      session.mainWin = new WinBox({
        title: `Results: ${data.meta.fileName || session.fileName}`,
        mount: content,
        root,
        x: cascadeX,
        y: cascadeY,
        width: w,
        height: h,
        top: MENUBAR_HEIGHT,
        overflow: true,
        class: ['white'],
        border: 1,
        onclose: function () {
          cleanupSession(session);
          if (sessions.size === 0) {
            sessionCount = 0;
            setTimeout(showWelcome, 0);
          }
        },
      });
    });
  }

  // === Floating panels ===

  function toggleFloatingPanel(session, id) {
    if (session.floatingPanels.has(id)) {
      session.floatingPanels.get(id).focus();
      return;
    }

    const def = FLOATING_PANELS.find((p) => p.id === id);
    if (!def || !session.data) return;

    const el = createPanelElement(id, session.data);
    const layout = getFloatingLayout(id, session.cascadeIndex);

    const win = new WinBox({
      title: `${def.title}: ${session.fileName}`,
      mount: el,
      root,
      class: ['white'],
      border: 1,
      top: MENUBAR_HEIGHT,
      overflow: true,
      ...layout,
      onclose: function () {
        session.floatingPanels.delete(id);
      },
    });

    session.floatingPanels.set(id, win);
  }

  function getFloatingLayout(id, cascadeIndex) {
    const cw = root.clientWidth;
    const ch = root.clientHeight;
    const w = Math.min(500, Math.floor(cw * 0.4));
    const h = Math.min(450, Math.floor(ch * 0.55));
    const offsets = { structure: 0, fonts: 30, images: 60 };
    const panelOffset = offsets[id] || 0;
    const cascadeOff = (cascadeIndex % 8) * 15;

    return {
      x: Math.floor(cw * 0.55) + panelOffset + cascadeOff,
      y: MENUBAR_HEIGHT + 40 + panelOffset + cascadeOff,
      width: w,
      height: h,
    };
  }

  // === Toolbar actions (per-session) ===

  function handleToolbarAction(session, action) {
    if (action === 'view-pdf') {
      viewPdf(session);
      return;
    }

    if (!session.data) return;

    const exportFns = initExport(session.data);
    switch (action) {
      case 'export-json':
        exportFns.exportJSON();
        break;
      case 'export-csv':
        exportFns.exportCSV();
        break;
      case 'export-pdf':
        exportFns.exportPDF();
        break;
    }
  }

  function viewPdf(session) {
    if (!session.file) return;
    // Reuse existing blob URL or create a new one
    if (!session.pdfBlobUrl) {
      session.pdfBlobUrl = URL.createObjectURL(session.file);
    }
    window.open(session.pdfBlobUrl, '_blank');
  }

  // === Error handling ===

  function onError(session, { message }) {
    closeProgressDialog(session);
    sessions.delete(session.id);
    showWelcome(`Error analyzing ${session.fileName}: ${message}`);
  }

  // === Cleanup ===

  function closeProgressDialog(session) {
    if (session.progressWin) {
      session.progressWin.close();
      session.progressWin = null;
      session.progressFill = null;
      session.progressPhase = null;
      session.progressStatus = null;
    }
  }

  function cleanupSession(session) {
    for (const win of session.floatingPanels.values()) {
      win.onclose = null;
      win.close();
    }
    session.floatingPanels.clear();
    session.bus.destroy();
    if (session.pdfBlobUrl) {
      URL.revokeObjectURL(session.pdfBlobUrl);
      session.pdfBlobUrl = null;
    }
    session.file = null;
    session.mainWin = null;
    sessions.delete(session.id);
  }
}

// === Helpers ===

function toolbarSep() {
  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
