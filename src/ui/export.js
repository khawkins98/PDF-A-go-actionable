/**
 * Export functionality — JSON, CSV, and PDF report generation.
 *
 * Returns an object with three export methods that trigger file downloads.
 * pdf-lib is lazy-loaded only when PDF export is triggered, keeping it
 * out of the critical path for initial page load.
 */

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
  const headingFontSize = 14;
  const subheadingFontSize = 11;
  const lineHeight = fontSize * 1.4;
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

  // Title
  drawText('PDF Accessibility Report', { size: titleFontSize, useBold: true });
  y -= 8;

  // Meta info
  drawText(`File: ${data.meta.fileName || 'Unknown'}`, { size: fontSize });
  drawText(`Pages: ${data.meta.pageCount || 'Unknown'}`, { size: fontSize });
  drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, { size: fontSize });
  drawText(`Tool: PDF-A-go-actionable`, { size: fontSize });
  y -= 12;

  // Summary counts
  const counts = { pass: 0, fail: 0, warning: 0, manual: 0, 'not-applicable': 0 };
  for (const f of data.findings) {
    if (f.status in counts) counts[f.status]++;
  }

  drawText('Summary', { size: headingFontSize, useBold: true });
  y -= 4;
  drawText(`Pass: ${counts.pass}  |  Fail: ${counts.fail}  |  Warning: ${counts.warning}  |  Manual: ${counts.manual}  |  N/A: ${counts['not-applicable']}`, { size: fontSize });
  y -= 12;

  // Status color mapping for PDF
  const statusColors = {
    pass: rgb(0.17, 0.54, 0.24),
    fail: rgb(0.79, 0.17, 0.17),
    warning: rgb(0.90, 0.47, 0),
    manual: rgb(0.09, 0.39, 0.67),
    'not-applicable': rgb(0.53, 0.56, 0.59),
  };

  // Findings
  drawText('Findings', { size: headingFontSize, useBold: true });
  y -= 6;

  for (const finding of data.findings) {
    ensureSpace(60);

    // Status + Title line
    const statusColor = statusColors[finding.status] || rgb(0, 0, 0);
    const statusLabel = formatStatus(finding.status).toUpperCase();

    drawText(`[${statusLabel}] ${finding.title}`, {
      size: subheadingFontSize,
      useBold: true,
      color: statusColor,
    });

    // Summary
    drawText(finding.summary, { size: fontSize, indent: 10 });

    // Remediation
    if (finding.remediation) {
      drawText(`How to fix: ${finding.remediation}`, {
        size: fontSize,
        indent: 10,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    // References
    const refs = [];
    if (finding.wcagRef) refs.push(`WCAG ${finding.wcagRef}`);
    if (finding.pdfuaRef) refs.push(`PDF/UA ${finding.pdfuaRef}`);
    if (refs.length > 0) {
      drawText(`References: ${refs.join(', ')}`, {
        size: fontSize - 1,
        indent: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    y -= 8;
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
