// @vitest-environment happy-dom
/**
 * Tests for the app shell — floating panel creation.
 *
 * The critical contract: createPanelElement must return an HTMLElement
 * with content rendered by the appropriate render function.
 * Only covers the three floating panel types (structure, fonts, images).
 */
import { describe, it, expect, vi } from 'vitest';

// Mock WinBox (not needed for createPanelElement but must resolve at import)
vi.mock('winbox/src/js/winbox.js', () => ({ default: vi.fn() }));

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

import { createPanelElement } from './app-shell.js';

const FLOATING_PANEL_NAMES = ['structure', 'fonts', 'images'];

const testData = {
  findings: [
    { id: 'test-finding', category: 'metadata', title: 'Test', status: 'pass', summary: 'OK' },
  ],
  meta: { pageCount: 1, fileSize: 1000, fileName: 'test.pdf' },
};

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
