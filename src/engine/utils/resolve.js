/**
 * PDFRef resolution helper.
 *
 * Per CLAUDE.md: Always resolve through PDFRef before accessing properties.
 */
import { PDFRef, PDFName } from 'pdf-lib';

/**
 * Resolve a value through PDFRef to the underlying object.
 * If the value is not a PDFRef, returns it as-is.
 *
 * @param {*} val - The value to resolve (may be a PDFRef or direct object)
 * @param {import('pdf-lib').PDFContext} context - PDF context for lookups
 * @returns {*} The resolved object, or undefined if the ref doesn't exist
 */
export function resolve(val, context) {
  return val instanceof PDFRef ? context.lookup(val) : val;
}

/**
 * Resolve a StructElem's /Pg ref to a 0-based page index.
 *
 * @param {import('pdf-lib').PDFDict} structElem - StructElem dict
 * @param {Map<string, number>} pageRefMap - From buildPageRefMap()
 * @returns {number|null} 0-based page index, or null if unknown
 */
export function resolvePageIndex(structElem, pageRefMap) {
  const pg = structElem.get(PDFName.of('Pg'));
  if (!pg) return null;
  if (pg instanceof PDFRef) {
    const idx = pageRefMap.get(pg.toString());
    return idx != null ? idx : null;
  }
  return null;
}

/**
 * Format a "Page N: " prefix from a 0-based page index.
 * Returns empty string when pageIndex is null/undefined.
 *
 * @param {number|null|undefined} pageIndex - 0-based page index
 * @returns {string} "Page N: " or ""
 */
export function formatPagePrefix(pageIndex) {
  return pageIndex != null ? `Page ${pageIndex + 1}: ` : '';
}
