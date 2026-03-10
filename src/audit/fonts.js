/**
 * Fonts audit module.
 *
 * Informational: ToUnicode CMap coverage and embedding status.
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { auditToUnicodeCoverage } from '../engine/utils/accessibility-detect.js';
import { resolve } from '../engine/utils/resolve.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkFonts(pdfDoc, ctx) {
  const coverage = auditToUnicodeCoverage(pdfDoc);
  const embeddingInfo = checkFontEmbedding(pdfDoc);
  const findings = [];

  // Finding 1: ToUnicode CMap coverage
  if (coverage.total === 0) {
    findings.push({
      id: 'font-tounicode',
      category: 'fonts',
      title: 'Font Unicode Mapping',
      status: 'not-applicable',
      summary: 'No fonts found in the document.',
      details: [],
      remediation: null,
      wcagRef: '4.1.1',
      pdfuaRef: '7.21.3',
    });
  } else {
    const missingCount = coverage.fonts.filter(f => !f.hasToUnicode && !f.isStandard14).length;
    const toUnicodeDetails = coverage.fonts.map(f => ({
      label: f.name,
      value: f.isStandard14
        ? 'Standard font (ToUnicode not required)'
        : f.hasToUnicode ? 'Has ToUnicode' : 'Missing ToUnicode',
    }));

    findings.push({
      id: 'font-tounicode',
      category: 'fonts',
      title: 'Font Unicode Mapping',
      status: missingCount === 0 ? 'pass' : 'fail',
      summary: missingCount === 0
        ? `All ${coverage.total} font(s) have ToUnicode CMaps for text extraction.`
        : `${missingCount} of ${coverage.total} font(s) missing ToUnicode CMap. Screen readers cannot read this text, and copy-paste produces garbage characters.`,
      details: toUnicodeDetails,
      remediation: missingCount === 0
        ? null
        : 'Without a ToUnicode CMap, the PDF viewer cannot convert font glyph codes back to characters. Screen readers will skip or mispronounce the text, and copy-paste will produce symbols instead of words. Re-export the PDF with font embedding enabled, or use fonts that include Unicode mapping. In InDesign: File > Export > Adobe PDF > Advanced > check "Subset fonts below 100%". In Word: save as PDF (fonts are embedded by default). In Acrobat: Preflight > Embed missing fonts.',
      wcagRef: '4.1.1',
      pdfuaRef: '7.21.3',
    });
  }

  // Finding 2: Font embedding status
  if (embeddingInfo.totalChecked === 0) {
    findings.push({
      id: 'font-embedding',
      category: 'fonts',
      title: 'Font Embedding',
      status: 'not-applicable',
      summary: 'No fonts with font descriptors to check for embedding.',
      details: [],
      remediation: null,
      wcagRef: null,
      pdfuaRef: '7.21.4',
    });
  } else {
    findings.push({
      id: 'font-embedding',
      category: 'fonts',
      title: 'Font Embedding',
      status: embeddingInfo.notEmbedded === 0 ? 'pass' : 'fail',
      summary: embeddingInfo.notEmbedded === 0
        ? `All ${embeddingInfo.totalChecked} font(s) with descriptors are embedded.`
        : `${embeddingInfo.notEmbedded} of ${embeddingInfo.totalChecked} font(s) not embedded. Text may not render correctly on systems without the font installed.`,
      details: embeddingInfo.details,
      remediation: embeddingInfo.notEmbedded === 0
        ? null
        : 'Embed all fonts in the PDF. In Word: save as PDF with "embed fonts" option. In InDesign: export with "subset fonts below 100%". In Acrobat: Preflight > Embed missing fonts.',
      wcagRef: null,
      pdfuaRef: '7.21.4',
    });
  }

  return findings;
}

/** Check if a FontDescriptor has an embedded font file. */
function hasFontFile(descriptor) {
  return !!(descriptor.get(PDFName.of('FontFile'))
    || descriptor.get(PDFName.of('FontFile2'))
    || descriptor.get(PDFName.of('FontFile3')));
}

/**
 * Check font embedding status via flat scan.
 * Handles both simple fonts (with FontDescriptor) and composite Type0 fonts
 * (checking DescendantFonts CIDFont entries).
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

    // For Type0 fonts, check DescendantFonts
    if (subtypeStr === '/Type0') {
      const descendants = obj.get(PDFName.of('DescendantFonts'));
      if (descendants) {
        const descArray = resolve(descendants, context);
        if (descArray instanceof PDFArray) {
          for (let i = 0; i < descArray.size(); i++) {
            const cidFont = resolve(descArray.get(i), context);
            if (!(cidFont instanceof PDFDict)) continue;
            const cidDescRef = cidFont.get(PDFName.of('FontDescriptor'));
            if (!cidDescRef) continue;
            const cidDesc = resolve(cidDescRef, context);
            if (!(cidDesc instanceof PDFDict)) continue;
            if (hasFontFile(cidDesc)) {
              embedded++;
            } else {
              notEmbedded++;
              details.push({ label: name, value: 'Not embedded' });
            }
          }
        }
      }
      return;
    }

    // Check for font descriptor with font file (simple fonts)
    const descriptorRef = obj.get(PDFName.of('FontDescriptor'));
    if (descriptorRef) {
      const descriptor = resolve(descriptorRef, context);
      if (descriptor instanceof PDFDict) {
        if (hasFontFile(descriptor)) {
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

  return { details, totalChecked: embedded + notEmbedded, embedded, notEmbedded };
}
