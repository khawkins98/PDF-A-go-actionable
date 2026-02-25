/**
 * PDF visual preview panel with page rendering and highlight overlays.
 *
 * Lazily loads pdfjs-dist when the panel is first opened (same pattern as
 * pdf-lib in export.js). Renders a single PDF page to <canvas> with
 * navigation controls, zoom, resize handling, and SVG overlay for highlights.
 *
 * Listens for bus events:
 * - `selectTreeNode` — navigate to page, highlight MCID regions
 *
 * PDF.js text content marked content items use `item.id` (a string like
 * "p12R_mc5") rather than a raw integer MCID. We parse the integer from
 * the `_mcN` suffix for matching against structure tree MCIDs.
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
 * Extract the integer MCID from a PDF.js marked content item's `id` string.
 * PDF.js formats these as "pageObjId_mcN" (e.g. "p12R_mc5" → 5).
 * Returns null if the id doesn't contain an MCID.
 */
function parseMcid(id) {
  if (id == null) return null;
  const m = String(id).match(/_mc(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Multiply two 2D affine transformation matrices.
 * Each matrix is [a, b, c, d, e, f] representing:
 *   [a b 0]
 *   [c d 0]
 *   [e f 1]
 * Returns m1 × m2.
 */
function multiplyMatrices(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Extract image bounding boxes from a PDF.js operator list,
 * grouped by MCID. Used as a fallback when getTextContent()
 * returns no text items for image-only marked content regions
 * (e.g., Figure elements that contain only an image).
 *
 * Tracks the CTM (Current Transformation Matrix) through save/restore
 * and transform operations to compute each image's position and size.
 *
 * @param {{fnArray: number[], argsArray: any[]}} opList
 * @param {object} OPS - PDF.js OPS constants
 * @returns {Array<{mcid: number, x: number, y: number, width: number, height: number}>}
 */
function extractImageBboxes(opList, OPS) {
  const boxes = [];
  const mcidStack = [];
  const ctmStack = [];
  let ctm = [1, 0, 0, 1, 0, 0]; // identity

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (fn) {
      case OPS.save:
        ctmStack.push(ctm.slice());
        break;
      case OPS.restore:
        if (ctmStack.length > 0) ctm = ctmStack.pop();
        break;
      case OPS.transform:
        ctm = multiplyMatrices(ctm, args);
        break;
      case OPS.beginMarkedContentProps: {
        // PDF.js passes MCID as raw integer in args[1], not {mcid: N}
        const mc = args[1];
        mcidStack.push(typeof mc === 'number' ? mc : (mc?.mcid ?? null));
        break;
      }
      case OPS.beginMarkedContent:
        mcidStack.push(null);
        break;
      case OPS.endMarkedContent:
        mcidStack.pop();
        break;
      case OPS.paintImageXObject:
      case OPS.paintJpegXObject:
      case OPS.paintInlineImageXObject: {
        // Search stack for nearest ancestor with a non-null MCID.
        // Images can be nested inside MC sections without MCIDs
        // (e.g., Figure(459) > PlacedPDF(null) > image).
        let currentMcid = null;
        for (let j = mcidStack.length - 1; j >= 0; j--) {
          if (mcidStack[j] != null) {
            currentMcid = mcidStack[j];
            break;
          }
        }
        if (currentMcid != null) {
          // Image is a 1×1 unit square in user space, transformed by CTM.
          // Compute axis-aligned bounding box of the four corners.
          const p0 = [ctm[4], ctm[5]];
          const p1 = [ctm[0] + ctm[4], ctm[1] + ctm[5]];
          const p2 = [ctm[2] + ctm[4], ctm[3] + ctm[5]];
          const p3 = [ctm[0] + ctm[2] + ctm[4], ctm[1] + ctm[3] + ctm[5]];
          const minX = Math.min(p0[0], p1[0], p2[0], p3[0]);
          const minY = Math.min(p0[1], p1[1], p2[1], p3[1]);
          const maxX = Math.max(p0[0], p1[0], p2[0], p3[0]);
          const maxY = Math.max(p0[1], p1[1], p2[1], p3[1]);
          const w = maxX - minX;
          const h = maxY - minY;
          if (w > 0 && h > 0) {
            boxes.push({ mcid: currentMcid, x: minX, y: minY, width: w, height: h });
          }
        }
        break;
      }
    }
  }

  return boxes;
}

/** Zoom presets. */
const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
const ZOOM_FIT = -1; // sentinel for fit-to-width

/**
 * Render the PDF preview panel.
 *
 * @param {HTMLElement} el - Container element
 * @param {object} data - Audit result data (structureTree, findings, meta)
 * @param {object} session - Session object with .file and .bus
 */
// Exported for testing
export { multiplyMatrices, extractImageBboxes };

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
  let altTextOn = false;
  let zoomMode = ZOOM_FIT; // ZOOM_FIT or a numeric scale multiplier
  let lastFitScale = 1; // cached fit-to-width scale from last render

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

  // Zoom controls
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.className = 'toolbar-btn pdf-preview__nav-btn';
  zoomOutBtn.textContent = '\u2212'; // minus sign
  zoomOutBtn.title = 'Zoom out';
  zoomOutBtn.setAttribute('aria-label', 'Zoom out');

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'pdf-preview__zoom-label';
  zoomLabel.textContent = 'Fit';

  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.className = 'toolbar-btn pdf-preview__nav-btn';
  zoomInBtn.textContent = '+';
  zoomInBtn.title = 'Zoom in';
  zoomInBtn.setAttribute('aria-label', 'Zoom in');

  const zoomFitBtn = document.createElement('button');
  zoomFitBtn.type = 'button';
  zoomFitBtn.className = 'toolbar-btn pdf-preview__zoom-fit';
  zoomFitBtn.textContent = 'Fit';
  zoomFitBtn.title = 'Fit to width';
  zoomFitBtn.setAttribute('aria-label', 'Fit to width');

  const readingOrderBtn = document.createElement('button');
  readingOrderBtn.type = 'button';
  readingOrderBtn.className = 'toolbar-btn pdf-preview__reading-order-btn';
  readingOrderBtn.textContent = 'Reading Order';
  readingOrderBtn.title = 'Toggle reading order visualization';
  readingOrderBtn.setAttribute('aria-pressed', 'false');

  const altTextBtn = document.createElement('button');
  altTextBtn.type = 'button';
  altTextBtn.className = 'toolbar-btn pdf-preview__alt-text-btn';
  altTextBtn.textContent = 'Alt Text';
  altTextBtn.title = 'Show alt text labels on images and figures';
  altTextBtn.setAttribute('aria-pressed', 'false');

  const openPdfBtn = document.createElement('button');
  openPdfBtn.type = 'button';
  openPdfBtn.className = 'toolbar-btn pdf-preview__open-btn';
  openPdfBtn.textContent = 'Open PDF';
  openPdfBtn.title = 'Open PDF in a new tab';
  openPdfBtn.setAttribute('aria-label', 'Open PDF in a new tab');

  toolbar.appendChild(prevBtn);
  toolbar.appendChild(pageInfo);
  toolbar.appendChild(nextBtn);

  toolbar.appendChild(makeSep());
  toolbar.appendChild(zoomOutBtn);
  toolbar.appendChild(zoomLabel);
  toolbar.appendChild(zoomInBtn);
  toolbar.appendChild(zoomFitBtn);

  toolbar.appendChild(makeSep());
  toolbar.appendChild(readingOrderBtn);
  toolbar.appendChild(altTextBtn);

  toolbar.appendChild(makeSep());
  toolbar.appendChild(openPdfBtn);

  el.appendChild(toolbar);

  // Canvas + SVG overlay container
  const viewportEl = document.createElement('div');
  viewportEl.className = 'pdf-preview__viewport';

  // Wrapper positions SVG overlay exactly over the canvas
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'pdf-preview__canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-preview__canvas';
  canvasWrap.appendChild(canvas);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('pdf-preview__overlay');
  svg.setAttribute('aria-hidden', 'true');
  canvasWrap.appendChild(svg);

  viewportEl.appendChild(canvasWrap);
  el.appendChild(viewportEl);

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

  zoomOutBtn.addEventListener('click', () => stepZoom(-1));
  zoomInBtn.addEventListener('click', () => stepZoom(1));
  zoomFitBtn.addEventListener('click', () => {
    zoomMode = ZOOM_FIT;
    renderPage();
  });

  readingOrderBtn.addEventListener('click', () => {
    readingOrderOn = !readingOrderOn;
    readingOrderBtn.setAttribute('aria-pressed', String(readingOrderOn));
    readingOrderBtn.classList.toggle('toolbar-btn--active', readingOrderOn);
    renderOverlay();
  });

  altTextBtn.addEventListener('click', () => {
    altTextOn = !altTextOn;
    altTextBtn.setAttribute('aria-pressed', String(altTextOn));
    altTextBtn.classList.toggle('toolbar-btn--active', altTextOn);
    renderOverlay();
  });

  let openPdfUrl = null;
  openPdfBtn.addEventListener('click', () => {
    if (openPdfUrl) URL.revokeObjectURL(openPdfUrl);
    openPdfUrl = URL.createObjectURL(session.file);
    window.open(openPdfUrl, '_blank');
  });

  // Listen for tree node selection on the session bus
  const bus = session.bus;
  let unsubs = [];

  if (bus) {
    unsubs.push(bus.on('selectTreeNode', (payload) => {
      activeMcids = payload.mcids || null;
      if (payload.pageIndex != null && payload.pageIndex !== currentPage - 1) {
        goToPage(payload.pageIndex + 1);
      } else {
        renderOverlay();
      }
    }));
  }

  // Resize handling (only re-render in fit mode)
  const onResize = debounce(() => {
    if (!destroyed && pdfjsDoc && zoomMode === ZOOM_FIT) renderPage();
  }, 200);

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(viewportEl);

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

  function updateZoomLabel(scale) {
    if (zoomMode === ZOOM_FIT) {
      zoomLabel.textContent = 'Fit';
    } else {
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function stepZoom(direction) {
    // Find current effective scale to determine next step
    if (zoomMode === ZOOM_FIT) {
      // Switch to the nearest fixed zoom level
      const fitScale = computeFitScale();
      if (fitScale == null) return;
      let idx = ZOOM_LEVELS.findIndex((z) => z >= fitScale);
      if (idx === -1) idx = ZOOM_LEVELS.length - 1;
      idx += direction;
      idx = Math.max(0, Math.min(idx, ZOOM_LEVELS.length - 1));
      zoomMode = ZOOM_LEVELS[idx];
    } else {
      let idx = ZOOM_LEVELS.indexOf(zoomMode);
      if (idx === -1) {
        // Find nearest
        idx = ZOOM_LEVELS.findIndex((z) => z >= zoomMode);
        if (idx === -1) idx = ZOOM_LEVELS.length - 1;
      }
      idx += direction;
      idx = Math.max(0, Math.min(idx, ZOOM_LEVELS.length - 1));
      zoomMode = ZOOM_LEVELS[idx];
    }
    renderPage();
  }

  /** Return the last computed fit-to-width scale. */
  function computeFitScale() {
    return lastFitScale;
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

      const containerWidth = viewportEl.clientWidth - 16 || 400; // minus padding
      const unscaled = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / unscaled.width;
      lastFitScale = fitScale; // cache for stepZoom transitions

      const scale = zoomMode === ZOOM_FIT ? fitScale : zoomMode;
      updateZoomLabel(scale);

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

    // Draw alt text labels if toggled on
    if (altTextOn) {
      await drawAltText(textContent);
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
   *
   * PDF.js uses `item.id` (string like "p12R_mc5") for marked content,
   * not a raw integer `item.mcid`. We extract the MCID via parseMcid().
   */
  function getMcidBoundingBoxes(textContent, targetMcids) {
    const targetSet = new Set(targetMcids);
    const boxes = [];
    const mcidStack = [];

    for (const item of textContent.items) {
      if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') {
        mcidStack.push(parseMcid(item.id));
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

    if (!pdfjsDoc) return;

    const svgHeight = parseFloat(svg.getAttribute('height')) || 0;
    const svgWidth = parseFloat(svg.getAttribute('width')) || 0;
    if (!svgHeight || !svgWidth) return;

    // Coordinates in boxes are already in PDF user space.
    // The viewport transform is applied by using the rendered scale.
    const containerWidth = viewportEl.clientWidth - 16 || 400;
    pdfjsDoc.getPage(currentPage).then((page) => {
      if (destroyed) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = zoomMode === ZOOM_FIT
        ? containerWidth / unscaled.width
        : zoomMode;

      for (const box of boxes) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
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
    // Extract all distinct MCIDs from the text content in document order.
    // PDF.js reports marked content via item.id strings; we parse MCIDs from them.
    const mcidOrder = [];
    const seenMcids = new Set();
    const mcidStack = [];

    for (const item of textContent.items) {
      if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') {
        mcidStack.push(parseMcid(item.id));
      } else if (item.type === 'endMarkedContent') {
        mcidStack.pop();
      } else if (item.str != null) {
        const currentMcid = mcidStack.length > 0 ? mcidStack[mcidStack.length - 1] : null;
        if (currentMcid != null && !seenMcids.has(currentMcid)) {
          seenMcids.add(currentMcid);
          mcidOrder.push(currentMcid);
        }
      }
    }

    if (mcidOrder.length === 0) return;

    const svgHeight = parseFloat(svg.getAttribute('height')) || 0;
    if (!svgHeight) return;

    const containerWidth = viewportEl.clientWidth - 16 || 400;
    pdfjsDoc.getPage(currentPage).then((page) => {
      if (destroyed) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = zoomMode === ZOOM_FIT
        ? containerWidth / unscaled.width
        : zoomMode;

      let prevX = null;
      let prevY = null;

      for (let i = 0; i < mcidOrder.length; i++) {
        const boxes = getMcidBoundingBoxes(textContent, [mcidOrder[i]]);
        if (boxes.length === 0) continue;

        const first = boxes[0];
        const x = first.x * scale;
        const y = svgHeight - (first.y * scale) - (first.height * scale);

        // Connecting line from previous badge
        if (prevX != null) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(prevX));
          line.setAttribute('y1', String(prevY));
          line.setAttribute('x2', String(x));
          line.setAttribute('y2', String(y));
          line.setAttribute('class', 'pdf-preview__reading-order-line');
          svg.appendChild(line);
        }

        // Badge circle + number
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
        text.textContent = String(i + 1);
        g.appendChild(text);

        svg.appendChild(g);
        prevX = x;
        prevY = y;
      }
    });
  }

  /**
   * Draw alt text labels for structure tree elements that have alt text
   * and MCIDs on the current page.
   *
   * Uses text content bounding boxes when available, falling back to
   * image bounding boxes extracted from the operator list for elements
   * that contain only images (e.g., Figure elements).
   */
  async function drawAltText(textContent) {
    const tree = data && data.structureTree;
    if (!tree || !tree.root) return;

    const pageIndex = currentPage - 1;
    const nodesWithAlt = [];
    collectAltTextNodes(tree.root, pageIndex, nodesWithAlt);
    if (nodesWithAlt.length === 0) return;

    const svgHeight = parseFloat(svg.getAttribute('height')) || 0;
    if (!svgHeight) return;

    const page = await pdfjsDoc.getPage(currentPage);
    if (destroyed) return;

    const containerWidth = viewportEl.clientWidth - 16 || 400;
    const unscaled = page.getViewport({ scale: 1 });
    const scale = zoomMode === ZOOM_FIT
      ? containerWidth / unscaled.width
      : zoomMode;

    // Lazy-fetch operator list for image bounding boxes (only when needed)
    let imageBboxes = null;

    for (const node of nodesWithAlt) {
      const pageMcids = node.mcids
        .filter((m) => m.pageIndex === pageIndex || m.pageIndex == null)
        .map((m) => m.mcid);

      // Try text content bounding boxes first
      let boxes = getMcidBoundingBoxes(textContent, pageMcids);

      // Fall back to image bounding boxes from operator list
      if (boxes.length === 0) {
        if (!imageBboxes) {
          try {
            const opList = await page.getOperatorList();
            if (destroyed) return;
            imageBboxes = extractImageBboxes(opList, pdfjsLib.OPS);
          } catch (_) {
            imageBboxes = [];
          }
        }
        const targetSet = new Set(pageMcids);
        boxes = imageBboxes.filter((b) => targetSet.has(b.mcid));
        console.warn('[alt-text] Image boxes for mcids', pageMcids, ':', boxes.length);
      }

      if (boxes.length === 0) continue;

      // Use union bounding box for positioning
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const b of boxes) {
        const bx = b.x * scale;
        const by = svgHeight - (b.y * scale) - (b.height * scale);
        const bx2 = bx + b.width * scale;
        const by2 = by + b.height * scale;
        if (bx < minX) minX = bx;
        if (by < minY) minY = by;
        if (bx2 > maxX) maxX = bx2;
        if (by2 > maxY) maxY = by2;
      }

      // Draw a highlight rect around the element
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(minX));
      rect.setAttribute('y', String(minY));
      rect.setAttribute('width', String(maxX - minX));
      rect.setAttribute('height', String(maxY - minY));
      rect.setAttribute('class', 'pdf-preview__alt-highlight');
      svg.appendChild(rect);

      // Draw label below the element
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'pdf-preview__alt-label');

      const labelY = maxY + 2;
      const labelWidth = Math.max(maxX - minX, 80);

      // Background rect for label
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', String(minX));
      bgRect.setAttribute('y', String(labelY));
      bgRect.setAttribute('width', String(labelWidth));
      bgRect.setAttribute('rx', '3');
      bgRect.setAttribute('class', 'pdf-preview__alt-label-bg');
      g.appendChild(bgRect);

      // Role tag
      const roleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      roleText.setAttribute('x', String(minX + 4));
      roleText.setAttribute('class', 'pdf-preview__alt-label-role');
      roleText.textContent = node.role || node.type;
      g.appendChild(roleText);

      // Alt text (truncated)
      const altStr = node.alt.length > 80 ? node.alt.slice(0, 77) + '\u2026' : node.alt;
      const altText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      altText.setAttribute('x', String(minX + 4));
      altText.setAttribute('class', 'pdf-preview__alt-label-text');
      altText.textContent = altStr;
      g.appendChild(altText);

      // Position text lines after appending (we need to compute line heights)
      // Use fixed offsets since SVG text measuring isn't reliable in all envs
      const lineHeight = 14;
      roleText.setAttribute('y', String(labelY + lineHeight));
      altText.setAttribute('y', String(labelY + lineHeight * 2 + 2));

      const totalLabelHeight = lineHeight * 2 + 8;
      bgRect.setAttribute('height', String(totalLabelHeight));

      svg.appendChild(g);
    }
  }

  /**
   * Recursively collect tree nodes that have alt text and MCIDs on the given page.
   * Includes nodes with null pageIndex (unknown page) — the bbox lookup will
   * naturally skip them if the MCIDs don't appear on the current page.
   */
  function collectAltTextNodes(node, pageIndex, result) {
    if (!node) return;
    if (node.alt && node.mcids && node.mcids.some((m) => m.pageIndex === pageIndex || m.pageIndex == null)) {
      result.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        collectAltTextNodes(child, pageIndex, result);
      }
    }
  }

  // --- Helpers ---

  function makeSep() {
    const s = document.createElement('span');
    s.className = 'toolbar-separator';
    s.setAttribute('aria-hidden', 'true');
    return s;
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
    if (openPdfUrl) {
      URL.revokeObjectURL(openPdfUrl);
      openPdfUrl = null;
    }
  };
}
