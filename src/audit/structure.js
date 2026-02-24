/**
 * Structure audit module.
 *
 * Checks:
 * #4 — PDF is tagged (MarkInfo/Marked)
 * #5 — Structure tree present (StructTreeRoot)
 * #8 — Heading hierarchy (H1-H6 in document order, no skips)
 *
 * Informational:
 * - Structure tree summary (element count, types, max depth)
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';
import { walkStructureTree } from '../engine/utils/struct-tree-walker.js';

const HEADING_TYPES = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkStructure(pdfDoc, ctx) {
  const { traits, roleMap } = ctx;
  const findings = [];

  // #4 — Tagged PDF
  findings.push({
    id: 'tagged-pdf',
    category: 'structure',
    title: 'Tagged PDF',
    status: traits.isTagged ? 'pass' : 'fail',
    summary: traits.isTagged
      ? 'Document is tagged (MarkInfo/Marked is true).'
      : traits.markedStatus === 'false'
        ? 'Document has MarkInfo but Marked is false. The PDF may have been partially tagged.'
        : 'Document is not tagged. Screen readers and assistive technology cannot determine the document structure.',
    details: [{ label: 'MarkInfo status', value: traits.markedStatus }],
    remediation: traits.isTagged
      ? null
      : 'Tag the document in your authoring tool. In Word/PowerPoint: use heading styles and accessibility-aware export. In InDesign: enable "Create Tagged PDF" on export. In Acrobat: Accessibility > Add Tags to Document.',
    wcagRef: '1.3.1',
    pdfuaRef: '7.1',
  });

  // #5 — Structure tree present
  findings.push({
    id: 'structure-tree',
    category: 'structure',
    title: 'Structure Tree',
    status: traits.hasStructTree ? 'pass' : 'fail',
    summary: traits.hasStructTree
      ? 'Document has a structure tree (StructTreeRoot).'
      : 'No structure tree found. The document may not be tagged or the tags were stripped.',
    details: [],
    remediation: traits.hasStructTree
      ? null
      : 'Ensure the document is properly tagged. The structure tree is created automatically when using heading styles and accessibility-aware export settings.',
    wcagRef: '1.3.1',
    pdfuaRef: '7.1',
  });

  // #8 — Heading hierarchy (needs document order, so use tree walk)
  if (traits.hasStructTree) {
    const headingResult = checkHeadingHierarchy(pdfDoc, roleMap);
    findings.push(headingResult);
  } else {
    findings.push({
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'not-applicable',
      summary: 'No structure tree — heading hierarchy cannot be checked.',
      details: [],
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.4.2',
    });
  }

  // Informational — Structure tree summary
  if (traits.hasStructTree) {
    const summary = buildStructTreeSummary(pdfDoc, roleMap);
    findings.push({
      id: 'structure-summary',
      category: 'structure',
      title: 'Structure Tree Summary',
      status: 'pass',
      summary: `${summary.elementCount} elements, ${summary.typeCount} types, max depth ${summary.maxDepth}.`,
      details: [
        { label: 'Total elements', value: String(summary.elementCount) },
        { label: 'Element types', value: summary.types.join(', ') },
        { label: 'Max depth', value: String(summary.maxDepth) },
      ],
      remediation: null,
      wcagRef: null,
      pdfuaRef: null,
    });
  }

  return findings;
}

/**
 * Check heading hierarchy for skips (H1 -> H3 without H2).
 */
function checkHeadingHierarchy(pdfDoc, roleMap) {
  const elements = walkStructureTree(pdfDoc, roleMap);
  const headings = elements
    .filter(el => HEADING_TYPES.has(el.resolvedType))
    .map(el => ({
      type: el.type,
      resolvedType: el.resolvedType,
      level: parseInt(el.resolvedType.substring(1), 10),
    }));

  if (headings.length === 0) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'warning',
      summary: 'No headings found in the structure tree. Documents should use headings to organize content.',
      details: [],
      remediation: 'Add headings using heading styles (H1, H2, H3, etc.) in your authoring tool to create a navigable document outline.',
      wcagRef: '1.3.1',
      pdfuaRef: '7.4.2',
    };
  }

  // Check for skips
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (curr.level > prev.level + 1) {
      skips.push({
        label: `Skip at heading ${i + 1}`,
        value: `${prev.resolvedType} -> ${curr.resolvedType} (missing H${prev.level + 1})`,
      });
    }
  }

  // Check if first heading is H1
  const startsWithH1 = headings[0].level === 1;

  if (skips.length === 0 && startsWithH1) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'pass',
      summary: `${headings.length} headings in correct hierarchy (no skips).`,
      details: headings.map((h, i) => ({
        label: `Heading ${i + 1}`,
        value: h.type === h.resolvedType ? h.resolvedType : `${h.type} (-> ${h.resolvedType})`,
      })),
      remediation: null,
      wcagRef: '1.3.1',
      pdfuaRef: '7.4.2',
    };
  }

  const issues = [...skips];
  if (!startsWithH1) {
    issues.unshift({
      label: 'First heading',
      value: `Document starts with ${headings[0].resolvedType} instead of H1`,
    });
  }

  return {
    id: 'heading-hierarchy',
    category: 'structure',
    title: 'Heading Hierarchy',
    status: 'fail',
    summary: `Heading hierarchy has ${issues.length} issue(s): ${issues.map(i => i.value).join('; ')}.`,
    details: issues,
    remediation: 'Fix heading levels in your source document. Ensure headings start at H1 and increase sequentially (H1 > H2 > H3). Do not skip levels.',
    wcagRef: '1.3.1',
    pdfuaRef: '7.4.2',
  };
}

/**
 * Build a summary of the structure tree.
 */
function buildStructTreeSummary(pdfDoc, roleMap) {
  const elements = walkStructureTree(pdfDoc, roleMap);
  const typeSet = new Set();
  let maxDepth = 0;

  for (const el of elements) {
    typeSet.add(el.resolvedType);
    if (el.depth > maxDepth) maxDepth = el.depth;
  }

  return {
    elementCount: elements.length,
    typeCount: typeSet.size,
    types: [...typeSet].sort(),
    maxDepth,
  };
}
