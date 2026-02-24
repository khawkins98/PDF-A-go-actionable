/**
 * RoleMap resolution for PDF structure elements.
 *
 * Per CLAUDE.md: Every structure-based check must resolve custom element
 * types through /RoleMap before matching. Real-world PDFs rarely use
 * standard tag names directly.
 *
 * Examples:
 * - PptxGenJS uses /Slide (maps to /Sect)
 * - Word exports use /TOC, /TOCI, /Footnote, custom heading names
 * - InDesign uses /Story, /Lbl, tool-specific names
 */
import { PDFName, PDFDict, PDFRef } from 'pdf-lib';
import { resolve } from './resolve.js';

/**
 * Standard PDF structure element types (PDF 1.7, Table 333-338).
 * Used to detect when RoleMap resolution has reached a standard type.
 */
export const STANDARD_TYPES = new Set([
  // Grouping elements
  'Document', 'Part', 'Art', 'Sect', 'Div', 'BlockQuote',
  'Caption', 'TOC', 'TOCI', 'Index', 'NonStruct', 'Private',
  // Block-level structure elements
  'P', 'H', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  // List elements
  'L', 'LI', 'Lbl', 'LBody',
  // Table elements
  'Table', 'TR', 'TH', 'TD', 'THead', 'TBody', 'TFoot',
  // Inline-level structure elements
  'Span', 'Quote', 'Note', 'Reference', 'BibEntry', 'Code',
  // Illustration elements
  'Figure', 'Formula', 'Form',
  // Link and annotation
  'Link', 'Annot',
  // Ruby and Warichu
  'Ruby', 'RB', 'RT', 'RP', 'Warichu', 'WT', 'WP',
]);

/**
 * Build a role map from a StructTreeRoot's /RoleMap dictionary.
 *
 * @param {PDFDict|null} roleMapDict - The /RoleMap dictionary from StructTreeRoot
 * @returns {Map<string, string>} Map from custom type name to mapped type name
 *   (both without leading slash)
 */
export function buildRoleMap(roleMapDict) {
  const map = new Map();
  if (!roleMapDict || !(roleMapDict instanceof PDFDict)) return map;

  const entries = roleMapDict.entries();
  for (const [key, value] of entries) {
    const customName = key instanceof PDFName
      ? key.decodeText()
      : String(key).replace(/^\//, '');
    if (value instanceof PDFName) {
      const standardName = value.decodeText();
      map.set(customName, standardName);
    }
  }

  return map;
}

/**
 * Resolve a structure element type through the RoleMap to its standard type.
 *
 * Handles chaining (custom -> custom -> standard) with cycle detection.
 *
 * @param {string} structType - The structure element type name (without leading slash)
 * @param {Map<string, string>} roleMap - The role map from buildRoleMap()
 * @returns {string} The resolved standard type name (or the original if no mapping)
 */
export function resolveRole(structType, roleMap) {
  if (!roleMap || roleMap.size === 0) return structType;

  const visited = new Set();
  let current = structType;

  while (roleMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = roleMap.get(current);

    // Stop if we've reached a standard type
    if (STANDARD_TYPES.has(current)) return current;
  }

  return current;
}

/**
 * Get the RoleMap from a PDFDocument's StructTreeRoot.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @returns {Map<string, string>} The role map (empty if none found)
 */
export function getRoleMapFromDoc(pdfDoc) {
  const catalog = pdfDoc.catalog;
  const context = pdfDoc.context;

  const structTreeRootRef = catalog.get(PDFName.of('StructTreeRoot'));
  if (!structTreeRootRef) return new Map();

  const structTreeRoot = resolve(structTreeRootRef, context);
  if (!(structTreeRoot instanceof PDFDict)) return new Map();

  const roleMapRef = structTreeRoot.get(PDFName.of('RoleMap'));
  if (!roleMapRef) return new Map();

  const roleMapDict = resolve(roleMapRef, context);
  return buildRoleMap(roleMapDict);
}
