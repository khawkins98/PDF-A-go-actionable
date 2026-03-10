/**
 * Audit runner — orchestrates all audit modules.
 *
 * Loads the PDF, builds shared context (traits, RoleMap, StructTreeRoot),
 * runs each audit module sequentially, and collects findings.
 */
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { detectAccessibilityTraits } from '../engine/utils/accessibility-detect.js';
import { getRoleMapFromDoc } from '../engine/utils/role-map.js';
import { resolve } from '../engine/utils/resolve.js';
import { checkMetadata } from './metadata.js';
import { checkStructure } from './structure.js';
import { checkImages } from './images.js';
import { checkTables } from './tables.js';
import { checkLists } from './lists.js';
import { checkFonts } from './fonts.js';
import { checkForms } from './forms.js';
import { checkLinks } from './links.js';
import { checkReadingOrder } from './reading-order.js';
import { buildSerializableTree, buildPageRefMap } from '../engine/utils/serialize-tree.js';
import { walkStructureTree } from '../engine/utils/struct-tree-walker.js';

/**
 * Run the full accessibility audit on a PDF buffer.
 *
 * @param {ArrayBuffer} buffer - The PDF file bytes
 * @param {object} options
 * @param {string} [options.fileName] - Original filename
 * @param {function} [options.onProgress] - Progress callback (phase, percent)
 * @returns {Promise<{ findings: object[], meta: object }>}
 */
export async function runAudit(buffer, options = {}) {
  const { fileName, onProgress } = options;

  const report = (phase, percent) => {
    if (onProgress) onProgress(phase, percent);
  };

  // Load PDF
  report('loading', 0);

  // Check for PDF magic bytes (%PDF-)
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer);
  const magic = bytes.length >= 5
    ? String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4])
    : '';
  if (magic !== '%PDF-') {
    return buildLoadFailure(
      'This file does not appear to be a PDF. Expected %PDF- header.',
      'Make sure you are uploading a PDF file, not another format (e.g., Word, image, or text file).',
      fileName, buffer.byteLength,
    );
  }

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (firstError) {
    try {
      pdfDoc = await PDFDocument.load(buffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch (secondError) {
      // Provide specific messages based on error type
      const msg = firstError.message || '';
      let summary, remediation;
      if (/encrypt/i.test(msg) || /password/i.test(msg)) {
        summary = 'This PDF is password-protected and cannot be analyzed.';
        remediation = 'Remove the password protection before analyzing. In Acrobat: File > Properties > Security > No Security.';
      } else {
        summary = `Unable to parse PDF: ${msg}`;
        remediation = 'The file may be corrupted. Try re-exporting from the source application.';
      }
      return buildLoadFailure(summary, remediation, fileName, buffer.byteLength);
    }
  }

  report('analyzing', 10);

  // Build shared context
  const traits = detectAccessibilityTraits(pdfDoc);
  const roleMap = getRoleMapFromDoc(pdfDoc);
  const context = pdfDoc.context;

  // Resolve StructTreeRoot for modules that need it
  const catalog = pdfDoc.catalog;
  const structTreeRootRef = catalog.get(PDFName.of('StructTreeRoot'));
  let structTreeRoot = null;
  if (structTreeRootRef) {
    const resolved = resolve(structTreeRootRef, context);
    if (resolved instanceof PDFDict) {
      structTreeRoot = resolved;
    }
  }

  // Build page ref map for resolving /Pg refs to page indices
  const pageRefMap = traits.hasStructTree ? buildPageRefMap(pdfDoc) : new Map();

  // Lazy cached structure tree walk — computed once, shared across modules
  let _structureElements = null;
  const getStructureElements = () => {
    if (_structureElements === null) {
      _structureElements = traits.hasStructTree ? walkStructureTree(pdfDoc, roleMap) : [];
    }
    return _structureElements;
  };

  const sharedContext = {
    pdfDoc,
    context,
    traits,
    roleMap,
    structTreeRoot,
    pageRefMap,
    getStructureElements,
  };

  // Run audit modules
  const modules = [
    { name: 'metadata', fn: checkMetadata, percent: 20 },
    { name: 'structure', fn: checkStructure, percent: 30 },
    { name: 'images', fn: checkImages, percent: 40 },
    { name: 'tables', fn: checkTables, percent: 50 },
    { name: 'lists', fn: checkLists, percent: 60 },
    { name: 'fonts', fn: checkFonts, percent: 70 },
    { name: 'forms', fn: checkForms, percent: 80 },
    { name: 'links', fn: checkLinks, percent: 85 },
    { name: 'reading-order', fn: checkReadingOrder, percent: 90 },
  ];

  const findings = [];

  for (const mod of modules) {
    report(mod.name, mod.percent);
    try {
      const modFindings = mod.fn(pdfDoc, sharedContext);
      findings.push(...modFindings);
    } catch (err) {
      findings.push({
        id: `${mod.name}-error`,
        category: mod.name,
        title: `${mod.name} check error`,
        status: 'warning',
        summary: `The ${mod.name} check failed: ${err.message}`,
        details: [],
        remediation: 'This check didn\'t complete. The PDF may have unusual structure.',
        wcagRef: null,
        pdfuaRef: null,
      });
    }
  }

  // Build serializable structure tree for interactive UI
  let structureTree = null;
  if (traits.hasStructTree) {
    try {
      structureTree = buildSerializableTree(pdfDoc, roleMap);
    } catch { structureTree = null; }
  }

  report('complete', 100);

  return {
    findings,
    structureTree,
    meta: {
      fileName: fileName || traits.title || 'Unknown',
      fileSize: buffer.byteLength,
      pageCount: pdfDoc.getPageCount(),
      title: traits.title,
      author: pdfDoc.getAuthor() || null,
      subject: pdfDoc.getSubject() || null,
      keywords: pdfDoc.getKeywords() || null,
      creator: pdfDoc.getCreator() || null,
      producer: pdfDoc.getProducer() || null,
      lang: traits.lang,
      isPdfA: traits.isPdfA,
      pdfALevel: traits.pdfALevel,
      isPdfUA: traits.isPdfUA,
      isTagged: traits.isTagged,
      hasSuspects: traits.hasSuspects,
      hasStructTree: traits.hasStructTree,
      displayDocTitle: traits.displayDocTitle,
    },
  };
}

/** Build a standardized load-failure result. */
function buildLoadFailure(summary, remediation, fileName, fileSize) {
  return {
    findings: [{
      id: 'load-failure',
      category: 'document',
      title: 'PDF Load Failure',
      status: 'fail',
      summary,
      details: [],
      remediation,
      wcagRef: null,
      pdfuaRef: null,
    }],
    structureTree: null,
    meta: {
      fileName: fileName || 'Unknown',
      fileSize,
      pageCount: 0,
      title: null,
      author: null,
      subject: null,
      keywords: null,
      creator: null,
      producer: null,
      lang: null,
      isPdfA: false,
      pdfALevel: null,
      isPdfUA: false,
      isTagged: false,
      hasSuspects: false,
      hasStructTree: false,
      displayDocTitle: false,
    },
  };
}
