/**
 * Tables audit module.
 *
 * Check #9 — Tables have proper header cells (TH with /Scope).
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve, resolvePageIndex, formatPagePrefix } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkTables(pdfDoc, ctx) {
  const { traits, roleMap, context } = ctx;

  if (!traits.hasStructTree) {
    return [{
      id: 'table-headers',
      category: 'tables',
      title: 'Table Headers',
      status: 'not-applicable',
      summary: 'No structure tree, so table structure cannot be checked.',
      details: [],
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.5',
    }];
  }

  // Flat scan for Table StructElems
  const tables = [];
  context.enumerateIndirectObjects().forEach(([ref, obj]) => {
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of('Type'));
    if (type && type.toString() !== '/StructElem') return;

    const s = obj.get(PDFName.of('S'));
    if (!s) return;

    const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
    const resolved = resolveRole(typeName, roleMap);

    if (resolved !== 'Table') return;

    const pageIdx = resolvePageIndex(obj, ctx.pageRefMap);
    tables.push({ element: obj, typeName, pageIndex: pageIdx });
  });

  if (tables.length === 0) {
    return [{
      id: 'table-headers',
      category: 'tables',
      title: 'Table Headers',
      status: 'not-applicable',
      summary: 'No tables found in the structure tree.',
      details: [],
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.5',
    }];
  }

  // Check each table for TH children with /Scope
  const tableResults = tables.map((table, idx) => {
    return analyzeTable(table.element, idx + 1, context, roleMap, table.pageIndex);
  });

  const tablesWithIssues = tableResults.filter(t => t.issues.length > 0);
  const allDetails = tableResults.flatMap(t => t.details);

  if (tablesWithIssues.length === 0) {
    return [{
      id: 'table-headers',
      category: 'tables',
      title: 'Table Headers',
      status: 'pass',
      summary: `All ${tables.length} table(s) have properly marked header cells.`,
      details: allDetails,
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.5',
    }];
  }

  return [{
    id: 'table-headers',
    category: 'tables',
    title: 'Table Headers',
    status: 'fail',
    summary: `${tablesWithIssues.length} of ${tables.length} table(s) have header issues.`,
    details: allDetails,
    remediation: 'Mark header cells as TH elements with Scope attribute (Row or Column). In Word: use "Header Row" / "Header Column" in Table Design. In InDesign: Table > Table Options > Headers and Footers to define header rows, then map header cells to TH in export tagging. In Acrobat: Reading Order panel > Table Editor.',
    wcagRef: '1.3.1',
    pdfuaRef: '7.5',
  }];
}

/**
 * Analyze a single table's structure for TH cells.
 */
function analyzeTable(tableDict, tableNum, context, roleMap, pageIndex) {
  const pagePrefix = formatPagePrefix(pageIndex);
  let thCount = 0;
  let tdCount = 0;
  let thWithScope = 0;
  const issues = [];

  let missingTR = 0;

  // Walk the table's subtree looking for TH and TD
  walkChildren(tableDict, context, roleMap, (typeName, resolvedType, element, parentResolvedType) => {
    if (resolvedType === 'TH') {
      thCount++;
      // Check for /A or /Scope attribute
      const attrs = element.get(PDFName.of('A'));
      if (attrs) {
        const resolvedAttrs = resolve(attrs, context);
        if (hasValidScope(resolvedAttrs, context)) {
          thWithScope++;
        }
      }
      // Check if parent is TR
      if (parentResolvedType !== 'TR') missingTR++;
    } else if (resolvedType === 'TD') {
      tdCount++;
      // Check if parent is TR
      if (parentResolvedType !== 'TR') missingTR++;
    }
  });

  const details = [];
  details.push({
    label: `Table ${tableNum}`,
    value: `${pagePrefix}${thCount} TH, ${tdCount} TD cells`,
  });

  if (thCount === 0 && tdCount > 0) {
    issues.push(`Table ${tableNum}: no header cells (TH) found`);
    details.push({
      label: `Table ${tableNum} issue`,
      value: 'No TH elements. Table has no marked headers',
    });
  } else if (thCount > 0 && thWithScope < thCount) {
    issues.push(`Table ${tableNum}: ${thCount - thWithScope} TH cells missing Scope`);
    details.push({
      label: `Table ${tableNum} issue`,
      value: `${thCount - thWithScope} of ${thCount} TH cells missing /Scope attribute`,
    });
  }

  if (missingTR > 0) {
    issues.push(`Table ${tableNum}: ${missingTR} cell(s) not wrapped in TR`);
    details.push({
      label: `Table ${tableNum} issue`,
      value: `${pagePrefix}${missingTR} TH/TD not wrapped in TR`,
    });
  }

  return { issues, details };
}

/**
 * Recursively walk children of a StructElem.
 * Callback receives (typeName, resolvedType, element, parentResolvedType).
 */
function walkChildren(dict, context, roleMap, callback, depth = 0, parentResolvedType = null) {
  if (depth > 50) return; // Safety cap for subtree walk

  const k = dict.get(PDFName.of('K'));
  if (!k) return;

  const kResolved = resolve(k, context);

  // Determine current element's resolved type for passing to children
  const currentS = dict.get(PDFName.of('S'));
  let currentResolvedType = parentResolvedType;
  if (currentS) {
    const currentTypeName = currentS instanceof PDFName ? currentS.decodeText() : currentS.toString().replace(/^\//, '');
    currentResolvedType = resolveRole(currentTypeName, roleMap);
  }

  const processChild = (child) => {
    const resolved = resolve(child, context);
    if (!(resolved instanceof PDFDict)) return;

    const s = resolved.get(PDFName.of('S'));
    if (s) {
      const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
      const resolvedType = resolveRole(typeName, roleMap);
      callback(typeName, resolvedType, resolved, currentResolvedType);
    }

    walkChildren(resolved, context, roleMap, callback, depth + 1, currentResolvedType);
  };

  if (kResolved instanceof PDFArray) {
    for (let i = 0; i < kResolved.size(); i++) {
      processChild(kResolved.get(i));
    }
  } else if (kResolved instanceof PDFDict) {
    processChild(kResolved);
  }
}

/** Valid Scope values per PDF specification. */
const VALID_SCOPES = new Set(['Row', 'Column', 'Both']);

/**
 * Check if an attributes object/array contains a valid Scope entry.
 * Validates that the Scope value is one of Row, Column, or Both.
 */
function hasValidScope(attrs, context) {
  if (!attrs) return false;

  if (attrs instanceof PDFDict) {
    const scope = attrs.get(PDFName.of('Scope'));
    if (!scope) return false;
    const scopeStr = scope instanceof PDFName ? scope.decodeText() : scope.toString().replace(/^\//, '');
    return VALID_SCOPES.has(scopeStr);
  }

  if (attrs instanceof PDFArray) {
    for (let i = 0; i < attrs.size(); i++) {
      const item = resolve(attrs.get(i), context);
      if (item instanceof PDFDict) {
        const scope = item.get(PDFName.of('Scope'));
        if (!scope) continue;
        const scopeStr = scope instanceof PDFName ? scope.decodeText() : scope.toString().replace(/^\//, '');
        if (VALID_SCOPES.has(scopeStr)) return true;
      }
    }
  }

  return false;
}
