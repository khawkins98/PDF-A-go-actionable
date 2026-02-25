/**
 * Lists audit module.
 *
 * Check #10 — Lists are properly tagged (L > LI > Lbl + LBody).
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkLists(pdfDoc, ctx) {
  const { traits, roleMap, context } = ctx;

  if (!traits.hasStructTree) {
    return [{
      id: 'list-structure',
      category: 'lists',
      title: 'List Structure',
      status: 'not-applicable',
      summary: 'No structure tree — list structure cannot be checked.',
      details: [],
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.6',
    }];
  }

  // Flat scan for L (list) StructElems
  const lists = [];
  context.enumerateIndirectObjects().forEach(([, obj]) => {
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of('Type'));
    if (type && type.toString() !== '/StructElem') return;

    const s = obj.get(PDFName.of('S'));
    if (!s) return;

    const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
    const resolved = resolveRole(typeName, roleMap);

    if (resolved !== 'L') return;
    lists.push({ element: obj, typeName });
  });

  if (lists.length === 0) {
    return [{
      id: 'list-structure',
      category: 'lists',
      title: 'List Structure',
      status: 'not-applicable',
      summary: 'No lists found in the structure tree.',
      details: [],
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.6',
    }];
  }

  // Validate each list
  const issues = [];
  const details = [];

  lists.forEach((list, idx) => {
    const result = validateList(list.element, idx + 1, context, roleMap);
    details.push(...result.details);
    issues.push(...result.issues);
  });

  if (issues.length === 0) {
    return [{
      id: 'list-structure',
      category: 'lists',
      title: 'List Structure',
      status: 'pass',
      summary: `All ${lists.length} list(s) have proper L > LI > Lbl + LBody structure.`,
      details,
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.6',
    }];
  }

  return [{
    id: 'list-structure',
    category: 'lists',
    title: 'List Structure',
    status: 'fail',
    summary: `${issues.length} issue(s) found in list structure.`,
    details,
    remediation: 'Use proper list formatting in your authoring tool. In Word: use bullet/numbered list styles. Avoid manually typing bullets or numbers. In Acrobat: use the Tags panel to fix list structure (L > LI > Lbl + LBody).',
    wcagRef: '1.3.1',
    pdfuaRef: '7.6',
  }];
}

/**
 * Validate a single list's structure: L > LI > Lbl + LBody.
 */
function validateList(listDict, listNum, context, roleMap) {
  const issues = [];
  const details = [];

  const children = getChildren(listDict, context);
  let liCount = 0;

  for (const child of children) {
    const s = child.get(PDFName.of('S'));
    if (!s) continue;

    const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
    const resolvedType = resolveRole(typeName, roleMap);

    if (resolvedType === 'LI') {
      liCount++;
      // Check LI children for Lbl and LBody
      const liChildren = getChildren(child, context);
      const childTypes = liChildren.map(c => {
        const cs = c.get(PDFName.of('S'));
        if (!cs) return null;
        const cTypeName = cs instanceof PDFName ? cs.decodeText() : cs.toString().replace(/^\//, '');
        return resolveRole(cTypeName, roleMap);
      }).filter(Boolean);

      const hasLBody = childTypes.includes('LBody');
      const hasLbl = childTypes.includes('Lbl');

      if (!hasLBody) {
        issues.push(`List ${listNum}, LI ${liCount}: missing LBody`);
        details.push({
          label: `List ${listNum}, LI ${liCount}`,
          value: `Missing LBody — has: ${childTypes.join(', ') || 'no typed children'}`,
        });
      }
      if (!hasLbl) {
        issues.push(`List ${listNum}, LI ${liCount}: missing Lbl`);
        details.push({
          label: `List ${listNum}, LI ${liCount}`,
          value: `Missing Lbl — has: ${childTypes.join(', ') || 'no typed children'}`,
        });
      }
    } else if (resolvedType !== 'Caption') {
      // Non-LI children of L (other than Caption) are structural issues
      issues.push(`List ${listNum}: unexpected child type "${resolvedType}"`);
      details.push({
        label: `List ${listNum}`,
        value: `Unexpected child type "${typeName}" (-> ${resolvedType}) — expected LI`,
      });
    }
  }

  if (liCount === 0) {
    issues.push(`List ${listNum}: no LI children found`);
    details.push({
      label: `List ${listNum}`,
      value: 'No LI (list item) children found',
    });
  } else if (issues.length === 0) {
    details.push({
      label: `List ${listNum}`,
      value: `${liCount} list item(s) — structure OK`,
    });
  }

  return { issues, details };
}

/**
 * Get direct children of a StructElem as resolved PDFDicts.
 */
function getChildren(dict, context) {
  const k = dict.get(PDFName.of('K'));
  if (!k) return [];

  const kResolved = resolve(k, context);
  const children = [];

  if (kResolved instanceof PDFArray) {
    for (let i = 0; i < kResolved.size(); i++) {
      const child = resolve(kResolved.get(i), context);
      if (child instanceof PDFDict) children.push(child);
    }
  } else if (kResolved instanceof PDFDict) {
    children.push(kResolved);
  }

  return children;
}
