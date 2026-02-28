// @vitest-environment happy-dom
/**
 * Tests for the app shell — floating panel creation and initAppShell integration.
 *
 * The critical contracts:
 * 1. createPanelElement must return an HTMLElement with content rendered by the appropriate render function.
 * 2. initAppShell must set up the menu bar, welcome dialog, worker message routing,
 *    window management, and floating panel lifecycle.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track all WinBox instances created across tests
const mockWinBoxInstances = [];

// Enhanced WinBox mock — supports instance tracking and method calls
vi.mock('winbox/src/js/winbox.js', () => {
  const WinBox = vi.fn(function (opts) {
    this.opts = opts;
    this.title = opts.title || '';
    this.min = false;
    this.max = false;
    this.close = vi.fn(() => {
      if (this.onclose) this.onclose();
    });
    this.focus = vi.fn();
    this.restore = vi.fn(() => {
      this.min = false;
      this.max = false;
    });
    this.resize = vi.fn();
    this.move = vi.fn();
    this.onclose = opts.onclose || null;

    // Simulate mounting content (WinBox calls mount logic internally)
    if (opts.mount) {
      this._mountEl = opts.mount;
    }

    mockWinBoxInstances.push(this);
  });
  return { default: WinBox };
});

// Mock CSS imports (happy-dom handles these, but be explicit)
vi.mock('winbox/dist/css/winbox.min.css', () => ({}));
vi.mock('winbox/dist/css/themes/white.min.css', () => ({}));

// Mock panel render functions
vi.mock('./report.js', () => ({
  renderSummaryPanel: vi.fn(),
}));
vi.mock('./findings-list.js', () => ({
  renderFindingsPanel: vi.fn(),
}));
vi.mock('./details.js', () => ({
  renderDetailsPanel: vi.fn(),
}));
vi.mock('./tree-explorer.js', () => ({
  renderTreeExplorer: vi.fn(),
}));
vi.mock('./font-table.js', () => ({
  renderFontTable: vi.fn(),
}));
vi.mock('./image-table.js', () => ({
  renderImageTable: vi.fn(),
}));
vi.mock('./pdf-preview.js', () => ({
  renderPreviewPanel: vi.fn(),
}));
vi.mock('./dashboard.js', () => ({
  renderDashboard: vi.fn(),
}));

// Mock other app-shell dependencies
vi.mock('./drop-zone.js', () => ({
  createUploadZone: vi.fn(() => document.createElement('div')),
  filterPdfs: vi.fn((files) => [...files]),
}));
vi.mock('./export.js', () => ({
  initExport: vi.fn(() => ({
    exportJSON: vi.fn(),
    exportCSV: vi.fn(),
    exportPDF: vi.fn(),
  })),
}));
vi.mock('./dev-test-pdfs.js', () => ({
  getTestPdfsByCategory: vi.fn(() => new Map()),
  fetchTestPdf: vi.fn(),
  testPdfs: [],
}));

import { createPanelElement, initAppShell } from './app-shell.js';

const FLOATING_PANEL_NAMES = ['structure', 'fonts', 'images'];

const testData = {
  findings: [
    { id: 'test-finding', category: 'metadata', title: 'Test', status: 'pass', summary: 'OK' },
  ],
  meta: { pageCount: 1, fileSize: 1000, fileName: 'test.pdf' },
};

// ---------------------------------------------------------------------------
// Existing tests: createPanelElement
// ---------------------------------------------------------------------------

describe('createPanelElement', () => {
  describe('returns an HTMLElement for each floating panel', () => {
    for (const name of FLOATING_PANEL_NAMES) {
      it(`should return an HTMLElement for "${name}" panel`, () => {
        const el = createPanelElement(name, testData);

        expect(el).toBeDefined();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.tagName).toBe('DIV');
      });
    }
  });

  describe('element properties', () => {
    it('should create an element with overflow auto for scrolling', () => {
      const el = createPanelElement('structure', testData);
      expect(el.style.overflow).toBe('auto');
    });

    it('should create an element with 100% height', () => {
      const el = createPanelElement('structure', testData);
      expect(el.style.height).toBe('100%');
    });
  });

  describe('render function invocation', () => {
    it('should call the correct render function for structure', async () => {
      const { renderTreeExplorer } = await import('./tree-explorer.js');

      createPanelElement('structure', testData);

      expect(renderTreeExplorer).toHaveBeenCalledWith(expect.any(HTMLElement), testData);
    });

    it('should call the correct render function for fonts', async () => {
      const { renderFontTable } = await import('./font-table.js');

      createPanelElement('fonts', testData);

      expect(renderFontTable).toHaveBeenCalledWith(expect.any(HTMLElement), testData);
    });

    it('should call the correct render function for images', async () => {
      const { renderImageTable } = await import('./image-table.js');

      createPanelElement('images', testData);

      expect(renderImageTable).toHaveBeenCalledWith(expect.any(HTMLElement), testData);
    });

    it('should not throw for unknown panel names', () => {
      const el = createPanelElement('nonexistent', testData);

      expect(el).toBeInstanceOf(HTMLElement);
    });
  });
});

// ---------------------------------------------------------------------------
// New tests: initAppShell
// ---------------------------------------------------------------------------

/**
 * Create a mock worker with a dispatchable message listener.
 * Mimics the Worker interface used by initAppShell.
 */
function createMockWorker() {
  const listeners = [];
  return {
    addEventListener: vi.fn((type, fn) => {
      if (type === 'message') listeners.push(fn);
    }),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    /** Simulate the worker posting a message back to the main thread. */
    _dispatch(data) {
      listeners.forEach((fn) => fn({ data }));
    },
  };
}

describe('initAppShell', () => {
  let container;
  let worker;

  beforeEach(() => {
    mockWinBoxInstances.length = 0;
    container = document.createElement('div');
    container.id = 'app';
    // Give the container some dimensions so layout calculations don't produce NaN
    Object.defineProperty(container, 'clientWidth', { value: 1024, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 768, configurable: true });
    document.body.appendChild(container);
    worker = createMockWorker();
  });

  afterEach(() => {
    // Clean up any submenus appended to document.body
    document.querySelectorAll('.app-menubar__submenu').forEach((el) => el.remove());
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  // --- Welcome dialog ---

  it('should show welcome dialog on init', () => {
    initAppShell(container, worker);

    const welcomeInstance = mockWinBoxInstances.find((w) => w.title === 'Welcome');
    expect(welcomeInstance).toBeDefined();
  });

  it('should create welcome dialog as non-closable initially', () => {
    initAppShell(container, worker);

    const welcomeInstance = mockWinBoxInstances.find((w) => w.title === 'Welcome');
    expect(welcomeInstance).toBeDefined();
    // The class array should include 'no-close' for the initial welcome
    expect(welcomeInstance.opts.class).toContain('no-close');
  });

  it('should create welcome dialog with correct WinBox options', () => {
    initAppShell(container, worker);

    const welcomeInstance = mockWinBoxInstances.find((w) => w.title === 'Welcome');
    expect(welcomeInstance).toBeDefined();
    expect(welcomeInstance.opts.x).toBe('center');
    expect(welcomeInstance.opts.y).toBe('center');
    expect(welcomeInstance.opts.class).toContain('white');
    expect(welcomeInstance.opts.class).toContain('no-full');
    expect(welcomeInstance.opts.class).toContain('no-max');
    expect(welcomeInstance.opts.class).toContain('no-min');
    expect(welcomeInstance.opts.class).toContain('no-resize');
  });

  // --- Worker message routing ---

  it('should register a message listener on the worker', () => {
    initAppShell(container, worker);

    expect(worker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should silently ignore worker messages for non-existent sessions', () => {
    initAppShell(container, worker);

    // Dispatch messages with a non-existent sessionId — none should throw
    expect(() => {
      worker._dispatch({ type: 'progress', sessionId: 'nonexistent', phase: 'loading', percent: 50 });
    }).not.toThrow();

    expect(() => {
      worker._dispatch({ type: 'error', sessionId: 'nonexistent', message: 'Something broke' });
    }).not.toThrow();

    expect(() => {
      worker._dispatch({ type: 'result', sessionId: 'nonexistent', findings: [], meta: {} });
    }).not.toThrow();
  });

  it('should silently ignore worker messages with unknown type', () => {
    initAppShell(container, worker);

    expect(() => {
      worker._dispatch({ type: 'unknown-type', sessionId: 'nonexistent' });
    }).not.toThrow();
  });

  // --- Menu bar structure and ARIA ---

  it('should create a menu bar with role="menubar" and correct aria-label', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    expect(menuBar).not.toBeNull();
    expect(menuBar.getAttribute('aria-label')).toBe('Application menu');
  });

  it('should create menu bar with all expected menu items', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const buttons = menuBar.querySelectorAll('[role="menuitem"]');
    // Open File(s), Export All, Window, About, Help, Advanced = at least 6
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });

  it('should have the Open File(s) button with data-action="open-files"', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const openBtn = menuBar.querySelector('[data-action="open-files"]');
    expect(openBtn).not.toBeNull();
    expect(openBtn.textContent).toBe('Open File(s)');
  });

  it('should have Export All button with aria-haspopup', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    expect(exportBtn).not.toBeNull();
    expect(exportBtn.getAttribute('aria-haspopup')).toBe('true');
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should have Window button with aria-haspopup', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const windowBtn = menuBar.querySelector('[data-action="window-menu"]');
    expect(windowBtn).not.toBeNull();
    expect(windowBtn.getAttribute('aria-haspopup')).toBe('true');
  });

  it('should have About and Help buttons', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const aboutBtn = menuBar.querySelector('[data-action="about"]');
    const helpBtn = menuBar.querySelector('[data-action="help"]');
    expect(aboutBtn).not.toBeNull();
    expect(helpBtn).not.toBeNull();
    expect(aboutBtn.textContent).toBe('About');
    expect(helpBtn.textContent).toBe('Help');
  });

  it('should have Advanced button with aria-haspopup', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const advancedBtn = menuBar.querySelector('[data-action="advanced-menu"]');
    expect(advancedBtn).not.toBeNull();
    expect(advancedBtn.getAttribute('aria-haspopup')).toBe('true');
  });

  // --- Menu bar keyboard navigation (roving tabindex) ---

  it('should set roving tabindex on menu bar items (first item tabindex=0, rest -1)', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const buttons = [...menuBar.querySelectorAll('[role="menuitem"]')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i].getAttribute('tabindex')).toBe('-1');
    }
  });

  // --- Submenu behaviour ---

  it('should open Export All submenu on click', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    exportBtn.click();

    // The submenu is appended to document.body
    const submenu = document.querySelector('.app-menubar__submenu');
    expect(submenu).not.toBeNull();
    expect(submenu.getAttribute('role')).toBe('menu');
  });

  it('should set aria-expanded to true when submenu is opened', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    exportBtn.click();

    expect(exportBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('should close submenu when the same button is clicked again (toggle)', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');

    // Open
    exportBtn.click();
    expect(document.querySelector('.app-menubar__submenu')).not.toBeNull();

    // Close (toggle)
    exportBtn.click();
    expect(document.querySelector('.app-menubar__submenu')).toBeNull();
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close previous submenu when a different submenu button is clicked', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    const windowBtn = menuBar.querySelector('[data-action="window-menu"]');

    // Open export submenu
    exportBtn.click();
    const exportSubmenu = document.querySelector('.app-menubar__submenu');
    expect(exportSubmenu).not.toBeNull();

    // Open window submenu — should close the export one first
    windowBtn.click();
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
    expect(windowBtn.getAttribute('aria-expanded')).toBe('true');

    const submenus = document.querySelectorAll('.app-menubar__submenu');
    expect(submenus.length).toBe(1);
  });

  it('should create Export All submenu with JSON/CSV/PDF items', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    exportBtn.click();

    const submenu = document.querySelector('.app-menubar__submenu');
    const items = submenu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels).toContain('Export All as JSON');
    expect(labels).toContain('Export All as CSV');
    expect(labels).toContain('Export All as PDF');
  });

  it('should disable Export All items when no sessions have results', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const exportBtn = menuBar.querySelector('[data-action="export-all"]');
    exportBtn.click();

    const submenu = document.querySelector('.app-menubar__submenu');
    const items = submenu.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      expect(item.disabled).toBe(true);
    }
  });

  it('should create Window submenu with Tile/Cascade/Close All items', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const windowBtn = menuBar.querySelector('[data-action="window-menu"]');
    windowBtn.click();

    const submenu = document.querySelector('.app-menubar__submenu');
    const items = submenu.querySelectorAll('[role="menuitem"]');
    const labels = [...items].map((i) => i.textContent);
    expect(labels).toContain('Tile All');
    expect(labels).toContain('Cascade All');
    expect(labels).toContain('Close All');
  });

  it('should disable Window management items when no sessions have main windows', () => {
    initAppShell(container, worker);

    const menuBar = container.querySelector('[role="menubar"]');
    const windowBtn = menuBar.querySelector('[data-action="window-menu"]');
    windowBtn.click();

    const submenu = document.querySelector('.app-menubar__submenu');
    const items = submenu.querySelectorAll('[role="menuitem"]');
    // Tile All, Cascade All, Close All should all be disabled
    const tileItem = [...items].find((i) => i.textContent === 'Tile All');
    const cascadeItem = [...items].find((i) => i.textContent === 'Cascade All');
    const closeAllItem = [...items].find((i) => i.textContent === 'Close All');
    expect(tileItem.disabled).toBe(true);
    expect(cascadeItem.disabled).toBe(true);
    expect(closeAllItem.disabled).toBe(true);
  });

  // --- About and Help dialogs ---

  it('should open About dialog when About button is clicked', () => {
    initAppShell(container, worker);

    const aboutBtn = container.querySelector('[data-action="about"]');
    aboutBtn.click();

    const aboutInstance = mockWinBoxInstances.find((w) => w.title === 'About');
    expect(aboutInstance).toBeDefined();
    expect(aboutInstance.opts.class).toContain('no-resize');
  });

  it('should not create a second About dialog if one is already open', () => {
    initAppShell(container, worker);

    const aboutBtn = container.querySelector('[data-action="about"]');
    aboutBtn.click();
    const countAfterFirst = mockWinBoxInstances.filter((w) => w.title === 'About').length;

    aboutBtn.click();
    const countAfterSecond = mockWinBoxInstances.filter((w) => w.title === 'About').length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('should open Help dialog when Help button is clicked', () => {
    initAppShell(container, worker);

    const helpBtn = container.querySelector('[data-action="help"]');
    helpBtn.click();

    const helpInstance = mockWinBoxInstances.find((w) => w.title === 'Help');
    expect(helpInstance).toBeDefined();
  });

  it('should not create a second Help dialog if one is already open', () => {
    initAppShell(container, worker);

    const helpBtn = container.querySelector('[data-action="help"]');
    helpBtn.click();
    const countAfterFirst = mockWinBoxInstances.filter((w) => w.title === 'Help').length;

    helpBtn.click();
    const countAfterSecond = mockWinBoxInstances.filter((w) => w.title === 'Help').length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('should nullify aboutWin reference when About dialog is closed', () => {
    initAppShell(container, worker);

    const aboutBtn = container.querySelector('[data-action="about"]');
    aboutBtn.click();

    const aboutInstance = mockWinBoxInstances.find((w) => w.title === 'About');
    // Simulate closing the dialog — triggers onclose
    aboutInstance.close();

    // Clicking About again should create a new instance (not just focus)
    aboutBtn.click();
    const aboutInstances = mockWinBoxInstances.filter((w) => w.title === 'About');
    expect(aboutInstances.length).toBe(2);
  });

  it('should nullify helpWin reference when Help dialog is closed', () => {
    initAppShell(container, worker);

    const helpBtn = container.querySelector('[data-action="help"]');
    helpBtn.click();

    const helpInstance = mockWinBoxInstances.find((w) => w.title === 'Help');
    helpInstance.close();

    // Clicking Help again should create a new instance
    helpBtn.click();
    const helpInstances = mockWinBoxInstances.filter((w) => w.title === 'Help');
    expect(helpInstances.length).toBe(2);
  });

  // --- Container structure ---

  it('should append an app-root div to the container', () => {
    initAppShell(container, worker);

    const appRoot = container.querySelector('.app-root');
    expect(appRoot).not.toBeNull();
    expect(appRoot.style.position).toBe('relative');
  });

  it('should create a hidden file input for opening files', () => {
    initAppShell(container, worker);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe('.pdf,application/pdf');
    expect(fileInput.multiple).toBe(true);
    expect(fileInput.getAttribute('aria-label')).toBe('Choose PDF files');
  });

  it('should create a live region for screen reader announcements', () => {
    initAppShell(container, worker);

    const liveRegion = container.querySelector('[role="status"][aria-live="assertive"]');
    expect(liveRegion).not.toBeNull();
  });

  // --- Menu bar brand ---

  it('should display brand text "PDF-A-go" in the menu bar', () => {
    initAppShell(container, worker);

    const brand = container.querySelector('.app-menubar__brand');
    expect(brand).not.toBeNull();
    expect(brand.textContent).toBe('PDF-A-go');
  });

  // --- Open File(s) button focuses existing welcome ---

  it('should focus existing welcome dialog when Open File(s) is clicked', () => {
    initAppShell(container, worker);

    const welcomeInstance = mockWinBoxInstances.find((w) => w.title === 'Welcome');
    const openBtn = container.querySelector('[data-action="open-files"]');
    openBtn.click();

    // Since welcome is already open, it should be focused rather than creating a new one
    expect(welcomeInstance.focus).toHaveBeenCalled();
    // Should still be only one Welcome instance
    const welcomeInstances = mockWinBoxInstances.filter((w) => w.title === 'Welcome');
    expect(welcomeInstances.length).toBe(1);
  });

  // --- Dashboard → Detailed view transition ---

  describe('dashboard integration', () => {
    /**
     * Helper: simulate a full file-open → worker-result cycle.
     * Returns the callbacks object that renderDashboard received.
     */
    async function simulateAnalysis() {
      const { renderDashboard } = await import('./dashboard.js');
      renderDashboard.mockClear();

      initAppShell(container, worker);

      // Trigger file open via the hidden input
      const fileInput = container.querySelector('input[type="file"]');
      const file = new File(['%PDF'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change'));

      // Wait for file.arrayBuffer() and then postMessage
      await new Promise((r) => setTimeout(r, 10));

      // Worker receives the audit message — grab the sessionId
      const postCall = worker.postMessage.mock.calls[0];
      const sessionId = postCall[0].sessionId;

      // Simulate worker result
      worker._dispatch({
        type: 'result',
        sessionId,
        findings: testData.findings,
        meta: testData.meta,
      });

      // Wait for requestAnimationFrame in showResults
      await new Promise((r) => setTimeout(r, 10));

      return { renderDashboard, sessionId };
    }

    it('should call renderDashboard when a result arrives', async () => {
      const { renderDashboard } = await simulateAnalysis();

      expect(renderDashboard).toHaveBeenCalledOnce();
      const [el, data, callbacks] = renderDashboard.mock.calls[0];
      expect(el).toBeInstanceOf(HTMLElement);
      expect(data.findings).toEqual(testData.findings);
      expect(typeof callbacks.onViewFullReport).toBe('function');
      expect(typeof callbacks.onPreviewPdf).toBe('function');
      expect(typeof callbacks.onExport).toBe('function');
    });

    it('should render detailed view when onViewFullReport is called', async () => {
      const { renderSummaryPanel } = await import('./report.js');
      const { renderFindingsPanel } = await import('./findings-list.js');
      const { renderDetailsPanel } = await import('./details.js');
      renderSummaryPanel.mockClear();
      renderFindingsPanel.mockClear();
      renderDetailsPanel.mockClear();

      const { renderDashboard } = await simulateAnalysis();

      // Call the onViewFullReport callback that was passed to renderDashboard
      const callbacks = renderDashboard.mock.calls[0][2];
      callbacks.onViewFullReport();

      // Detailed view should now render: summary panel, findings panel, details panel
      expect(renderSummaryPanel).toHaveBeenCalled();
      expect(renderFindingsPanel).toHaveBeenCalled();
      expect(renderDetailsPanel).toHaveBeenCalled();
    });

    it('should create a results WinBox with dashboard-rendered content', async () => {
      await simulateAnalysis();

      const resultsWin = mockWinBoxInstances.find((w) =>
        w.title.startsWith('Results:')
      );
      expect(resultsWin).toBeDefined();
      expect(resultsWin.opts.mount).toBeInstanceOf(HTMLElement);
      expect(resultsWin.opts.mount.classList.contains('results-main')).toBe(true);
    });

    it('should pass onUploadAnother callback to renderDashboard', async () => {
      const { renderDashboard } = await simulateAnalysis();
      const callbacks = renderDashboard.mock.calls[0][2];
      expect(typeof callbacks.onUploadAnother).toBe('function');
    });

    it('should render a "Dashboard" button in the detailed view toolbar that re-renders dashboard', async () => {
      const { renderDashboard } = await simulateAnalysis();

      // Transition to detailed view
      const callbacks = renderDashboard.mock.calls[0][2];
      callbacks.onViewFullReport();

      // Find the wrapper (the mounted element in the results WinBox)
      const resultsWin = mockWinBoxInstances.find((w) => w.title.startsWith('Results:'));
      const wrapper = resultsWin._mountEl;

      // The toolbar should contain a "← Dashboard" button
      const backBtn = wrapper.querySelector('.results-toolbar .toolbar-btn');
      expect(backBtn).not.toBeNull();
      expect(backBtn.textContent).toContain('Dashboard');

      // Click it — should re-render the dashboard
      renderDashboard.mockClear();
      backBtn.click();
      expect(renderDashboard).toHaveBeenCalledOnce();
    });

    it('should pass onExport callback that invokes initExport methods', async () => {
      const { initExport } = await import('./export.js');
      const { renderDashboard } = await simulateAnalysis();

      const callbacks = renderDashboard.mock.calls[0][2];

      // initExport may not have been called yet — call the export callback
      callbacks.onExport('json');
      expect(initExport).toHaveBeenCalled();
    });
  });
});
