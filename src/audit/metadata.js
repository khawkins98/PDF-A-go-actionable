/**
 * Metadata audit module.
 *
 * Checks:
 * #1 — Document title is set (not filename)
 * #2 — Document language is specified
 * #3 — Security permits accessibility
 *
 * Informational:
 * - PDF/A conformance level
 * - PDF/UA conformance
 * - DisplayDocTitle preference
 * - Bookmarks present
 * - Per-element language specifications
 */
import { PDFName, PDFDict } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
import { getRemediation } from '../guidance.js';
// Structure tree walk accessed via ctx.getStructureElements() for cached single-pass

/** BCP-47 language tag validation pattern. */
const BCP47_REGEX = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/** Check if a string is a valid BCP-47 language tag. */
function isValidBcp47(lang) {
  return BCP47_REGEX.test(lang);
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkMetadata(pdfDoc, ctx) {
  const { traits } = ctx;
  const findings = [];

  // #1 — Document title
  // Three-level check: pass (XMP dc:title), warning (Info dict only), fail (none)
  let titleStatus, titleSummary, titleRemediation;
  if (traits.titleSource === 'xmp') {
    titleStatus = 'pass';
    titleSummary = `Document title is set: "${traits.title}"`;
    titleRemediation = null;
  } else if (traits.titleSource === 'info') {
    titleStatus = 'warning';
    titleSummary = `Document title is set in the Info dictionary: "${traits.title}". For full PDF/UA compliance, the title should also be in XMP metadata (dc:title).`;
    titleRemediation = getRemediation('document-title', 'warning');
  } else {
    titleStatus = 'fail';
    titleSummary = 'No document title set. The title bar will show the filename instead.';
    titleRemediation = getRemediation('document-title', 'fail');
  }
  findings.push({
    id: 'document-title',
    category: 'metadata',
    title: 'Document Title',
    status: titleStatus,
    summary: titleSummary,
    details: traits.title ? [{ label: 'Title', value: traits.title }] : [],
    remediation: titleRemediation,
    wcagRef: '2.4.2',
    pdfuaRef: '7.1',
  });

  // #2 — Document language
  let langStatus, langSummary, langRemediation;
  if (!traits.lang) {
    langStatus = 'fail';
    langSummary = 'No document language specified. Screen readers may use the wrong pronunciation rules.';
    langRemediation = getRemediation('document-lang', 'fail');
  } else if (!isValidBcp47(traits.lang)) {
    langStatus = 'warning';
    langSummary = `Document language is set to "${traits.lang}" but this is not a valid BCP-47 tag. Use a format like "en", "en-US", or "zh-Hans-CN".`;
    langRemediation = `The language tag "${traits.lang}" is not valid BCP-47 format. Use standard codes: "en" for English, "fr" for French, "en-US" for American English, etc.`;
  } else {
    langStatus = 'pass';
    langSummary = `Document language is set: "${traits.lang}"`;
    langRemediation = null;
  }
  findings.push({
    id: 'document-lang',
    category: 'metadata',
    title: 'Document Language',
    status: langStatus,
    summary: langSummary,
    details: traits.lang ? [{ label: 'Language', value: traits.lang }] : [],
    remediation: langRemediation,
    wcagRef: '3.1.1',
    pdfuaRef: '7.2',
  });

  // #3 — Security permits accessibility
  const securityResult = checkSecurity(pdfDoc);
  findings.push({
    id: 'security-permissions',
    category: 'metadata',
    title: 'Security Permissions',
    status: securityResult.status,
    summary: securityResult.summary,
    details: securityResult.details,
    remediation: securityResult.status === 'fail'
      ? getRemediation('security-permissions')
      : null,
    wcagRef: null,
    pdfuaRef: '7.1',
  });

  // Informational — PDF/A
  if (traits.isPdfA) {
    findings.push({
      id: 'pdfa-conformance',
      category: 'metadata',
      title: 'PDF/A Conformance',
      status: 'pass',
      summary: `Document claims PDF/A-${traits.pdfALevel} conformance.`,
      details: [{ label: 'Level', value: `PDF/A-${traits.pdfALevel}` }],
      remediation: null,
      wcagRef: null,
      pdfuaRef: null,
    });
  }

  // Informational — PDF/UA
  findings.push({
    id: 'pdfua-conformance',
    category: 'metadata',
    title: 'PDF/UA Conformance',
    status: traits.isPdfUA ? 'pass' : 'warning',
    summary: traits.isPdfUA
      ? 'Document claims PDF/UA conformance.'
      : 'Document does not claim PDF/UA conformance. This is informational; the document may still be accessible.',
    details: [],
    remediation: traits.isPdfUA
      ? null
      : getRemediation('pdfua-conformance'),
    wcagRef: null,
    pdfuaRef: null,
  });

  // Informational — DisplayDocTitle
  findings.push({
    id: 'display-doc-title',
    category: 'metadata',
    title: 'Display Document Title',
    status: traits.displayDocTitle === true ? 'pass' : 'warning',
    summary: traits.displayDocTitle === true
      ? 'Viewer is configured to show the document title in the title bar.'
      : 'Viewer preference for displaying the document title is not set. The title bar may show the filename instead.',
    details: [],
    remediation: traits.displayDocTitle === true
      ? null
      : getRemediation('display-doc-title'),
    wcagRef: '2.4.2',
    pdfuaRef: null,
  });

  // Informational — Bookmarks
  const hasBookmarks = checkBookmarks(pdfDoc);
  findings.push({
    id: 'bookmarks',
    category: 'metadata',
    title: 'Bookmarks (Outlines)',
    status: hasBookmarks ? 'pass' : 'warning',
    summary: hasBookmarks
      ? 'Document has bookmarks for navigation.'
      : 'No bookmarks found. Bookmarks help users navigate longer documents.',
    details: [],
    remediation: hasBookmarks
      ? null
      : getRemediation('bookmarks'),
    wcagRef: '2.4.5',
    pdfuaRef: null,
  });

  // Informational — Per-element language
  findings.push(checkPerElementLanguage(pdfDoc, ctx));

  return findings;
}

/**
 * Check encryption permissions for accessibility.
 * Bit 5 (value 16) of the /P value in the Encrypt dict controls content extraction.
 * Bit 10 (value 512) controls content accessibility.
 */
function checkSecurity(pdfDoc) {
  const context = pdfDoc.context;
  const trailer = context.trailerInfo;

  // Check for Encrypt dict in trailer
  const encryptRef = trailer.Encrypt;
  if (!encryptRef) {
    return {
      status: 'pass',
      summary: 'No encryption. Accessibility access is unrestricted.',
      details: [],
    };
  }

  const encrypt = resolve(encryptRef, context);
  if (!(encrypt instanceof PDFDict)) {
    return {
      status: 'pass',
      summary: 'No encryption dictionary found.',
      details: [],
    };
  }

  const pVal = encrypt.get(PDFName.of('P'));
  if (!pVal) {
    return {
      status: 'warning',
      summary: 'Encryption detected but permissions value could not be read.',
      details: [],
    };
  }

  const permissions = Number(pVal.toString());

  // Bit 10 (0x200) = content accessibility extraction
  // Bit 5 (0x10) = content extraction
  const accessibilityAllowed = (permissions & 0x200) !== 0;
  const extractionAllowed = (permissions & 0x10) !== 0;

  if (accessibilityAllowed) {
    return {
      status: 'pass',
      summary: 'Document is encrypted but accessibility access is permitted.',
      details: [
        { label: 'Accessibility extraction', value: 'Allowed' },
        { label: 'Content extraction', value: extractionAllowed ? 'Allowed' : 'Restricted' },
      ],
    };
  }

  return {
    status: 'fail',
    summary: 'Document encryption blocks accessibility access. Screen readers may not be able to read this document.',
    details: [
      { label: 'Accessibility extraction', value: 'Blocked' },
      { label: 'Content extraction', value: extractionAllowed ? 'Allowed' : 'Restricted' },
    ],
  };
}

/**
 * Check for per-element /Lang attributes on structure elements.
 * Walks the structure tree and reports which elements specify a language.
 */
function checkPerElementLanguage(pdfDoc, ctx) {
  const { traits } = ctx;

  if (!traits.hasStructTree) {
    return {
      id: 'per-element-language',
      category: 'metadata',
      title: 'Per-Element Language',
      status: 'not-applicable',
      summary: 'No structure tree. Per-element language requires tagged PDF.',
      details: [],
      remediation: null,
      wcagRef: '3.1.2',
      pdfuaRef: '7.2',
    };
  }

  const elements = ctx.getStructureElements();
  const withLang = elements.filter(el => el.lang);

  if (withLang.length === 0) {
    return {
      id: 'per-element-language',
      category: 'metadata',
      title: 'Per-Element Language',
      status: 'warning',
      summary: 'No structure elements specify a language. This is fine for single-language documents, but multilingual content needs per-element language tags.',
      details: [],
      remediation: getRemediation('per-element-language'),
      wcagRef: '3.1.2',
      pdfuaRef: '7.2',
    };
  }

  // Build per-language summary and check for invalid BCP-47 tags
  const langMap = new Map();
  const invalidLangs = new Set();
  for (const el of withLang) {
    const list = langMap.get(el.lang) || [];
    list.push(el.type === el.resolvedType ? el.type : `${el.type} (${el.resolvedType})`);
    langMap.set(el.lang, list);
    if (!isValidBcp47(el.lang)) {
      invalidLangs.add(el.lang);
    }
  }

  const details = [];
  for (const [lang, types] of langMap) {
    details.push({
      label: lang,
      value: `${types.length} element${types.length === 1 ? '' : 's'} (${[...new Set(types)].join(', ')})`,
    });
  }

  if (invalidLangs.size > 0) {
    for (const lang of invalidLangs) {
      details.push({
        label: 'Invalid language tag',
        value: `"${lang}" is not valid BCP-47 format`,
      });
    }
    return {
      id: 'per-element-language',
      category: 'metadata',
      title: 'Per-Element Language',
      status: 'warning',
      summary: `${withLang.length} structure element(s) specify language, but ${invalidLangs.size} use invalid BCP-47 tags.`,
      details,
      remediation: `Fix invalid language tags: ${[...invalidLangs].map(l => `"${l}"`).join(', ')}. Use standard BCP-47 codes like "en", "fr-FR", "zh-Hans-CN".`,
      wcagRef: '3.1.2',
      pdfuaRef: '7.2',
    };
  }

  return {
    id: 'per-element-language',
    category: 'metadata',
    title: 'Per-Element Language',
    status: 'pass',
    summary: `${withLang.length} structure element${withLang.length === 1 ? '' : 's'} specify a language attribute.`,
    details,
    remediation: null,
    wcagRef: '3.1.2',
    pdfuaRef: '7.2',
  };
}

/**
 * Check if the document has bookmarks (outlines).
 */
function checkBookmarks(pdfDoc) {
  const catalog = pdfDoc.catalog;
  const outlinesRef = catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) return false;

  const outlines = resolve(outlinesRef, pdfDoc.context);
  if (!(outlines instanceof PDFDict)) return false;

  // Check that there's at least one child
  const first = outlines.get(PDFName.of('First'));
  return !!first;
}
