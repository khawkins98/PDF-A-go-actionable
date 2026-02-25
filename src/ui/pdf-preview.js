/**
 * PDF visual preview panel with page rendering and highlight overlays.
 *
 * Lazily loads pdfjs-dist when the panel is first opened (same pattern as
 * pdf-lib in export.js). Renders a single PDF page to <canvas> with
 * navigation controls, resize handling, and SVG overlay for highlights.
 *
 * Listens for bus events:
 * - `selectTreeNode` — navigate to page, highlight MCID regions
 * - `showReadingOrder` — toggle reading order badge overlay
 */

/** @type {typeof import('pdfjs-dist')|null} */
let pdfjsLib = null;

/**
 * Lazy-load pdfjs-dist and configure its worker.
 * @returns {Promise<typeof import('pdfjs-dist')>}
 */
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;
  return pdfjsLib;
}

/** Debounce helper. */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Render the PDF preview panel.
 *
 * @param {HTMLElement} el - Container element
 * @param {object} data - Audit result data (structureTree, findings, meta)
 * @param {object} session - Session object with .file and .bus
 */
export function renderPreviewPanel(el, data, session) {
  el.innerHTML = '';
  el.className = 'pdf-preview';

  // --- State ---
  let pdfjsDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let renderTask = null;
  let destroyed = false;
  /** @type {Map<number, object>} Cached text content per page (1-based) */
  const textContentCache = new Map();
  /** @type {Array<{mcid: number, pageIndex: number}>|null} Active highlight MCIDs */
  let activeMcids = null;
  let readingOrderOn = false;

  // --- DOM ---
  const toolbar = document.createElement('div');
  toolbar.className = 'pdf-preview__toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'PDF page navigation');

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'toolbar-btn pdf-preview__nav-btn';
  prevBtn.textContent = '\u25C0';
  prevBtn.title = 'Previous page';
  prevBtn.setAttribute('aria-label', 'Previous page');

  const pageInfo = document.createElement('span');
  pageInfo.className = 'pdf-preview__page-info';

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.className = 'pdf-preview__page-input';
  pageInput.min = '1';
  pageInput.setAttribute('aria-label', 'Page number');

  const pageTotal = document.createElement('span');
  pageTotal.className = 'pdf-preview__page-total';

  pageInfo.appendChild(pageInput);
  pageInfo.appendChild(pageTotal);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'toolbar-btn pdf-preview__nav-btn';
  nextBtn.textContent = '\u25B6';
  nextBtn.title = 'Next page';
  nextBtn.setAttribute('aria-label', 'Next page');

  const readingOrderBtn = document.createElement('button');
  readingOrderBtn.type = 'button';
  readingOrderBtn.className = 'toolbar-btn pdf-preview__reading-order-btn';
  readingOrderBtn.textContent = 'Reading Order';
  readingOrderBtn.title = 'Toggle reading order visualization';
  readingOrderBtn.setAttribute('aria-pressed', 'false');

  toolbar.appendChild(prevBtn);
  toolbar.appendChild(pageInfo);
  toolbar.appendChild(nextBtn);

  // Separator before reading order toggle
  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  sep.setAttribute('aria-hidden', 'true');
  toolbar.appendChild(sep);
  toolbar.appendChild(readingOrderBtn);

  el.appendChild(toolbar);

  // Canvas + SVG overlay container
  const viewport = document.createElement('div');
  viewport.className = 'pdf-preview__viewport';

  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-preview__canvas';
  viewport.appendChild(canvas);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('pdf-preview__overlay');
  svg.setAttribute('aria-hidden', 'true');
  viewport.appendChild(svg);

  el.appendChild(viewport);

  // Status message (loading / errors / no tags)
  const status = document.createElement('div');
  status.className = 'pdf-preview__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  el.appendChild(status);

  const ctx = canvas.getContext('2d');

  // --- Event wiring ---

  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  pageInput.addEventListener('change', () => {
    const val = parseInt(pageInput.value, 10);
    if (!isNaN(val)) goToPage(val);
  });
  pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInput.value, 10);
      if (!isNaN(val)) goToPage(val);
    }
  });

  readingOrderBtn.addEventListener('click', () => {
    readingOrderOn = !readingOrderOn;
    readingOrderBtn.setAttribute('aria-pressed', String(readingOrderOn));
    readingOrderBtn.classList.toggle('toolbar-btn--active', readingOrderOn);
    renderOverlay();
  });

  // Listen for tree node selection on the session bus
  const bus = session.bus;
  let unsubs = [];

  if (bus) {
    unsubs.push(bus.on('selectTreeNode', (payload) => {
      activeMcids = payload.mcids || null;
      if (payload.pageIndex != null && payload.pageIndex !== currentPage - 1) {
        goToPage(payload.pageIndex + 1); // goToPage handles re-render + overlay
      } else {
        renderOverlay();
      }
    }));
  }

  // Resize handling
  const onResize = debounce(() => {
    if (!destroyed && pdfjsDoc) renderPage();
  }, 200);

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(viewport);

  // --- Loading ---

  status.textContent = 'Loading PDF preview\u2026';
  loadAndRender();

  async function loadAndRender() {
    try {
      const lib = await loadPdfjs();
      if (destroyed) return;

      const buffer = await session.file.arrayBuffer();
      if (destroyed) return;

      const loadingTask = lib.getDocument({ data: new Uint8Array(buffer) });
      pdfjsDoc = await loadingTask.promise;
      if (destroyed) return;

      totalPages = pdfjsDoc.numPages;
      pageInput.max = String(totalPages);
      status.textContent = '';
      updateNav();
      renderPage();
    } catch (err) {
      if (!destroyed) {
        status.textContent = `Failed to load preview: ${err.message}`;
      }
    }
  }

  function updateNav() {
    pageInput.value = String(currentPage);
    pageTotal.textContent = ` of ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  function goToPage(num) {
    const clamped = Math.max(1, Math.min(num, totalPages));
    if (clamped === currentPage && canvas.width > 0) return;
    currentPage = clamped;
    updateNav();
    renderPage();
  }

  async function renderPage() {
    if (!pdfjsDoc || destroyed) return;

    // Cancel in-flight render
    if (renderTask) {
      try { renderTask.cancel(); } catch (_) { /* already done */ }
      renderTask = null;
    }

    try {
      const page = await pdfjsDoc.getPage(currentPage);
      if (destroyed) return;

      const containerWidth = viewport.clientWidth || 400;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaled.width;
      const vp = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;

      // Size SVG overlay to match
      svg.setAttribute('width', String(vp.width));
      svg.setAttribute('height', String(vp.height));
      svg.setAttribute('viewBox', `0 0 ${vp.width} ${vp.height}`);
      svg.style.width = `${vp.width}px`;
      svg.style.height = `${vp.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport: vp });
      await renderTask.promise;
      renderTask = null;

      if (!destroyed) renderOverlay();
    } catch (err) {
      if (err.name !== 'RenderingCancelled' && !destroyed) {
        status.textContent = `Render error: ${err.message}`;
      }
    }
  }

  // --- Overlay rendering ---

  async function renderOverlay() {
    // Clear existing overlays
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!pdfjsDoc || destroyed) return;

    // Get or cache text content for current page
    const textContent = await getTextContent(currentPage);
    if (!textContent || destroyed) return;

    // Draw MCID highlights if active
    if (activeMcids && activeMcids.length > 0) {
      const pageMcids = activeMcids
        .filter((m) => m.pageIndex === currentPage - 1)
        .map((m) => m.mcid);

      if (pageMcids.length > 0) {
        drawMcidHighlights(textContent, pageMcids);
      }
    }

    // Draw reading order badges if toggled on
    if (readingOrderOn) {
      drawReadingOrder(textContent);
    }
  }

  async function getTextContent(pageNum) {
    if (textContentCache.has(pageNum)) return textContentCache.get(pageNum);
    if (!pdfjsDoc) return null;

    try {
      const page = await pdfjsDoc.getPage(pageNum);
      const content = await page.getTextContent({ includeMarkedContent: true });
      textContentCache.set(pageNum, content);
      return content;
    } catch (_) {
      return null;
    }
  }

  /**
   * Walk text content items, tracking marked content sections.
   * Returns bounding boxes for items that belong to the given MCIDs.
   */
  function getMcidBoundingBoxes(textContent, targetMcids) {
    const targetSet = new Set(targetMcids);
    const boxes = [];
    const mcidStack = [];

    // Get current viewport scale
    const containerWidth = viewport.clientWidth || 400;

    for (const item of textContent.items) {
      if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') {
        mcidStack.push(item.mcid != null ? item.mcid : null);
      } else if (item.type === 'endMarkedContent') {
        mcidStack.pop();
      } else if (item.str != null) {
        // Text item — check if we're inside a target MCID
        const currentMcid = mcidStack.length > 0 ? mcidStack[mcidStack.length - 1] : null;
        if (currentMcid != null && targetSet.has(currentMcid)) {
          // Transform: [scaleX, skewX, skewY, scaleY, tx, ty]
          const tx = item.transform;
          if (tx && item.width > 0) {
            boxes.push({
              mcid: currentMcid,
              x: tx[4],
              y: tx[5],
              width: item.width,
              height: item.height || Math.abs(tx[3]),
            });
          }
        }
      }
    }
    return boxes;
  }

  function drawMcidHighlights(textContent, pageMcids) {
    const boxes = getMcidBoundingBoxes(textContent, pageMcids);
    if (boxes.length === 0) return;

    // Get viewport for coordinate transform
    if (!pdfjsDoc) return;
    const containerWidth = viewport.clientWidth || 400;

    // We need page dimensions for coordinate conversion
    // PDF coordinates: origin bottom-left. Canvas/SVG: origin top-left.
    const svgHeight = parseFloat(svg.getAttribute('height')) || 0;
    const svgWidth = parseFloat(svg.getAttribute('width')) || 0;
    if (!svgHeight || !svgWidth) return;

    // Get the current page viewport scale
    pdfjsDoc.getPage(currentPage).then((page) => {
      if (destroyed) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaled.width;

      for (const box of boxes) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        // PDF coords -> SVG coords
        const x = box.x * scale;
        const y = svgHeight - (box.y * scale) - (box.height * scale);
        const w = box.width * scale;
        const h = box.height * scale;

        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('class', 'pdf-preview__highlight');
        svg.appendChild(rect);
      }
    });
  }

  function drawReadingOrder(textContent) {
    if (!data.structureTree || !data.structureTree.root) return;

    const pageIndex = currentPage - 1;
    const elements = [];

    // Collect structure tree nodes that have MCIDs on this page
    collectPageElements(data.structureTree.root, pageIndex, elements);
    if (elements.length === 0) return;

    const containerWidth = viewport.clientWidth || 400;
    const svgHeight = parseFloat(svg.getAttribute('height')) || 0;
    if (!svgHeight) return;

    pdfjsDoc.getPage(currentPage).then((page) => {
      if (destroyed) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaled.width;

      let orderNum = 0;
      for (const elem of elements) {
        const mcids = elem.mcids
          .filter((m) => m.pageIndex === pageIndex)
          .map((m) => m.mcid);
        if (mcids.length === 0) continue;

        const boxes = getMcidBoundingBoxes(textContent, mcids);
        if (boxes.length === 0) continue;

        orderNum++;
        // Use first box position for badge placement
        const first = boxes[0];
        const x = first.x * scale;
        const y = svgHeight - (first.y * scale) - (first.height * scale);

        // Badge circle
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'pdf-preview__reading-order-badge');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', '10');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y + 4));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = String(orderNum);
        g.appendChild(text);

        // Line to next element (if there is one)
        if (orderNum > 1) {
          const prevG = svg.querySelector('.pdf-preview__reading-order-badge:last-of-type');
          if (prevG) {
            const prevCircle = prevG.querySelector('circle');
            if (prevCircle) {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', prevCircle.getAttribute('cx'));
              line.setAttribute('y1', prevCircle.getAttribute('cy'));
              line.setAttribute('x2', String(x));
              line.setAttribute('y2', String(y));
              line.setAttribute('class', 'pdf-preview__reading-order-line');
              // Insert line before badges so it renders behind
              svg.insertBefore(line, svg.querySelector('.pdf-preview__reading-order-badge'));
            }
          }
        }

        svg.appendChild(g);
      }
    });
  }

  /**
   * Collect tree nodes that have MCIDs on the given page, in tree order.
   */
  function collectPageElements(node, pageIndex, result) {
    if (!node) return;
    if (node.mcids && node.mcids.some((m) => m.pageIndex === pageIndex)) {
      result.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        collectPageElements(child, pageIndex, result);
      }
    }
  }

  // --- Cleanup API ---

  /**
   * Destroy the preview, releasing PDF.js resources.
   * Called by app-shell when the floating panel is closed.
   */
  el._destroyPreview = () => {
    destroyed = true;
    resizeObserver.disconnect();
    for (const unsub of unsubs) unsub();
    unsubs = [];
    if (renderTask) {
      try { renderTask.cancel(); } catch (_) { /* ignore */ }
    }
    if (pdfjsDoc) {
      pdfjsDoc.destroy();
      pdfjsDoc = null;
    }
    textContentCache.clear();
  };
}
