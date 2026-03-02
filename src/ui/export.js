/**
 * Export functionality — JSON, CSV, and PDF report generation.
 *
 * Returns an object with three export methods that trigger file downloads.
 * pdf-lib is lazy-loaded only when PDF export is triggered, keeping it
 * out of the critical path for initial page load.
 */

import { STATUS_GROUPS, groupFindings, computeVerdict } from './constants.js';
import { UNDRR_CHECKLIST, resolveChecklistStatus, getAdditionalFindings } from './undrr-checklist.js';

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
 * Download audit data as a JSON file.
 *
 * @param {object} data
 */
function downloadJSON(data) {
  const output = {
    meta: data.meta,
    findings: data.findings,
    exportedAt: new Date().toISOString(),
    tool: 'PDF-A-go-actionable',
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, buildFilename(data.meta, 'json'));
}

/**
 * Download audit data as a CSV file.
 *
 * @param {object} data
 */
function downloadCSV(data) {
  const headers = [
    'id',
    'category',
    'title',
    'status',
    'summary',
    'remediation',
    'wcagRef',
    'pdfuaRef',
  ];

  const rows = [headers.join(',')];

  for (const f of data.findings) {
    const row = [
      escapeCsvField(f.id),
      escapeCsvField(f.category),
      escapeCsvField(f.title),
      escapeCsvField(f.status),
      escapeCsvField(f.summary),
      escapeCsvField(f.remediation || ''),
      escapeCsvField(f.wcagRef || ''),
      escapeCsvField(f.pdfuaRef || ''),
    ];
    rows.push(row.join(','));
  }

  const blob = new Blob([rows.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, buildFilename(data.meta, 'csv'));
}

/**
 * Download audit data as a PDF summary report.
 *
 * @param {object} data
 */
async function downloadPDF(data) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 10;
  const titleFontSize = 18;
  const verdictFontSize = 22;
  const headingFontSize = 13;
  const subheadingFontSize = 11;
  const smallFontSize = 9;
  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Helper: add a new page if needed
  function ensureSpace(needed) {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  // Helper: draw text and advance y
  function drawText(text, options = {}) {
    const {
      size = fontSize,
      useBold = false,
      color = rgb(0.13, 0.15, 0.16),
      indent = 0,
      maxWidth = contentWidth,
    } = options;
    const selectedFont = useBold ? fontBold : font;

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
  }

  // Helper: draw a horizontal rule
  function drawRule() {
    ensureSpace(8);
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 8;
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

  // === Page 1: UNDRR Checklist Summary ===
  drawChecklistPage(data, { drawText, drawRule, ensureSpace, statusColors, margin, contentWidth, fontSize, headingFontSize, smallFontSize, titleFontSize, page: () => page, y: () => y, setY: (val) => { y = val; }, rgb, font, fontBold, addPage: () => { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; } });

  // Start a new page for the detailed report
  page = pdfDoc.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;

  // === Title ===
  drawText('PDF Accessibility Report', { size: titleFontSize, useBold: true });
  y -= 4;

  // === Verdict banner ===
  const bannerPad = 14;
  const bannerGap = 6;
  // Font ascent ≈ 75% of size — baseline must sit below the ascender line
  const verdictAscent = Math.ceil(verdictFontSize * 0.75);
  const bannerHeight = bannerPad + verdictAscent + verdictFontSize + bannerGap + smallFontSize + bannerPad;
  ensureSpace(bannerHeight + 16);

  const bannerBg = statusBgColors[overallStatus];
  const bannerColor = statusColors[overallStatus];

  // Rectangle bottom-left corner; top edge aligns with current y
  const rectBottom = y - bannerHeight;
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

  y = rectBottom - 16;

  // === Document Properties ===
  drawText('Document Properties', { size: headingFontSize, useBold: true });
  y -= 2;

  const warnColor = rgb(0.64, 0.30, 0.04);
  const normalColor = rgb(0.2, 0.2, 0.2);

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
    { label: 'Display Doc Title', value: data.meta.displayDocTitle ? 'Yes' : 'No', warn: !data.meta.displayDocTitle },
    { label: 'Structure Tree', value: data.meta.hasStructTree ? 'Yes' : 'No' },
  ];

  // Tool metadata (only shown when present)
  if (data.meta.creator) metaItems.push({ label: 'Creator', value: data.meta.creator });
  if (data.meta.producer) metaItems.push({ label: 'Producer', value: data.meta.producer });

  // Render as two-column pairs for compactness
  for (let i = 0; i < metaItems.length; i += 2) {
    ensureSpace(fontSize * 1.4);
    const item1 = metaItems[i];
    const display1 = item1.value || 'Not set';
    page.drawText(`${item1.label}: ${display1}`, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: item1.warn ? warnColor : normalColor,
    });

    if (i + 1 < metaItems.length) {
      const item2 = metaItems[i + 1];
      const display2 = item2.value || 'Not set';
      page.drawText(`${item2.label}: ${display2}`, {
        x: margin + contentWidth / 2,
        y,
        size: fontSize,
        font,
        color: item2.warn ? warnColor : normalColor,
      });
    }

    y -= fontSize * 1.4;
  }

  y -= 4;
  drawText(`Generated: ${new Date().toISOString().split('T')[0]}  |  Tool: PDF-A-go-actionable`, {
    size: smallFontSize,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 8;

  drawRule();

  // === Findings grouped by status ===
  for (const group of STATUS_GROUPS) {
    const items = groups[group.key];
    if (items.length === 0) continue;

    y -= 4;
    ensureSpace(headingFontSize * 1.4 + fontSize * 1.4 + 8);

    drawText(`${group.heading.toUpperCase()} - ${items.length} check${items.length !== 1 ? 's' : ''}`, {
      size: headingFontSize,
      useBold: true,
      color: statusColors[group.key] || rgb(0.2, 0.2, 0.2),
    });
    y -= 4;

    if (group.density === 'full') {
      // Fail and warning — full detail: title, summary, remediation, refs
      for (const finding of items) {
        ensureSpace(60);

        const statusLabel = formatStatus(finding.status).toUpperCase();
        drawText(`[${statusLabel}] ${finding.title}`, {
          size: subheadingFontSize,
          useBold: true,
          color: statusColors[finding.status] || rgb(0, 0, 0),
        });

        drawText(finding.summary, { size: fontSize, indent: 10 });

        if (finding.remediation) {
          drawText(`How to fix: ${finding.remediation}`, {
            size: fontSize,
            indent: 10,
            color: rgb(0.3, 0.3, 0.3),
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
        });

        drawText(finding.summary, { size: fontSize, indent: 10 });
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
        });
      }
      y -= 4;
    }

    drawRule();
  }

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
  return `${baseName}-accessibility-report.${extension}`;
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
 * Draw the UNDRR 13-point checklist summary page.
 * Uses columnar layout: status badge | number | title — all at fixed x positions.
 *
 * @param {object} data - Audit result data
 * @param {object} h - Drawing helper functions and state
 */
function drawChecklistPage(data, h) {
  const { drawText, drawRule, ensureSpace, statusColors, margin, contentWidth, fontSize, headingFontSize, smallFontSize, titleFontSize, rgb, font, fontBold } = h;

  // Title
  drawText('PDF Accessibility Checklist', { size: titleFontSize, useBold: true });

  // File and date line
  const fileName = data.meta.fileName || 'Unknown';
  const date = new Date().toISOString().split('T')[0];
  drawText(`File: ${fileName}  |  Date: ${date}`, {
    size: smallFontSize,
    color: rgb(0.4, 0.4, 0.4),
  });

  drawText('Based on UNDRR 13-Point Validation Workflow', {
    size: smallFontSize,
    color: rgb(0.4, 0.4, 0.4),
  });

  drawRule();

  // Resolve checklist statuses
  const checklistItems = resolveChecklistStatus(data.findings);

  // Status label mapping (WinAnsi-safe, fixed-width labels)
  const statusLabels = {
    pass: 'PASS',
    fail: 'FAIL',
    warning: 'WARN',
    manual: 'MANUAL',
    'not-applicable': 'N/A',
    'not-checked': '--',
  };

  // Status background colors for badge rectangles
  const badgeBgColors = {
    pass: rgb(0.83, 0.93, 0.85),
    fail: rgb(0.97, 0.84, 0.85),
    warning: rgb(1.0, 0.95, 0.80),
    manual: rgb(0.80, 0.90, 1.0),
    'not-applicable': rgb(0.90, 0.90, 0.90),
    'not-checked': rgb(0.92, 0.92, 0.92),
  };

  // Fixed column positions
  const colStatus = margin;           // Status badge starts at left margin
  const badgeWidth = 56;              // Fixed width for all status badges
  const colNumber = margin + badgeWidth + 8;  // Number column
  const numberWidth = 22;             // Width for "13."
  const colTitle = colNumber + numberWidth;   // Title text

  const rowHeight = fontSize * 1.8;
  const badgeHeight = fontSize * 1.3;
  const badgePadY = (rowHeight - badgeHeight) / 2;

  // Access page/y through the helpers (closure)
  function drawChecklistRow(label, statusKey, numberText, titleText) {
    const page = h.page();
    const yPos = h.y();
    ensureSpace(rowHeight);

    const currentY = h.y();
    const color = statusColors[statusKey] || rgb(0.4, 0.4, 0.4);
    const bgColor = badgeBgColors[statusKey] || rgb(0.92, 0.92, 0.92);

    // Draw status badge background
    page.drawRectangle({
      x: colStatus,
      y: currentY - badgeHeight + fontSize * 0.25,
      width: badgeWidth,
      height: badgeHeight,
      color: bgColor,
      borderColor: color,
      borderWidth: 0.75,
    });

    // Draw status label centered in badge
    const labelWidth = fontBold.widthOfTextAtSize(label, fontSize - 1);
    const labelX = colStatus + (badgeWidth - labelWidth) / 2;
    page.drawText(label, {
      x: labelX,
      y: currentY,
      size: fontSize - 1,
      font: fontBold,
      color,
    });

    // Draw number
    page.drawText(numberText, {
      x: colNumber,
      y: currentY,
      size: fontSize,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Draw title
    page.drawText(titleText, {
      x: colTitle,
      y: currentY,
      size: fontSize,
      font: font,
      color: rgb(0.15, 0.15, 0.15),
    });

    h.setY(currentY - rowHeight);
  }

  // Draw each of the 13 checklist items
  for (const item of checklistItems) {
    const label = statusLabels[item.status] || '--';
    drawChecklistRow(label, item.status, `${item.undrrNumber}.`, item.title);
  }

  drawRule();

  // Additional checks section
  const additional = getAdditionalFindings(data.findings);
  if (additional.length > 0) {
    drawText('Additional Checks', {
      size: headingFontSize,
      useBold: true,
      color: rgb(0.3, 0.3, 0.3),
    });

    for (const f of additional) {
      const label = statusLabels[f.status] || '--';
      drawChecklistRow(label, f.status, '', f.title);
    }

    drawRule();
  }

  // Summary line
  const autoChecked = checklistItems.filter((i) => i.status !== 'not-checked' && i.status !== 'manual');
  const passed = autoChecked.filter((i) => i.status === 'pass' || i.status === 'not-applicable').length;
  const needsAttention = autoChecked.filter((i) => i.status === 'fail' || i.status === 'warning').length;
  const manualCount = checklistItems.filter((i) => i.status === 'manual').length;

  const parts = [];
  if (autoChecked.length > 0) parts.push(`${passed}/${autoChecked.length} automated checks passed`);
  if (needsAttention > 0) parts.push(`${needsAttention} need attention`);
  if (manualCount > 0) parts.push(`${manualCount} for manual review`);

  if (parts.length > 0) {
    drawText(`Summary: ${parts.join('  |  ')}`, {
      size: fontSize,
      useBold: true,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
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
