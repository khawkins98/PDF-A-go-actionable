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

import { renderPreviewPanel, multiplyMatrices, extractImageBboxes } from './pdf-preview.js';

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

  it('should render alt text toggle button', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const btn = el.querySelector('.pdf-preview__alt-text-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Alt Text');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('should toggle alt text button aria-pressed on click', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const btn = el.querySelector('.pdf-preview__alt-text-btn');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.classList.contains('toolbar-btn--active')).toBe(true);

    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.classList.contains('toolbar-btn--active')).toBe(false);
  });

  it('should render open PDF button', () => {
    const session = makeSession();
    renderPreviewPanel(el, makeData(), session);

    const btn = el.querySelector('.pdf-preview__open-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Open PDF');
    expect(btn.getAttribute('aria-label')).toBe('Open PDF in a new tab');
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

describe('multiplyMatrices', () => {
  it('should return identity when multiplying two identity matrices', () => {
    const id = [1, 0, 0, 1, 0, 0];
    expect(multiplyMatrices(id, id)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('should apply translation correctly', () => {
    const id = [1, 0, 0, 1, 0, 0];
    const translate = [1, 0, 0, 1, 50, 100];
    expect(multiplyMatrices(id, translate)).toEqual([1, 0, 0, 1, 50, 100]);
  });

  it('should compose translation then scale', () => {
    // First translate by (50,100), then scale by 2x
    const translate = [1, 0, 0, 1, 50, 100];
    const scale = [2, 0, 0, 2, 0, 0];
    // In PDF: cm translate, cm scale → CTM = translate × scale
    const result = multiplyMatrices(translate, scale);
    // A point (0,0) → scale to (0,0) → translate to (50,100)
    // A point (1,1) → scale to (2,2) → translate to (52,102)
    expect(result[4]).toBe(50);  // e: translation x preserved
    expect(result[5]).toBe(100); // f: translation y preserved
    expect(result[0]).toBe(2);   // a: scale x
    expect(result[3]).toBe(2);   // d: scale y
  });

  it('should compose scale then translation', () => {
    // cm scale first, then cm translate → CTM = scale × translate
    const scale = [2, 0, 0, 2, 0, 0];
    const translate = [1, 0, 0, 1, 50, 100];
    const result = multiplyMatrices(scale, translate);
    // e = 2*50 + 0*100 + 0 = 100, f = 0*50 + 2*100 + 0 = 200
    expect(result[4]).toBe(100);
    expect(result[5]).toBe(200);
    expect(result[0]).toBe(2);
    expect(result[3]).toBe(2);
  });
});

describe('extractImageBboxes', () => {
  // Build mock OPS constants matching PDF.js
  const OPS = {
    save: 10,
    restore: 11,
    transform: 12,
    beginMarkedContent: 69,
    beginMarkedContentProps: 70,
    endMarkedContent: 71,
    paintImageXObject: 85,
    paintJpegXObject: 82,
    paintInlineImageXObject: 87,
  };

  it('should return empty array for empty operator list', () => {
    const opList = { fnArray: [], argsArray: [] };
    expect(extractImageBboxes(opList, OPS)).toEqual([]);
  });

  it('should extract image bbox inside marked content (raw integer MCID)', () => {
    // PDF.js passes MCID as raw integer in args[1], not {mcid: N}
    const opList = {
      fnArray: [
        OPS.save,
        OPS.beginMarkedContentProps,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.endMarkedContent,
        OPS.restore,
      ],
      argsArray: [
        null,                           // save
        ['Figure', 3],                  // beginMarkedContentProps — raw integer
        [200, 0, 0, 300, 50, 100],      // transform: 200×300 at (50,100)
        ['img0', 200, 300],             // paintImageXObject
        null,                           // endMarkedContent
        null,                           // restore
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    expect(result).toHaveLength(1);
    expect(result[0].mcid).toBe(3);
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(100);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(300);
  });

  it('should also accept object-style MCID ({mcid: N})', () => {
    const opList = {
      fnArray: [
        OPS.beginMarkedContentProps,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.endMarkedContent,
      ],
      argsArray: [
        ['Figure', { mcid: 5 }],
        [100, 0, 0, 100, 10, 20],
        ['img0', 100, 100],
        null,
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    expect(result).toHaveLength(1);
    expect(result[0].mcid).toBe(5);
  });

  it('should ignore images outside marked content', () => {
    const opList = {
      fnArray: [
        OPS.save,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.restore,
      ],
      argsArray: [
        null,
        [100, 0, 0, 100, 0, 0],
        ['img0', 100, 100],
        null,
      ],
    };

    expect(extractImageBboxes(opList, OPS)).toEqual([]);
  });

  it('should ignore marked content without MCID', () => {
    const opList = {
      fnArray: [
        OPS.beginMarkedContent,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.endMarkedContent,
      ],
      argsArray: [
        null,
        [100, 0, 0, 100, 10, 20],
        ['img0', 100, 100],
        null,
      ],
    };

    expect(extractImageBboxes(opList, OPS)).toEqual([]);
  });

  it('should restore CTM after save/restore', () => {
    const opList = {
      fnArray: [
        OPS.save,
        OPS.transform,                  // scale 2x
        OPS.restore,
        OPS.beginMarkedContentProps,
        OPS.transform,                  // place image at (50,50) 100×100
        OPS.paintImageXObject,
        OPS.endMarkedContent,
      ],
      argsArray: [
        null,
        [2, 0, 0, 2, 0, 0],
        null,
        ['Span', 7],
        [100, 0, 0, 100, 50, 50],
        ['img0', 100, 100],
        null,
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    expect(result).toHaveLength(1);
    // The 2x scale was inside save/restore, so it should be gone
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(50);
    expect(result[0].width).toBe(100);
    expect(result[0].height).toBe(100);
  });

  it('should handle multiple images in different MCIDs', () => {
    const opList = {
      fnArray: [
        OPS.beginMarkedContentProps,
        OPS.save,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.restore,
        OPS.endMarkedContent,
        OPS.beginMarkedContentProps,
        OPS.save,
        OPS.transform,
        OPS.paintJpegXObject,
        OPS.restore,
        OPS.endMarkedContent,
      ],
      argsArray: [
        ['Figure', 1],
        null,
        [100, 0, 0, 200, 10, 20],
        ['img0', 100, 200],
        null,
        null,
        ['Figure', 2],
        null,
        [150, 0, 0, 250, 300, 400],
        ['img1', 150, 250],
        null,
        null,
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    expect(result).toHaveLength(2);
    expect(result[0].mcid).toBe(1);
    expect(result[0].x).toBe(10);
    expect(result[0].width).toBe(100);
    expect(result[1].mcid).toBe(2);
    expect(result[1].x).toBe(300);
    expect(result[1].width).toBe(150);
  });

  it('should find images inside nested MC (Figure > PlacedPDF > image)', () => {
    // Real-world pattern: Figure(mcid) > PlacedPDF(null) > image
    const opList = {
      fnArray: [
        OPS.beginMarkedContentProps,    // Figure with MCID
        OPS.beginMarkedContentProps,    // PlacedPDF without MCID
        OPS.save,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.restore,
        OPS.endMarkedContent,           // end PlacedPDF
        OPS.endMarkedContent,           // end Figure
      ],
      argsArray: [
        ['Figure', 459],
        ['PlacedPDF', null],
        null,
        [400, 0, 0, 300, 72, 200],
        ['img_p12_11', 95],
        null,
        null,
        null,
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    expect(result).toHaveLength(1);
    expect(result[0].mcid).toBe(459);
    expect(result[0].x).toBe(72);
    expect(result[0].y).toBe(200);
    expect(result[0].width).toBe(400);
    expect(result[0].height).toBe(300);
  });

  it('should skip zero-size images', () => {
    const opList = {
      fnArray: [
        OPS.beginMarkedContentProps,
        OPS.paintImageXObject,        // no transform → identity → 1×1
        OPS.endMarkedContent,
        OPS.beginMarkedContentProps,
        OPS.transform,
        OPS.paintImageXObject,
        OPS.endMarkedContent,
      ],
      argsArray: [
        ['Figure', 1],
        ['img0', 0, 0],
        null,
        ['Figure', 2],
        [0, 0, 0, 0, 50, 50],         // zero-size transform
        ['img1', 0, 0],
        null,
      ],
    };

    const result = extractImageBboxes(opList, OPS);
    // First image has identity CTM (1×1) so it's included
    expect(result).toHaveLength(1);
    expect(result[0].mcid).toBe(1);
  });
});
