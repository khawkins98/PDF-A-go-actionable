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
import { buildSerializableTree } from '../engine/utils/serialize-tree.js';

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
      return {
        findings: [{
          id: 'load-failure',
          category: 'document',
          title: 'PDF Load Failure',
          status: 'fail',
          summary: `Unable to parse PDF: ${firstError.message}`,
          details: [],
          remediation: 'The file may be corrupted or use unsupported encryption. Try re-exporting from the source application.',
          wcagRef: null,
          pdfuaRef: null,
        }],
        structureTree: null,
        meta: {
          fileName: fileName || 'Unknown',
          fileSize: buffer.byteLength,
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

  const sharedContext = {
    pdfDoc,
    context,
    traits,
    roleMap,
    structTreeRoot,
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
