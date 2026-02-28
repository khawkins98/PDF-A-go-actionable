/**
 * App shell — WinBox-based window management with multi-PDF support.
 *
 * Manages the application lifecycle: menu bar + welcome dialog -> progress -> results.
 * Each analyzed PDF spawns its own results window with a scoped event bus,
 * so finding selection in one window doesn't affect others.
 *
 * Menu bar, window layout, and dialogs are handled by extracted modules.
 * This file orchestrates sessions, file handling, worker routing, and results display.
 */
import WinBox from 'winbox/src/js/winbox.js';
import { createSessionBus } from './state.js';
import { createUploadZone, filterPdfs } from './drop-zone.js';
import { renderSummaryPanel } from './report.js';
import { renderFindingsPanel } from './findings-list.js';
import { renderDetailsPanel } from './details.js';
import { renderDashboard } from './dashboard.js';
import { renderTreeExplorer } from './tree-explorer.js';
import { renderFontTable } from './font-table.js';
import { renderImageTable } from './image-table.js';
import { renderPreviewPanel } from './pdf-preview.js';
import { initExport } from './export.js';

import { getTestPdfsByCategory, fetchTestPdf, testPdfs } from './dev-test-pdfs.js';

import {
  MENUBAR_HEIGHT,
  createMenuBar,
  setupMenuBarKeyNav,
  SubmenuController,
  buildExportAllSubmenu,
  buildWindowSubmenu,
  buildAdvancedSubmenu,
  buildTestingToolsSubmenu,
} from './menu-bar.js';
import {
  CASCADE_OFFSET,
  tileWindows,
  cascadeWindows,
  closeAllWindows,
  focusWindow,
  getFloatingLayout,
} from './window-manager.js';
import { showAboutDialog, showHelpDialog, showBookmarkPlaceholder } from './dialogs.js';

import 'winbox/dist/css/winbox.min.css';
import 'winbox/dist/css/themes/white.min.css';


/** Map of floating panel names to their render functions. */
const PANEL_RENDERERS = {
  structure: renderTreeExplorer,
  fonts: renderFontTable,
  images: renderImageTable,
  preview: renderPreviewPanel,
};

/** Floating panel definitions (opened via toolbar). */
const FLOATING_PANELS = [
  { id: 'structure', title: 'Structure Tree' },
  { id: 'fonts', title: 'Font Inventory' },
  { id: 'images', title: 'Image Inventory' },
  { id: 'preview', title: 'PDF Preview' },
];

/**
 * Create a floating panel's content element and render into it.
 *
 * @param {string} name - Panel identifier (structure | fonts | images | preview)
 * @param {object} data - Audit result data
 * @param {object} [session] - Session object (required for preview panel)
 * @returns {HTMLElement}
 */
export function createPanelElement(name, data, session) {
  const el = document.createElement('div');
  el.style.overflow = 'auto';
  el.style.padding = name === 'preview' ? '0' : '16px';
  el.style.fontFamily = 'var(--font-family)';
  el.style.height = '100%';

  const render = PANEL_RENDERERS[name];
  if (render) {
    if (name === 'preview' && session) {
      render(el, data, session);
    } else if (name === 'structure' && session) {
      render(el, data, session.bus);
    } else {
      render(el, data);
    }
  }

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

  // Create menu bar with action dispatch
  const menuBar = createMenuBar((action, btn) => {
    switch (action) {
      case 'open-files':
        if (welcomeWin) {
          welcomeWin.focus();
        } else {
          showWelcome(null, { closable: sessions.size > 0 });
        }
        break;
      case 'export-all':
        submenuCtrl.toggle(btn, buildExportAllSubmenu(
          [...sessions.values()].some((s) => s.data),
          (format) => { submenuCtrl.close(); exportAll(format); }
        ));
        break;
      case 'window-menu': {
        const activeSessions = [...sessions.values()].filter((s) => s.mainWin);
        const hasWindows = activeSessions.length > 0;
        submenuCtrl.toggle(btn, buildWindowSubmenu(activeSessions, hasWindows, {
          onTile: () => { submenuCtrl.close(); tileWindows(sessions, root); },
          onCascade: () => { submenuCtrl.close(); cascadeWindows(sessions, root); },
          onCloseAll: () => { submenuCtrl.close(); closeAllWindows(sessions); },
          onFocus: (id) => { submenuCtrl.close(); focusWindow(sessions, id); },
        }));
        break;
      }
      case 'about':
        showAbout();
        break;
      case 'help':
        showHelp();
        break;
      case 'advanced-menu':
        submenuCtrl.toggle(btn, buildAdvancedSubmenu((testingBtn) => {
          submenuCtrl.toggleNested(testingBtn, buildTestingToolsSubmenu(
            testPdfs,
            getTestPdfsByCategory(),
            {
              onLoadPdfs: (pdfs) => { submenuCtrl.close(); handleTestPdfs(pdfs); },
              onBookmark: () => { submenuCtrl.close(); showBookmarkPlaceholder(root, WinBox); },
            }
          ), MENUBAR_HEIGHT);
        }));
        break;
    }
  });

  const submenuCtrl = new SubmenuController(menuBar);
  setupMenuBarKeyNav(menuBar, submenuCtrl);

  container.appendChild(menuBar);
  container.appendChild(root);

  // Persistent live region for announcing errors to screen readers
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'assertive');
  liveRegion.className = 'visually-hidden';
  container.appendChild(liveRegion);

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

  // === About / Help (singleton dialogs) ===

  let aboutWin = null;
  let aboutTrigger = null;
  function showAbout() {
    if (aboutWin) {
      aboutWin.focus();
      return;
    }
    aboutTrigger = document.activeElement;
    aboutWin = showAboutDialog(root, WinBox, function () {
      aboutWin = null;
      if (aboutTrigger) { aboutTrigger.focus(); aboutTrigger = null; }
    });
  }

  let helpWin = null;
  let helpTrigger = null;
  function showHelp() {
    if (helpWin) {
      helpWin.focus();
      return;
    }
    helpTrigger = document.activeElement;
    helpWin = showHelpDialog(root, WinBox, function () {
      helpWin = null;
      if (helpTrigger) { helpTrigger.focus(); helpTrigger = null; }
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

    // Try a sample section
    const sampleSection = document.createElement('div');
    sampleSection.className = 'welcome__samples';
    sampleSection.innerHTML = '<p>Or try a sample:</p>';

    const sampleBtns = document.createElement('div');
    sampleBtns.className = 'welcome__sample-btns';

    for (const [file, label] of [
      ['sample-accessible.pdf', 'Accessible PDF'],
      ['sample-issues.pdf', 'PDF with issues'],
    ]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'welcome__sample-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => loadSample(file));
      sampleBtns.appendChild(btn);
    }

    sampleSection.appendChild(sampleBtns);
    content.appendChild(sampleSection);

    const version = document.createElement('p');
    version.className = 'welcome__version';
    version.textContent = `v1.0.0 \u00B7 ${typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'}`;
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

  // === Sample loading ===

  async function loadSample(fileName) {
    try {
      const base = import.meta.env?.BASE_URL || '/';
      const resp = await fetch(`${base}samples/${fileName}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const file = new File([blob], fileName, { type: 'application/pdf' });
      handleFiles([file]);
    } catch (err) {
      showWelcome(`Failed to load sample: ${err.message}`);
    }
  }

  // === Test PDF handling ===

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

    // When a preview alt-text label is clicked, open image inventory and scroll to match
    session.bus.on('focusImageEntry', (payload) => {
      // Ensure image inventory panel is open
      toggleFloatingPanel(session, 'images');
      const win = session.floatingPanels.get('images');
      if (!win) return;

      // Find matching row by alt text
      const rows = win.body.querySelectorAll('tr[data-alt]');
      let target = null;
      for (const row of rows) {
        if (row.dataset.alt === payload.alt) {
          target = row;
          break;
        }
      }
      if (!target) return;

      // Highlight and scroll to the row
      // Clear any previous highlights first
      for (const row of rows) row.classList.remove('image-row--focused');
      target.classList.add('image-row--focused');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Focus the window
      win.focus();
    });
  }

  function showResults(session, data) {
    const content = document.createElement('div');
    content.className = 'results-main';

    // Render dashboard as initial view
    renderDashboard(content, data, {
      onViewFullReport: () => showDetailedView(content, session, data),
      onPreviewPdf: () => toggleFloatingPanel(session, 'preview'),
      onExport: (format) => {
        const exportFns = initExport(data);
        if (format === 'json') exportFns.exportJSON();
        else if (format === 'csv') exportFns.exportCSV();
        else if (format === 'pdf') exportFns.exportPDF();
      },
      onUploadAnother: () => fileInput.click(),
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

  /**
   * Swap the results window content from dashboard to the detailed findings view.
   */
  function showDetailedView(wrapper, session, data) {
    // Abort dashboard document listeners before replacing content
    if (wrapper._dashboardAbort) {
      wrapper._dashboardAbort.abort();
      wrapper._dashboardAbort = null;
    }
    wrapper.innerHTML = '';
    wrapper.className = 'results-main';

    // Summary section
    const summaryEl = document.createElement('div');
    summaryEl.className = 'results-summary';
    renderSummaryPanel(summaryEl, data, session.bus);
    wrapper.appendChild(summaryEl);

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

    wrapper.appendChild(toolbar);

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

    wrapper.appendChild(split);

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
  }

  // === Floating panels ===

  function toggleFloatingPanel(session, id) {
    if (session.floatingPanels.has(id)) {
      session.floatingPanels.get(id).focus();
      return;
    }

    const def = FLOATING_PANELS.find((p) => p.id === id);
    if (!def || !session.data) return;

    // Preview and structure panels need the session for file access / bus
    const needsSession = id === 'preview' || id === 'structure';
    const el = createPanelElement(id, session.data, needsSession ? session : undefined);
    const layout = getFloatingLayout(id, session.cascadeIndex, root);

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
        // Clean up preview resources (PDF.js document)
        if (id === 'preview' && el._destroyPreview) {
          el._destroyPreview();
        }
        session.floatingPanels.delete(id);
      },
    });

    session.floatingPanels.set(id, win);
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

  // === Export All ===

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

  // === Error handling ===

  function onError(session, { message }) {
    closeProgressDialog(session);
    sessions.delete(session.id);
    const errorMsg = `Error analyzing ${session.fileName}: ${message}`;
    liveRegion.textContent = errorMsg;
    showWelcome(errorMsg);
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
    // Abort dashboard document listeners
    if (session.mainWin?.body) {
      const content = session.mainWin.body.firstElementChild;
      if (content?._dashboardAbort) content._dashboardAbort.abort();
    }
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
