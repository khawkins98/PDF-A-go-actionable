// @vitest-environment happy-dom
/**
 * Tests for the app shell — dockview-core panel creation.
 *
 * The critical contract: createPanel must return an object with:
 * - element: HTMLElement (mounted by dockview)
 * - init: Function (called after mounting)
 *
 * This test would have caught the crash where init() tried to access
 * params.containerElement (which doesn't exist in dockview-core's API).
 */
import { describe, it, expect, vi } from 'vitest';
import { createPanel } from './app-shell.js';

// Mock render functions to avoid testing their internals here
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

const PANEL_NAMES = ['summary', 'findings', 'details', 'structure', 'fonts', 'images'];

const testData = {
  findings: [
    { id: 'test-finding', category: 'metadata', title: 'Test', status: 'pass', summary: 'OK' },
  ],
  meta: { pageCount: 1, fileSize: 1000, fileName: 'test.pdf' },
};

describe('createPanel', () => {
  describe('dockview-core IContentRenderer contract', () => {
    for (const name of PANEL_NAMES) {
      it(`should return { element: HTMLElement, init: Function } for "${name}" panel`, () => {
        const panel = createPanel(name, testData);

        // The critical contract: element must be an HTMLElement
        expect(panel.element).toBeDefined();
        expect(panel.element).toBeInstanceOf(HTMLElement);
        expect(panel.element.tagName).toBe('DIV');

        // init must be a function
        expect(typeof panel.init).toBe('function');
      });
    }
  });

  describe('element properties', () => {
    it('should create an element with overflow auto for scrolling', () => {
      const panel = createPanel('summary', testData);
      expect(panel.element.style.overflow).toBe('auto');
    });

    it('should create an element with 100% height', () => {
      const panel = createPanel('summary', testData);
      expect(panel.element.style.height).toBe('100%');
    });
  });

  describe('init invocation', () => {
    it('should not throw when init is called with dockview parameters', () => {
      const panel = createPanel('summary', testData);

      // dockview-core calls init with { params, title, api, containerApi }
      // NOT with containerElement
      expect(() => {
        panel.init({ params: {}, title: 'Summary', api: {}, containerApi: {} });
      }).not.toThrow();
    });

    it('should call the correct render function on init', async () => {
      const { renderSummaryPanel } = await import('./report.js');

      const panel = createPanel('summary', testData);
      panel.init({ params: {}, title: 'Summary', api: {}, containerApi: {} });

      expect(renderSummaryPanel).toHaveBeenCalledWith(panel.element, testData);
    });

    it('should not throw for unknown panel names', () => {
      const panel = createPanel('nonexistent', testData);

      expect(panel.element).toBeInstanceOf(HTMLElement);
      expect(() => {
        panel.init({ params: {}, title: 'Unknown', api: {}, containerApi: {} });
      }).not.toThrow();
    });
  });
});
