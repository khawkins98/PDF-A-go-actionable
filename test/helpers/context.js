/**
 * Test context builder.
 *
 * Mirrors the shared context built by runner.js, but for use in tests.
 * Takes PDF bytes, loads them, and returns the same shape context
 * that audit modules expect.
 */
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { detectAccessibilityTraits } from '../../src/engine/utils/accessibility-detect.js';
import { getRoleMapFromDoc } from '../../src/engine/utils/role-map.js';
import { resolve } from '../../src/engine/utils/resolve.js';

/**
 * Build a shared context from PDF bytes (matching runner.js logic).
 *
 * @param {Uint8Array} pdfBytes - Saved PDF bytes from a fixture factory
 * @returns {Promise<{
 *   pdfDoc: import('pdf-lib').PDFDocument,
 *   context: import('pdf-lib').PDFContext,
 *   traits: object,
 *   roleMap: Map<string, string>,
 *   structTreeRoot: PDFDict | null,
 * }>}
 */
export async function buildTestContext(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const traits = detectAccessibilityTraits(pdfDoc);
  const roleMap = getRoleMapFromDoc(pdfDoc);
  const context = pdfDoc.context;

  const structTreeRootRef = pdfDoc.catalog.get(PDFName.of('StructTreeRoot'));
  let structTreeRoot = null;
  if (structTreeRootRef) {
    const resolved = resolve(structTreeRootRef, context);
    if (resolved instanceof PDFDict) structTreeRoot = resolved;
  }

  return { pdfDoc, context, traits, roleMap, structTreeRoot };
}
