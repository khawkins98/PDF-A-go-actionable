/**
 * Fonts audit module.
 *
 * Informational: ToUnicode CMap coverage and embedding status.
 */
import { PDFName, PDFDict } from 'pdf-lib';
import { auditToUnicodeCoverage } from '../engine/utils/accessibility-detect.js';
import { resolve } from '../engine/utils/resolve.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkFonts(pdfDoc, ctx) {
  const coverage = auditToUnicodeCoverage(pdfDoc);
  const fontDetails = coverage.fonts.map(f => ({
    label: f.name,
    value: f.hasToUnicode ? 'Has ToUnicode' : 'Missing ToUnicode',
  }));

  // Also check embedding status
  const embeddingInfo = checkFontEmbedding(pdfDoc);

  const allDetails = [
    ...fontDetails,
    ...embeddingInfo.details,
  ];

  if (coverage.total === 0) {
    return [{
      id: 'font-tounicode',
      category: 'fonts',
      title: 'Font Unicode Mapping',
      status: 'not-applicable',
      summary: 'No fonts found in the document.',
      details: [],
      remediation: null,
      wcagRef: null,
      pdfuaRef: '7.21.3',
    }];
  }

  const missingCount = coverage.total - coverage.withToUnicode;

  return [{
    id: 'font-tounicode',
    category: 'fonts',
    title: 'Font Unicode Mapping',
    status: missingCount === 0 ? 'pass' : 'warning',
    summary: missingCount === 0
      ? `All ${coverage.total} font(s) have ToUnicode CMaps for text extraction.`
      : `${missingCount} of ${coverage.total} font(s) missing ToUnicode CMap. Text extraction and search may not work correctly.`,
    details: allDetails,
    remediation: missingCount === 0
      ? null
      : 'Fonts without ToUnicode CMaps may prevent text copy/paste and search. Re-export the PDF with "embed fonts" enabled, or use fonts with built-in Unicode mapping.',
    wcagRef: null,
    pdfuaRef: '7.21.3',
  }];
}

/**
 * Check font embedding status via flat scan.
 */
function checkFontEmbedding(pdfDoc) {
  const context = pdfDoc.context;
  const details = [];
  let embedded = 0;
  let notEmbedded = 0;

  context.enumerateIndirectObjects().forEach(([, obj]) => {
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of('Type'));
    if (!type || type.toString() !== '/Font') return;

    const subtype = obj.get(PDFName.of('Subtype'));
    const subtypeStr = subtype ? subtype.toString() : '';
    if (subtypeStr === '/Type3' || subtypeStr === '/CIDFontType0' || subtypeStr === '/CIDFontType2') return;

    const baseFont = obj.get(PDFName.of('BaseFont'));
    const name = baseFont ? baseFont.toString().replace(/^\//, '') : 'Unknown';

    // Check for font descriptor with font file
    const descriptorRef = obj.get(PDFName.of('FontDescriptor'));
    if (descriptorRef) {
      const descriptor = resolve(descriptorRef, context);
      if (descriptor instanceof PDFDict) {
        const hasFile = descriptor.get(PDFName.of('FontFile'))
          || descriptor.get(PDFName.of('FontFile2'))
          || descriptor.get(PDFName.of('FontFile3'));
        if (hasFile) {
          embedded++;
        } else {
          notEmbedded++;
          details.push({ label: name, value: 'Not embedded' });
        }
      }
    }
  });

  if (notEmbedded > 0) {
    details.unshift({
      label: 'Embedding summary',
      value: `${embedded} embedded, ${notEmbedded} not embedded`,
    });
  }

  return { details };
}
