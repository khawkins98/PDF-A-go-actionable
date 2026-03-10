/**
 * Export functionality — JSON, CSV, and PDF report generation.
 *
 * Returns an object with three export methods that trigger file downloads.
 * pdf-lib is lazy-loaded only when PDF export is triggered, keeping it
 * out of the critical path for initial page load.
 */

import { STATUS_GROUPS, groupFindings, computeVerdict } from './constants.js';

/**
 * Initialize export functionality for the given audit data.
 *
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 * @param {object} data.meta - Document metadata
 * @returns {{ exportJSON: Function, exportCSV: Function, exportPDF: Function }}
 */
export function initExport(data) {
  return {
    exportJSON: () => downloadJSON(data),
    exportCSV: () => downloadCSV(data),
    exportPDF: () => downloadPDF(data),
  };
}

/**
 * Build the JSON export output object.
 *
 * @param {object} data
 * @returns {object}
 */
export function buildJsonOutput(data) {
  return {
    meta: data.meta,
    findings: data.findings,
    exportedAt: new Date().toISOString(),
    tool: 'PDF-A-go-actionable',
  };
}

/**
 * Download audit data as a JSON file.
 *
 * @param {object} data
 */
function downloadJSON(data) {
  const output = buildJsonOutput(data);

  const blob = new Blob([JSON.stringify(output, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, buildFilename(data.meta, 'json'));
}

/**
 * Build the CSV content string.
 *
 * @param {object} data
 * @returns {string}
 */
export function buildCsvContent(data) {
  const headers = [
    'id',
    'category',
    'title',
    'status',
    'summary',
    'details',
    'remediation',
    'wcagRef',
    'pdfuaRef',
  ];

  const rows = [headers.join(',')];

  for (const f of data.findings) {
    const detailsStr = (f.details || [])
      .map(d => `${d.label}: ${d.value}`)
      .join('; ');

    const row = [
      escapeCsvField(f.id),
      escapeCsvField(f.category),
      escapeCsvField(f.title),
      escapeCsvField(f.status),
      escapeCsvField(f.summary),
      escapeCsvField(detailsStr),
      escapeCsvField(f.remediation || ''),
      escapeCsvField(f.wcagRef || ''),
      escapeCsvField(f.pdfuaRef || ''),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Download audit data as a CSV file.
 *
 * @param {object} data
 */
function downloadCSV(data) {
  const csvContent = buildCsvContent(data);

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, buildFilename(data.meta, 'csv'));
}

/**
 * Download audit data as a PDF summary report.
 *
 * @param {object} data
 */
/** Tool branding URLs used in the PDF export header and footer. */
export const TOOL_URL = 'https://khawkins98.github.io/PDF-A-go-actionable/';
export const REPO_URL = 'https://github.com/khawkins98/PDF-A-go-actionable';

async function downloadPDF(data) {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFHexString, PDFStream, PDFOperator } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  const reportTitle = `Accessibility Report: ${data.meta.fileName || 'Unknown'}`;

  // Set PDF metadata on the exported report
  pdfDoc.setTitle(reportTitle);
  pdfDoc.setAuthor('PDF-A-go-actionable');
  pdfDoc.setSubject('PDF accessibility audit report');
  pdfDoc.setProducer('PDF-A-go-actionable');
  pdfDoc.setCreator('PDF-A-go-actionable');
  pdfDoc.setKeywords(['PDF accessibility', 'WCAG', 'audit report', 'PDF/UA', 'assistive technology']);
  pdfDoc.setCreationDate(new Date());

  // Document language (fixes "Document Language" fail)
  pdfDoc.catalog.set(PDFName.of('Lang'), PDFString.of('en'));

  // Display document title in viewer title bar (fixes "Display Document Title" warning)
  const viewerPrefs = pdfDoc.context.obj({ DisplayDocTitle: true });
  pdfDoc.catalog.set(PDFName.of('ViewerPreferences'), viewerPrefs);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const fontSize = 10;
  const titleFontSize = 18;
  const verdictFontSize = 22;
  const headingFontSize = 13;
  const subheadingFontSize = 11;
  const smallFontSize = 9;
  const tinyFontSize = 7.5;
  const margin = 50;
  const footerHeight = 28;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = margin + footerHeight;

  const pages = [];

  // Helper: create a page with tab order set to structure (fixes "Tab Order" warning)
  function addNewPage() {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    p.node.set(PDFName.of('Tabs'), PDFName.of('S'));
    pages.push(p);
    return p;
  }

  let page = addNewPage();
  let y = pageHeight - margin;

  // Bookmark positions collected during rendering
  const bookmarks = [];

  // === Marked content tracking for structure tree ===
  let nextMcid = 0;
  // Each entry: { role, mcid, pageRef (page.ref), altText? }
  const mcidEntries = [];

  // Begin a marked content sequence on the current page
  function beginMark(role) {
    const mcid = nextMcid++;
    page.pushOperators(
      PDFOperator.of('BDC', [PDFName.of(role), pdfDoc.context.obj({ MCID: mcid })]),
    );
    mcidEntries.push({ role, mcid, pageRef: page.ref });
    return mcid;
  }

  // End the current marked content sequence
  function endMark() {
    page.pushOperators(PDFOperator.of('EMC'));
  }

  // Helper: add a new page if needed
  function ensureSpace(needed) {
    if (y - needed < bottomMargin) {
      page = addNewPage();
      y = pageHeight - margin;
    }
  }

  // Helper: draw text and advance y, optionally wrapped in marked content
  function drawText(text, options = {}) {
    const {
      size = fontSize,
      useBold = false,
      useOblique = false,
      color = rgb(0.13, 0.15, 0.16),
      indent = 0,
      maxWidth = contentWidth,
      role,
    } = options;
    const selectedFont = useBold ? fontBold : useOblique ? fontOblique : font;

    // Simple word-wrap
    const words = text.split(' ');
    let line = '';
    const lines = [];
    const effectiveWidth = maxWidth - indent;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = selectedFont.widthOfTextAtSize(testLine, size);
      if (testWidth > effectiveWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);

    const totalHeight = lines.length * (size * 1.4);
    ensureSpace(totalHeight);

    if (role) beginMark(role);

    for (const l of lines) {
      page.drawText(l, {
        x: margin + indent,
        y,
        size,
        font: selectedFont,
        color,
      });
      y -= size * 1.4;
    }

    if (role) endMark();
  }

  // Helper: draw the logo mark (favicon replica) at given position
  function drawLogoMark(targetPage, lx, ly, size) {
    const s = size;
    // Dark square background
    targetPage.drawRectangle({
      x: lx, y: ly, width: s, height: s,
      color: rgb(0.2, 0.2, 0.2),
    });
    // White "A" centered
    const aSize = s * 0.55;
    const aWidth = fontBold.widthOfTextAtSize('A', aSize);
    targetPage.drawText('A', {
      x: lx + (s - aWidth) / 2,
      y: ly + s * 0.25,
      size: aSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    // Green dot upper-right
    targetPage.drawCircle({
      x: lx + s * 0.82,
      y: ly + s * 0.82,
      size: s * 0.14,
      color: rgb(0.13, 0.77, 0.37),
    });
  }

  // Helper: add a clickable URI link annotation to a page region
  function addLinkAnnotation(targetPage, x, bottomY, width, height, url) {
    const linkAnnot = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, bottomY, x + width, bottomY + height],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: url },
      }),
    );
    const existing = targetPage.node.get(PDFName.of('Annots'));
    if (existing) {
      pdfDoc.context.lookup(existing).push(linkAnnot);
    } else {
      targetPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnot]));
    }
  }

  // Helper: truncate text with ellipsis to fit within maxWidth
  function truncateToFit(text, selectedFont, size, maxWidth) {
    if (selectedFont.widthOfTextAtSize(text, size) <= maxWidth) return text;
    const ellipsis = '...';
    const ellipsisW = selectedFont.widthOfTextAtSize(ellipsis, size);
    let truncated = text;
    while (truncated.length > 1 && selectedFont.widthOfTextAtSize(truncated, size) + ellipsisW > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }

  // Helper: draw a section heading with colored accent bar (also records bookmark)
  function drawSectionHeading(text, accentColor, { bookmark = true } = {}) {
    const headingH = headingFontSize * 1.4 + 10;
    ensureSpace(headingH + 8);

    if (bookmark) {
      bookmarks.push({ title: text, page, y: y + headingFontSize });
    }

    beginMark('H2');

    // Accent bar (thin vertical stripe)
    page.drawRectangle({
      x: margin,
      y: y - headingFontSize * 0.35,
      width: 3,
      height: headingFontSize,
      color: accentColor,
    });

    page.drawText(text, {
      x: margin + 10,
      y,
      size: headingFontSize,
      font: fontBold,
      color: rgb(0.13, 0.15, 0.16),
    });

    endMark();

    y -= headingFontSize * 1.4;
    y -= 4;
  }

  // Status color mapping
  const statusColors = {
    pass: rgb(0.17, 0.54, 0.24),
    fail: rgb(0.79, 0.17, 0.17),
    warning: rgb(0.90, 0.47, 0),
    manual: rgb(0.09, 0.39, 0.67),
    'not-applicable': rgb(0.53, 0.56, 0.59),
  };

  // Status background colors (lighter tints for verdict banner)
  const statusBgColors = {
    pass: rgb(0.83, 0.93, 0.85),
    fail: rgb(0.97, 0.84, 0.85),
    warning: rgb(1.0, 0.95, 0.80),
  };

  // === Group findings ===
  const groups = groupFindings(data.findings);
  const { overallStatus, label: verdictLabel, description: verdictDesc } = computeVerdict(groups);

  // === Branded header (linked to tool URL) ===
  const logoSize = 22;
  const headerY = y;

  beginMark('Artifact');
  drawLogoMark(page, margin, headerY - logoSize + 4, logoSize);
  endMark();

  // Tool name next to logo
  const nameX = margin + logoSize + 8;
  beginMark('P');
  page.drawText('PDF-A-go-actionable', {
    x: nameX,
    y: headerY - 3,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Tagline below tool name
  page.drawText('Free PDF Accessibility Checker', {
    x: nameX,
    y: headerY - 16,
    size: smallFontSize,
    font: fontOblique,
    color: rgb(0.45, 0.47, 0.50),
  });
  endMark();

  // Clickable link over entire header area
  const headerLinkW = fontBold.widthOfTextAtSize('PDF-A-go-actionable', 14) + logoSize + 8;
  addLinkAnnotation(page, margin, headerY - logoSize + 4, headerLinkW, logoSize, TOOL_URL);

  y = headerY - logoSize - 12;

  // Thin separator after header
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 16;

  // === Report title + file info ===
  drawText('PDF Accessibility Report', { size: titleFontSize, useBold: true, role: 'H1' });
  y -= 2;
  const fileName = data.meta.fileName || 'Unknown';
  const now = new Date();
  const dateStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;
  drawText(`${fileName}  |  ${dateStr}`, {
    size: smallFontSize,
    color: rgb(0.45, 0.47, 0.50),
    role: 'P',
  });
  y -= 10;

  // === Verdict banner ===
  const bannerPad = 14;
  const bannerGap = 6;
  // Font ascent ~ 75% of size — baseline must sit below the ascender line
  const verdictAscent = Math.ceil(verdictFontSize * 0.75);
  const bannerHeight = bannerPad + verdictAscent + verdictFontSize + bannerGap + smallFontSize + bannerPad;
  ensureSpace(bannerHeight + 16);

  const bannerBg = statusBgColors[overallStatus];
  const bannerColor = statusColors[overallStatus];

  // Rectangle bottom-left corner; top edge aligns with current y
  const rectBottom = y - bannerHeight;

  beginMark('Sect');
  page.drawRectangle({
    x: margin,
    y: rectBottom,
    width: contentWidth,
    height: bannerHeight,
    color: bannerBg,
    borderColor: bannerColor,
    borderWidth: 1.5,
  });

  // Label baseline: top of banner minus padding minus ascent (ascenders stay inside)
  const labelBaseline = y - bannerPad - verdictAscent;
  page.drawText(verdictLabel, {
    x: margin + bannerPad,
    y: labelBaseline,
    size: verdictFontSize,
    font: fontBold,
    color: bannerColor,
  });

  // Description baseline: below the label
  const descBaseline = labelBaseline - verdictFontSize - bannerGap;
  page.drawText(verdictDesc, {
    x: margin + bannerPad,
    y: descBaseline,
    size: smallFontSize,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  endMark();

  y = rectBottom - 16;

  // === Document Properties ===
  drawSectionHeading('Document Properties', rgb(0.2, 0.2, 0.2));

  const warnColor = rgb(0.64, 0.30, 0.04);
  const normalColor = rgb(0.3, 0.3, 0.3);
  const labelColor = rgb(0.13, 0.15, 0.16);

  const metaItems = [
    { label: 'File', value: data.meta.fileName || 'Unknown' },
    { label: 'Title', value: data.meta.title, warn: !data.meta.title },
    { label: 'Author', value: data.meta.author, warn: !data.meta.author },
    { label: 'Subject', value: data.meta.subject, warn: !data.meta.subject },
    { label: 'Keywords', value: data.meta.keywords, warn: !data.meta.keywords },
    { label: 'Language', value: data.meta.lang, warn: !data.meta.lang },
    { label: 'Pages', value: data.meta.pageCount != null ? String(data.meta.pageCount) : 'Unknown' },
    { label: 'Tagged', value: data.meta.isTagged ? 'Yes' : 'No', warn: !data.meta.isTagged },
    { label: 'PDF/UA', value: data.meta.isPdfUA ? 'Yes' : 'No' },
    { label: 'PDF/A', value: data.meta.isPdfA ? `Yes (${data.meta.pdfALevel || 'level unknown'})` : 'No' },
    { label: 'Viewer Shows Title', value: data.meta.displayDocTitle ? 'Yes' : 'No' },
    { label: 'Structure Tree', value: data.meta.hasStructTree ? 'Yes' : 'No' },
  ];

  // Tool metadata (only shown when present)
  if (data.meta.creator) metaItems.push({ label: 'Creator', value: data.meta.creator });
  if (data.meta.producer) metaItems.push({ label: 'Producer', value: data.meta.producer });

  // Render as two-column grid with bold labels (values truncated to column)
  const colWidth = (contentWidth - 12) / 2; // gap between columns
  const col1X = margin + 4;
  const col2X = margin + 4 + colWidth + 12;

  for (let i = 0; i < metaItems.length; i += 2) {
    ensureSpace(fontSize * 1.4);

    beginMark('P');

    // Column 1
    const item1 = metaItems[i];
    const display1 = item1.value || 'Not set';
    const label1Width = fontBold.widthOfTextAtSize(`${item1.label}: `, fontSize);
    page.drawText(`${item1.label}: `, {
      x: col1X, y, size: fontSize, font: fontBold, color: labelColor,
    });
    const val1 = truncateToFit(display1, font, fontSize, colWidth - label1Width);
    page.drawText(val1, {
      x: col1X + label1Width, y, size: fontSize, font,
      color: item1.warn ? warnColor : normalColor,
    });

    // Column 2
    if (i + 1 < metaItems.length) {
      const item2 = metaItems[i + 1];
      const display2 = item2.value || 'Not set';
      const label2Width = fontBold.widthOfTextAtSize(`${item2.label}: `, fontSize);
      page.drawText(`${item2.label}: `, {
        x: col2X, y, size: fontSize, font: fontBold, color: labelColor,
      });
      const val2 = truncateToFit(display2, font, fontSize, colWidth - label2Width);
      page.drawText(val2, {
        x: col2X + label2Width, y, size: fontSize, font,
        color: item2.warn ? warnColor : normalColor,
      });
    }

    endMark();

    y -= fontSize * 1.4;
  }

  y -= 16;

  // === Findings grouped by status ===
  for (const group of STATUS_GROUPS) {
    const items = groups[group.key];
    if (items.length === 0) continue;

    y -= 4;

    const accentColor = statusColors[group.key] || rgb(0.4, 0.4, 0.4);
    drawSectionHeading(
      `${group.heading.toUpperCase()} - ${items.length} check${items.length !== 1 ? 's' : ''}`,
      accentColor,
    );

    if (group.density === 'full') {
      // Fail and warning — full detail: title, summary, remediation, refs
      for (const finding of items) {
        ensureSpace(60);

        const statusLabel = formatStatus(finding.status).toUpperCase();
        drawText(`[${statusLabel}] ${finding.title}`, {
          size: subheadingFontSize,
          useBold: true,
          color: statusColors[finding.status] || rgb(0, 0, 0),
          role: 'H3',
        });

        drawText(finding.summary, { size: fontSize, indent: 10, role: 'P' });

        if (finding.details && finding.details.length > 0) {
          for (const detail of finding.details) {
            drawText(`${detail.label}: ${detail.value}`, {
              size: smallFontSize,
              indent: 20,
              color: rgb(0.35, 0.35, 0.35),
              role: 'P',
            });
          }
        }

        if (finding.remediation) {
          drawText(`How to fix: ${finding.remediation}`, {
            size: fontSize,
            indent: 10,
            color: rgb(0.3, 0.3, 0.3),
            role: 'P',
          });
        }

        const refs = [];
        if (finding.wcagRef) refs.push(`WCAG ${finding.wcagRef}`);
        if (finding.pdfuaRef) refs.push(`PDF/UA ${finding.pdfuaRef}`);
        if (refs.length > 0) {
          drawText(`References: ${refs.join(', ')}`, {
            size: smallFontSize,
            indent: 10,
            color: rgb(0.5, 0.5, 0.5),
            role: 'P',
          });
        }

        y -= 6;
      }
    } else if (group.density === 'compact') {
      // Manual — title + summary, no remediation
      for (const finding of items) {
        ensureSpace(40);

        drawText(`[${formatStatus(finding.status).toUpperCase()}] ${finding.title}`, {
          size: subheadingFontSize,
          useBold: true,
          color: statusColors[finding.status] || rgb(0, 0, 0),
          role: 'H3',
        });

        drawText(finding.summary, { size: fontSize, indent: 10, role: 'P' });
        y -= 4;
      }
    } else {
      // Pass and N/A — just titles on one line each
      for (const finding of items) {
        ensureSpace(fontSize * 1.4);

        const prefix = group.key === 'pass' ? '[PASS]' : '[N/A]';
        drawText(`${prefix}  ${finding.title}`, {
          size: fontSize,
          color: statusColors[group.key] || rgb(0.3, 0.3, 0.3),
          role: 'P',
        });
      }
      y -= 4;
    }

    y -= 4;
  }

  // === Page footers ===
  const totalPages = pages.length;
  const footerLineY = margin + footerHeight - 4;
  const footerTextY = margin + 8;
  const footerColor = rgb(0.5, 0.52, 0.55);
  const linkColor = rgb(0.09, 0.39, 0.67);
  const footerLinkText = 'View on GitHub';
  const footerLinkWidth = font.widthOfTextAtSize(footerLinkText, tinyFontSize);

  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];

    // Thin line above footer
    p.drawLine({
      start: { x: margin, y: footerLineY },
      end: { x: pageWidth - margin, y: footerLineY },
      thickness: 0.5,
      color: rgb(0.78, 0.80, 0.82),
    });

    // Mini logo in footer
    drawLogoMark(p, margin, footerTextY - 2, 10);

    // Tool name
    const footerNameText = 'PDF-A-go-actionable';
    p.drawText(footerNameText, {
      x: margin + 14,
      y: footerTextY,
      size: tinyFontSize,
      font: fontBold,
      color: footerColor,
    });

    // "View on GitHub" link
    const footerNameW = fontBold.widthOfTextAtSize(footerNameText, tinyFontSize);
    const separatorText = '  |  ';
    const separatorW = font.widthOfTextAtSize(separatorText, tinyFontSize);
    const linkX = margin + 14 + footerNameW + separatorW;

    p.drawText(separatorText, {
      x: margin + 14 + footerNameW,
      y: footerTextY,
      size: tinyFontSize,
      font,
      color: footerColor,
    });
    p.drawText(footerLinkText, {
      x: linkX,
      y: footerTextY,
      size: tinyFontSize,
      font,
      color: linkColor,
    });
    addLinkAnnotation(p, linkX, footerTextY - 2, footerLinkWidth, tinyFontSize + 4, REPO_URL);

    // Page number right-aligned
    const pageLabel = `Page ${i + 1} of ${totalPages}`;
    const pageLabelWidth = font.widthOfTextAtSize(pageLabel, tinyFontSize);
    p.drawText(pageLabel, {
      x: pageWidth - margin - pageLabelWidth,
      y: footerTextY,
      size: tinyFontSize,
      font,
      color: footerColor,
    });
  }

  // === Structure Tree (Tagged PDF) ===
  if (mcidEntries.length > 0) {
    // Mark the document as tagged
    pdfDoc.catalog.set(PDFName.of('MarkInfo'), pdfDoc.context.obj({ Marked: true }));

    // Create Document root StructElem
    const structTreeRoot = pdfDoc.context.register(pdfDoc.context.obj({
      Type: 'StructTreeRoot',
    }));
    const docElem = pdfDoc.context.register(pdfDoc.context.obj({
      Type: 'StructElem',
      S: 'Document',
      P: structTreeRoot,
    }));

    // Build a StructElem for each marked content entry
    const childRefs = [];
    // Group MCIDs by page for ParentTree
    const pageToMcids = new Map();

    for (const entry of mcidEntries) {
      const childRef = pdfDoc.context.register(pdfDoc.context.obj({
        Type: 'StructElem',
        S: entry.role,
        P: docElem,
        K: entry.mcid,
        Pg: entry.pageRef,
      }));
      childRefs.push(childRef);

      if (!pageToMcids.has(entry.pageRef)) pageToMcids.set(entry.pageRef, []);
      pageToMcids.get(entry.pageRef).push({ mcid: entry.mcid, elemRef: childRef });
    }

    // Set children on Document elem
    const docDict = pdfDoc.context.lookup(docElem);
    docDict.set(PDFName.of('K'), pdfDoc.context.obj(childRefs));

    // Build ParentTree (maps MCID → StructElem for each page)
    const parentTreeNums = [];
    let pageIdx = 0;
    for (const p of pages) {
      const entries = pageToMcids.get(p.ref);
      if (entries) {
        // Build array mapping MCID index → StructElem ref
        const mcidToElem = [];
        for (const e of entries) mcidToElem[e.mcid] = e.elemRef;
        // Fill gaps with null refs
        const arr = [];
        for (let m = 0; m <= Math.max(...entries.map(e => e.mcid)); m++) {
          arr.push(mcidToElem[m] || null);
        }
        parentTreeNums.push(pageIdx, pdfDoc.context.obj(arr.filter(Boolean)));
      }
      // Set StructParents on the page
      p.node.set(PDFName.of('StructParents'), pdfDoc.context.obj(pageIdx));
      pageIdx++;
    }

    const parentTree = pdfDoc.context.register(pdfDoc.context.obj({
      Type: 'NumberTree',
      Nums: parentTreeNums,
    }));

    // Wire up StructTreeRoot
    const rootDict = pdfDoc.context.lookup(structTreeRoot);
    rootDict.set(PDFName.of('K'), docElem);
    rootDict.set(PDFName.of('ParentTree'), parentTree);
    rootDict.set(PDFName.of('ParentTreeNextKey'), pdfDoc.context.obj(pageIdx));
    pdfDoc.catalog.set(PDFName.of('StructTreeRoot'), structTreeRoot);
  }

  // === Bookmarks (Outlines) ===
  // Build outline entries from bookmark positions collected during rendering
  if (bookmarks.length > 0) {
    const outlineItems = bookmarks.map((bm, idx) => {
      const ref = pdfDoc.context.register(pdfDoc.context.obj({}));
      return { ref, bm, idx };
    });

    const outlineRoot = pdfDoc.context.register(pdfDoc.context.obj({
      Type: 'Outlines',
      Count: outlineItems.length,
    }));

    for (let i = 0; i < outlineItems.length; i++) {
      const { ref, bm } = outlineItems[i];
      const prev = i > 0 ? outlineItems[i - 1].ref : undefined;
      const next = i < outlineItems.length - 1 ? outlineItems[i + 1].ref : undefined;
      const dict = pdfDoc.context.lookup(ref);
      dict.set(PDFName.of('Title'), PDFHexString.fromText(bm.title));
      dict.set(PDFName.of('Parent'), outlineRoot);
      dict.set(PDFName.of('Dest'), pdfDoc.context.obj([bm.page.ref, 'XYZ', null, bm.y, null]));
      if (prev) dict.set(PDFName.of('Prev'), prev);
      if (next) dict.set(PDFName.of('Next'), next);
    }

    const rootDict = pdfDoc.context.lookup(outlineRoot);
    rootDict.set(PDFName.of('First'), outlineItems[0].ref);
    rootDict.set(PDFName.of('Last'), outlineItems[outlineItems.length - 1].ref);
    pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRoot);
  }

  // === XMP Metadata (fixes "Document Title" warning about missing XMP) ===
  const xmpXml = buildXmpMetadata(reportTitle);
  const xmpStream = pdfDoc.context.stream(new TextEncoder().encode(xmpXml), {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: new TextEncoder().encode(xmpXml).length,
  });
  const xmpRef = pdfDoc.context.register(xmpStream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), xmpRef);

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  triggerDownload(blob, buildFilename(data.meta, 'pdf'));
}

/**
 * Escape a field for CSV output.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeCsvField(value) {
  if (value == null) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a download filename from metadata.
 *
 * @param {object} meta
 * @param {string} extension - File extension (json, csv, pdf)
 * @returns {string}
 */
export function buildFilename(meta, extension) {
  const baseName = meta.fileName
    ? meta.fileName.replace(/\.pdf$/i, '')
    : 'accessibility-report';
  const now = new Date();
  const stamp = now.toISOString().replace(/[:T]/g, '-').replace(/\.\d+Z$/, '');
  return `${baseName}-report-${stamp}.${extension}`;
}

/**
 * Trigger a browser file download from a Blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Build XMP metadata XML for the PDF export.
 * Sets dc:title so the title appears in XMP (not just Info dict).
 *
 * @param {string} title - Document title
 * @returns {string} XMP XML string
 */
export function buildXmpMetadata(title) {
  // Escape XML special characters in the title
  const esc = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about=""',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  xmlns:xmp="http://ns.adobe.com/xap/1.0/"',
    '  xmlns:pdf="http://ns.adobe.com/pdf/1.3/">',
    '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' + esc + '</rdf:li></rdf:Alt></dc:title>',
    '<dc:creator><rdf:Seq><rdf:li>PDF-A-go-actionable</rdf:li></rdf:Seq></dc:creator>',
    '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">PDF accessibility audit report</rdf:li></rdf:Alt></dc:description>',
    '<xmp:CreatorTool>PDF-A-go-actionable</xmp:CreatorTool>',
    '<pdf:Producer>PDF-A-go-actionable</pdf:Producer>',
    '</rdf:Description>',
    '</rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');
}

/**
 * Format a status string for display.
 *
 * @param {string} status
 * @returns {string}
 */
function formatStatus(status) {
  switch (status) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'warning': return 'Warning';
    case 'manual': return 'Manual';
    case 'not-applicable': return 'N/A';
    default: return status;
  }
}
