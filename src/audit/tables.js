/**
 * Tables audit module.
 *
 * Check #9 — Tables have proper header cells (TH with /Scope).
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
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
      summary: 'No structure tree — table structure cannot be checked.',
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

    tables.push({ element: obj, typeName });
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
    return analyzeTable(table.element, idx + 1, context, roleMap);
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
    remediation: 'Mark header cells as TH elements with Scope attribute (Row or Column). In Word: use "Header Row" / "Header Column" in Table Design. In Acrobat: Reading Order panel > Table Editor.',
    wcagRef: '1.3.1',
    pdfuaRef: '7.5',
  }];
}

/**
 * Analyze a single table's structure for TH cells.
 */
function analyzeTable(tableDict, tableNum, context, roleMap) {
  let thCount = 0;
  let tdCount = 0;
  let thWithScope = 0;
  const issues = [];

  // Walk the table's subtree looking for TH and TD
  walkChildren(tableDict, context, roleMap, (typeName, resolvedType, element) => {
    if (resolvedType === 'TH') {
      thCount++;
      // Check for /A or /Scope attribute
      const attrs = element.get(PDFName.of('A'));
      if (attrs) {
        const resolvedAttrs = resolve(attrs, context);
        if (hasScope(resolvedAttrs, context)) {
          thWithScope++;
        }
      }
    } else if (resolvedType === 'TD') {
      tdCount++;
    }
  });

  const details = [];
  details.push({
    label: `Table ${tableNum}`,
    value: `${thCount} TH, ${tdCount} TD cells`,
  });

  if (thCount === 0 && tdCount > 0) {
    issues.push(`Table ${tableNum}: no header cells (TH) found`);
    details.push({
      label: `Table ${tableNum} issue`,
      value: 'No TH elements — table has no marked headers',
    });
  } else if (thCount > 0 && thWithScope < thCount) {
    issues.push(`Table ${tableNum}: ${thCount - thWithScope} TH cells missing Scope`);
    details.push({
      label: `Table ${tableNum} issue`,
      value: `${thCount - thWithScope} of ${thCount} TH cells missing /Scope attribute`,
    });
  }

  return { issues, details };
}

/**
 * Recursively walk children of a StructElem.
 */
function walkChildren(dict, context, roleMap, callback, depth = 0) {
  if (depth > 50) return; // Safety cap for subtree walk

  const k = dict.get(PDFName.of('K'));
  if (!k) return;

  const kResolved = resolve(k, context);

  const processChild = (child) => {
    const resolved = resolve(child, context);
    if (!(resolved instanceof PDFDict)) return;

    const s = resolved.get(PDFName.of('S'));
    if (s) {
      const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
      const resolvedType = resolveRole(typeName, roleMap);
      callback(typeName, resolvedType, resolved);
    }

    walkChildren(resolved, context, roleMap, callback, depth + 1);
  };

  if (kResolved instanceof PDFArray) {
    for (let i = 0; i < kResolved.size(); i++) {
      processChild(kResolved.get(i));
    }
  } else if (kResolved instanceof PDFDict) {
    processChild(kResolved);
  }
}

/**
 * Check if an attributes object/array contains a Scope entry.
 */
function hasScope(attrs, context) {
  if (!attrs) return false;

  if (attrs instanceof PDFDict) {
    return !!attrs.get(PDFName.of('Scope'));
  }

  if (attrs instanceof PDFArray) {
    for (let i = 0; i < attrs.size(); i++) {
      const item = resolve(attrs.get(i), context);
      if (item instanceof PDFDict && item.get(PDFName.of('Scope'))) {
        return true;
      }
    }
  }

  return false;
}
