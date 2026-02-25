/**
 * Links audit module.
 *
 * Informational: Link text quality analysis.
 * Flags generic text ("click here", "here", "read more", etc.) and bare URLs.
 */
import { PDFName, PDFDict } from 'pdf-lib';
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

    // Get actual text or alt text
    const altObj = obj.get(PDFName.of('ActualText')) || obj.get(PDFName.of('Alt'));
    const text = altObj ? altObj.decodeText() : null;

    links.push({ typeName, text });
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
    if (!link.text || link.text.trim().length === 0) {
      missingTextLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: 'No ActualText or Alt text. Link purpose unknown to assistive technology',
      });
      return;
    }

    const textLower = link.text.trim().toLowerCase();

    if (GENERIC_LINK_TEXT.includes(textLower)) {
      genericLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: `Generic text: "${link.text}"`,
      });
    } else if (URL_PATTERN.test(link.text.trim())) {
      urlLinks.push(link);
      details.push({
        label: `Link ${idx + 1}`,
        value: `Bare URL: "${link.text}"`,
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
    remediation: 'Use descriptive link text that makes sense out of context. Replace "click here" with a description of the destination (e.g., "download the annual report"). Avoid using bare URLs as link text. Ensure every link has accessible text.',
    wcagRef: '2.4.4',
    pdfuaRef: null,
  }];
}
