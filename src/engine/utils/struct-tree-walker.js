/**
 * Structure tree walker for tagged PDFs.
 *
 * Depth-first walk from StructTreeRoot /K with safety caps:
 * - Visited set prevents cycles
 * - Depth cap (200) prevents stack overflow
 * - Element count cap (50,000) prevents hangs on huge documents
 *
 * Per CLAUDE.md: Only use tree walk when document order matters.
 * For aggregation tasks, use flat scan (context.enumerateIndirectObjects()).
 */
import { PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import { resolve } from './resolve.js';
import { resolveRole } from './role-map.js';

const MAX_DEPTH = 200;
const MAX_ELEMENTS = 50000;

/**
 * @typedef {Object} StructElement
 * @property {string} type - Original structure type (without leading slash)
 * @property {string} resolvedType - Type after RoleMap resolution
 * @property {number} depth - Depth in the tree (root children = 1)
 * @property {PDFDict} element - The underlying PDFDict
 * @property {string|null} alt - Alt text if present
 * @property {string|null} lang - Language if present
 * @property {number|null} mcid - Marked content ID if this is a leaf with MCID
 */

/**
 * Walk the structure tree in document order, returning an array of elements.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {Map<string, string>} roleMap - From buildRoleMap()
 * @returns {StructElement[]} Ordered array of structure elements
 */
export function walkStructureTree(pdfDoc, roleMap) {
  const catalog = pdfDoc.catalog;
  const context = pdfDoc.context;

  const structTreeRootRef = catalog.get(PDFName.of('StructTreeRoot'));
  if (!structTreeRootRef) return [];

  const structTreeRoot = resolve(structTreeRootRef, context);
  if (!(structTreeRoot instanceof PDFDict)) return [];

  const elements = [];
  const visited = new Set();
  let elementCount = 0;

  function walk(node, depth) {
    if (depth > MAX_DEPTH || elementCount >= MAX_ELEMENTS) return;

    const resolved = resolve(node, context);
    if (!resolved) return;

    // Track visited refs to prevent cycles
    if (node instanceof PDFRef) {
      const tag = node.toString();
      if (visited.has(tag)) return;
      visited.add(tag);
    }

    if (!(resolved instanceof PDFDict)) return;

    const s = resolved.get(PDFName.of('S'));
    if (s) {
      elementCount++;
      const typeName = s instanceof PDFName
        ? s.decodeText()
        : s.toString().replace(/^\//, '');

      const altObj = resolved.get(PDFName.of('Alt'));
      const langObj = resolved.get(PDFName.of('Lang'));

      elements.push({
        type: typeName,
        resolvedType: resolveRole(typeName, roleMap),
        depth,
        element: resolved,
        alt: altObj ? altObj.decodeText() : null,
        lang: langObj ? langObj.decodeText() : null,
        mcid: null,
      });
    }

    // Recurse into children
    const k = resolved.get(PDFName.of('K'));
    if (!k) return;

    const kResolved = resolve(k, context);

    if (kResolved instanceof PDFArray) {
      for (let i = 0; i < kResolved.size(); i++) {
        const child = kResolved.get(i);
        if (child instanceof PDFRef || child instanceof PDFDict) {
          walk(child, depth + 1);
        }
      }
    } else if (kResolved instanceof PDFDict || kResolved instanceof PDFRef) {
      walk(kResolved, depth + 1);
    }
  }

  // Start from StructTreeRoot's /K
  const rootK = structTreeRoot.get(PDFName.of('K'));
  if (!rootK) return elements;

  const rootKResolved = resolve(rootK, context);
  if (rootKResolved instanceof PDFArray) {
    for (let i = 0; i < rootKResolved.size(); i++) {
      walk(rootKResolved.get(i), 1);
    }
  } else {
    walk(rootK, 1);
  }

  return elements;
}
