/**
 * PDFRef resolution helper.
 *
 * Per CLAUDE.md: Always resolve through PDFRef before accessing properties.
 */
import { PDFRef } from 'pdf-lib';

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
