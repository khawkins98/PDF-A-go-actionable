/**
 * Links audit module.
 *
 * Informational: Link text quality analysis.
 * Flags generic text ("click here", "here", "read more", etc.) and bare URLs.
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve, resolvePageIndex, formatPagePrefix } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';

/** Generic link text patterns (case-insensitive match). */
const GENERIC_LINK_TEXT = [
  'click here',
  'here',
  'read more',
  'learn more',
  'link',
  'this link',
  'more info',
  'download',
  'more',
];

/** Bare URL pattern (http, https, ftp). */
const URL_PATTERN = /^(?:https?|ftp):\/\//i;

/**
 * Extract accessible text from a Link StructElem.
 * Prefers ActualText/Alt on the Link itself, then collects from children.
 */
function extractLinkText(obj, context) {
  // Prefer direct ActualText/Alt on the Link element
  const directText = obj.get(PDFName.of('ActualText')) || obj.get(PDFName.of('Alt'));
  if (directText) return directText.decodeText();

  // Recursively collect text from child StructElems
  return collectChildText(obj, context);
}

/**
 * Recursively collect ActualText/Alt from child StructElems.
 * Depth-capped to prevent stack overflow on malformed PDFs.
 */
function collectChildText(elem, context, depth = 0) {
  if (depth > 10) return null;

  const k = elem.get(PDFName.of('K'));
  if (!k) return null;

  const kResolved = resolve(k, context);
  const parts = [];

  if (kResolved instanceof PDFArray) {
    for (let i = 0; i < kResolved.size(); i++) {
      const child = resolve(kResolved.get(i), context);
      if (child instanceof PDFDict) {
        const text = getTextFromElem(child, context, depth + 1);
        if (text) parts.push(text);
      }
    }
  } else if (kResolved instanceof PDFDict) {
    const text = getTextFromElem(kResolved, context, depth + 1);
    if (text) parts.push(text);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Get text from a single StructElem: ActualText, Alt, or recurse into children.
 */
function getTextFromElem(elem, context, depth = 0) {
  const actualText = elem.get(PDFName.of('ActualText'));
  if (actualText) return actualText.decodeText();

  const alt = elem.get(PDFName.of('Alt'));
  if (alt) return alt.decodeText();

  // Recurse into children
  return collectChildText(elem, context, depth);
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkLinks(pdfDoc, ctx) {
  const { traits, roleMap, context } = ctx;

  if (!traits.hasStructTree) {
    return [{
      id: 'link-text',
      category: 'links',
      title: 'Link Text Quality',
      status: 'not-applicable',
      summary: 'No structure tree, so link text cannot be checked.',
      details: [],
      remediation: null,
      wcagRef: '2.4.4',
      pdfuaRef: null,
    }];
  }

  // Flat scan for Link StructElems
  const links = [];
  context.enumerateIndirectObjects().forEach(([, obj]) => {
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of('Type'));
    if (type && type.toString() !== '/StructElem') return;

    const s = obj.get(PDFName.of('S'));
    if (!s) return;

    const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
    const resolved = resolveRole(typeName, roleMap);

    if (resolved !== 'Link') return;

    // Get text: prefer ActualText/Alt on the Link itself, then collect from children
    const text = extractLinkText(obj, context);

    const pageIdx = resolvePageIndex(obj, ctx.pageRefMap);
    links.push({ typeName, text, pageIndex: pageIdx });
  });

  if (links.length === 0) {
    return [{
      id: 'link-text',
      category: 'links',
      title: 'Link Text Quality',
      status: 'not-applicable',
      summary: 'No links found in the structure tree.',
      details: [],
      remediation: null,
      wcagRef: '2.4.4',
      pdfuaRef: null,
    }];
  }

  // Analyze link text quality
  const genericLinks = [];
  const urlLinks = [];
  const missingTextLinks = [];
  const details = [];

  links.forEach((link, idx) => {
    const pagePrefix = formatPagePrefix(link.pageIndex);
    if (!link.text || link.text.trim().length === 0) {
      missingTextLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: `${pagePrefix}No ActualText or Alt text. Link purpose unknown to assistive technology`,
      });
      return;
    }

    const textLower = link.text.trim().toLowerCase();

    if (GENERIC_LINK_TEXT.includes(textLower)) {
      genericLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: `${pagePrefix}Generic text: "${link.text}"`,
      });
    } else if (URL_PATTERN.test(link.text.trim())) {
      urlLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: `${pagePrefix}Bare URL: "${link.text}"`,
      });
    }
  });

  const issueCount = genericLinks.length + urlLinks.length + missingTextLinks.length;

  if (issueCount === 0) {
    return [{
      id: 'link-text',
      category: 'links',
      title: 'Link Text Quality',
      status: 'pass',
      summary: `${links.length} link(s) checked, no generic or bare-URL text detected.`,
      details: [],
      remediation: null,
      wcagRef: '2.4.4',
      pdfuaRef: null,
    }];
  }

  const parts = [];
  if (missingTextLinks.length > 0) parts.push(`${missingTextLinks.length} missing text`);
  if (genericLinks.length > 0) parts.push(`${genericLinks.length} generic`);
  if (urlLinks.length > 0) parts.push(`${urlLinks.length} bare URLs`);

  return [{
    id: 'link-text',
    category: 'links',
    title: 'Link Text Quality',
    status: missingTextLinks.length > 0 ? 'fail' : 'warning',
    summary: `${issueCount} of ${links.length} link(s) have issues (${parts.join(', ')}).`,
    details,
    remediation: 'Use descriptive link text that makes sense out of context. Replace "click here" with a description of the destination (e.g., "download the annual report"). If a bare URL must be visible in the design, set the Link tag\'s ActualText to a descriptive phrase so screen readers announce "UNDRR strategic framework" instead of reading out the full URL. In InDesign: use the Hyperlinks panel (Window > Interactive > Hyperlinks) and set descriptive text as the link source. In Acrobat: use the Create Link command to ensure links are properly tagged. See helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html for details.',
    wcagRef: '2.4.4',
    pdfuaRef: null,
  }];
}
