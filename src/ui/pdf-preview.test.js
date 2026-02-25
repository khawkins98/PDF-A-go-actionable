// @vitest-environment happy-dom
/**
 * Tests for the PDF preview panel.
 *
 * Covers:
 * - Panel DOM structure (toolbar, canvas, SVG overlay, status)
 * - Navigation controls (prev/next buttons, page input)
 * - Bus event listener registration
 * - Reading order toggle
 * - Cleanup/destroy
 *
 * Note: Actual PDF rendering cannot be tested in happy-dom since there's
 * no real <canvas> context. We test DOM structure and interaction wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfjs-dist — must be hoisted before import
vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getViewport: vi.fn(() => ({ width: 612, height: 792 })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    getTextContent: vi.fn(() => Promise.resolve({ items: [] })),
  };

  const mockDoc = {
    numPages: 3,
    getPage: vi.fn(() => Promise.resolve(mockPage)),
    destroy: vi.fn(),
  };

  return {
    getDocument: vi.fn(() => ({
      promise: Promise.resolve(mockDoc),
    })),
    GlobalWorkerOptions: { workerSrc: '' },
    __mockDoc: mockDoc,
    __mockPage: mockPage,
  };
});

import { renderPreviewPanel } from './pdf-preview.js';

function makeSession(overrides = {}) {
  const listeners = new Map();
  const bus = {
    on: vi.fn((event, fn) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return () => {
        const fns = listeners.get(event);
        const idx = fns.indexOf(fn);
        if (idx !== -1) fns.splice(idx, 1);
      };
    }),
    emit: vi.fn((event, data) => {
      const fns = listeners.get(event);
      if (fns) fns.forEach((fn) => fn(data));
    }),
    off: vi.fn(),
    _listeners: listeners,
  };

  return {
    id: 'test-session',
    fileName: 'test.pdf',
    bus,
    file: new File(['fake-pdf-content'], 'test.pdf', { type: 'application/pdf' }),
    data: {
      findings: [],
      meta: { fileName: 'test.pdf' },
      structureTree: { root: null, totalCount: 0, truncated: false },
    },
    ...overrides,
  };
}

function makeData(structureTree) {
  return {
    findings: [],
    meta: { fileName: 'test.pdf' },
    structureTree: structureTree || { root: null, totalCount: 0, truncated: false },
  };
}

describe('renderPreviewPanel', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('should render toolbar with navigation controls', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const toolbar = el.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar.getAttribute('aria-label')).toBe('PDF page navigation');

    // Prev/next + zoom in/out buttons
    const navBtns = el.querySelectorAll('.pdf-preview__nav-btn');
    expect(navBtns.length).toBe(4); // prev, next, zoom out, zoom in
    expect(navBtns[0].getAttribute('aria-label')).toBe('Previous page');
    expect(navBtns[1].getAttribute('aria-label')).toBe('Next page');
  });

  it('should render page number input', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const input = el.querySelector('.pdf-preview__page-input');
    expect(input).not.toBeNull();
    expect(input.type).toBe('number');
    expect(input.min).toBe('1');
    expect(input.getAttribute('aria-label')).toBe('Page number');
  });

  it('should render canvas and SVG overlay', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const canvas = el.querySelector('canvas.pdf-preview__canvas');
    expect(canvas).not.toBeNull();

    const svg = el.querySelector('svg.pdf-preview__overlay');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render viewport container', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const viewport = el.querySelector('.pdf-preview__viewport');
    expect(viewport).not.toBeNull();
  });

  it('should render status area', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const statusEl = el.querySelector('.pdf-preview__status');
    expect(statusEl).not.toBeNull();
    expect(statusEl.getAttribute('role')).toBe('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });

  it('should render reading order toggle button', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const btn = el.querySelector('.pdf-preview__reading-order-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Reading Order');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('should toggle reading order button aria-pressed on click', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const btn = el.querySelector('.pdf-preview__reading-order-btn');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.classList.contains('toolbar-btn--active')).toBe(true);

    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.classList.contains('toolbar-btn--active')).toBe(false);
  });

  it('should register selectTreeNode listener on bus', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    expect(session.bus.on).toHaveBeenCalledWith('selectTreeNode', expect.any(Function));
  });

  it('should show loading status initially', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const statusEl = el.querySelector('.pdf-preview__status');
    expect(statusEl.textContent).toContain('Loading');
  });

  it('should have css class pdf-preview on container', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    expect(el.className).toBe('pdf-preview');
  });

  it('should render zoom controls', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const zoomLabel = el.querySelector('.pdf-preview__zoom-label');
    expect(zoomLabel).not.toBeNull();
    expect(zoomLabel.textContent).toBe('Fit');

    const zoomFit = el.querySelector('.pdf-preview__zoom-fit');
    expect(zoomFit).not.toBeNull();
    expect(zoomFit.getAttribute('aria-label')).toBe('Fit to width');

    // Zoom in/out are nav-btn class
    const zoomOut = el.querySelector('[aria-label="Zoom out"]');
    const zoomIn = el.querySelector('[aria-label="Zoom in"]');
    expect(zoomOut).not.toBeNull();
    expect(zoomIn).not.toBeNull();
  });

  it('should expose _destroyPreview on container', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    expect(typeof el._destroyPreview).toBe('function');
  });

  it('should not throw when destroyed before load completes', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    expect(() => el._destroyPreview()).not.toThrow();
  });
});
