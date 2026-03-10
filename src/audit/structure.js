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
import { resolvePageIndex, formatPagePrefix } from '../engine/utils/resolve.js';
import { getRemediation } from '../guidance.js';

const HEADING_TYPES = new Set(['H', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkStructure(pdfDoc, ctx) {
  const { traits, roleMap } = ctx;
  const findings = [];

  // #4 — Tagged PDF
  const taggedStatus = !traits.isTagged ? 'fail' : traits.hasSuspects ? 'fail' : 'pass';
  const taggedDetails = [{ label: 'MarkInfo status', value: traits.markedStatus }];
  if (traits.hasSuspects) {
    taggedDetails.push({ label: 'Suspects', value: 'true' });
  }

  let taggedSummary;
  let taggedRemediation = null;
  if (!traits.isTagged) {
    taggedSummary = traits.markedStatus === 'false'
      ? 'Document has MarkInfo but Marked is false. The PDF may have been partially tagged.'
      : 'Document is not tagged. Screen readers can\'t determine the document structure.';
    taggedRemediation = getRemediation('tagged-pdf', 'fail');
  } else if (traits.hasSuspects) {
    taggedSummary = 'Document is tagged but MarkInfo/Suspects is true. The tag structure may be unreliable and should be reviewed.';
    taggedRemediation = getRemediation('tagged-pdf', 'fail-suspects');
  } else {
    taggedSummary = 'Document is tagged (MarkInfo/Marked is true).';
  }

  findings.push({
    id: 'tagged-pdf',
    category: 'structure',
    title: 'Tagged PDF',
    status: taggedStatus,
    summary: taggedSummary,
    details: taggedDetails,
    remediation: taggedRemediation,
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
      : getRemediation('structure-tree'),
    wcagRef: '1.3.1',
    pdfuaRef: '7.1',
  });

  // #8 — Heading hierarchy (needs document order, so use tree walk)
  if (traits.hasStructTree) {
    const headingResult = checkHeadingHierarchy(ctx);
    findings.push(headingResult);
  } else {
    findings.push({
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'not-applicable',
      summary: 'No structure tree, so heading hierarchy cannot be checked.',
      details: [],
      remediation: null,
      wcagRef: '2.4.6',
      pdfuaRef: '7.4.2',
    });
  }

  // Informational — Structure tree summary
  if (traits.hasStructTree) {
    const summary = buildStructTreeSummary(ctx);
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
function checkHeadingHierarchy(ctx) {
  const elements = ctx.getStructureElements();
  const headings = elements
    .filter(el => HEADING_TYPES.has(el.resolvedType))
    .map(el => {
      const pageIdx = resolvePageIndex(el.element, ctx.pageRefMap);
      return {
        type: el.type,
        resolvedType: el.resolvedType,
        level: el.resolvedType === 'H' ? 0 : parseInt(el.resolvedType.substring(1), 10),
        pageIndex: pageIdx,
      };
    });

  if (headings.length === 0) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'warning',
      summary: 'No headings found in the structure tree. Use headings to organize content.',
      details: [],
      remediation: getRemediation('heading-hierarchy', 'warning-no-headings'),
      wcagRef: '2.4.6',
      pdfuaRef: '7.4.2',
    };
  }

  // Check for skips (skip generic H elements for gap detection)
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    // Skip gap detection when either heading is generic H (level 0)
    if (prev.level === 0 || curr.level === 0) continue;
    if (curr.level > prev.level + 1) {
      skips.push({
        label: `Skip at heading ${i + 1}`,
        value: `${prev.resolvedType} -> ${curr.resolvedType} (missing H${prev.level + 1})`,
      });
    }
  }

  // Check if first numbered heading is H1 (ignore generic H)
  const firstNumbered = headings.find(h => h.level > 0);
  const startsWithH1 = !firstNumbered || firstNumbered.level === 1;

  if (skips.length === 0 && startsWithH1) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      title: 'Heading Hierarchy',
      status: 'pass',
      summary: `${headings.length} heading${headings.length !== 1 ? 's' : ''} in correct hierarchy (no skips).`,
      details: headings.map((h, i) => {
        const pagePrefix = formatPagePrefix(h.pageIndex);
        return {
          label: `Heading ${i + 1}`,
          value: h.type === h.resolvedType ? `${pagePrefix}${h.resolvedType}` : `${pagePrefix}${h.type} (-> ${h.resolvedType})`,
        };
      }),
      remediation: null,
      wcagRef: '2.4.6',
      pdfuaRef: '7.4.2',
    };
  }

  const issues = [...skips];
  if (!startsWithH1 && firstNumbered) {
    issues.unshift({
      label: 'First heading',
      value: `Document starts with ${firstNumbered.resolvedType} instead of H1`,
    });
  }

  // Heading issues are warnings — headings still exist and provide structure,
  // even if the hierarchy isn't perfect. Screen reader users can still navigate.
  const status = 'warning';

  return {
    id: 'heading-hierarchy',
    category: 'structure',
    title: 'Heading Hierarchy',
    status,
    summary: `Heading hierarchy has ${issues.length} issue(s): ${issues.map(i => i.value).join('; ')}.`,
    details: issues,
    remediation: getRemediation('heading-hierarchy', 'warning'),
    wcagRef: '2.4.6',
    pdfuaRef: '7.4.2',
  };
}

/**
 * Build a summary of the structure tree.
 */
function buildStructTreeSummary(ctx) {
  const elements = ctx.getStructureElements();
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
