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
 */
import { PDFName, PDFDict, PDFRef } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkMetadata(pdfDoc, ctx) {
  const { traits } = ctx;
  const findings = [];

  // #1 — Document title
  findings.push({
    id: 'document-title',
    category: 'metadata',
    title: 'Document Title',
    status: traits.title ? 'pass' : 'fail',
    summary: traits.title
      ? `Document title is set: "${traits.title}"`
      : 'No document title found. The title bar will show the filename instead.',
    details: traits.title ? [{ label: 'Title', value: traits.title }] : [],
    remediation: traits.title
      ? null
      : 'Set the document title in your authoring tool (File > Properties in Word/InDesign, or Document Properties in Acrobat). The title should describe the document content, not repeat the filename.',
    wcagRef: '2.4.2',
    pdfuaRef: '7.1',
  });

  // #2 — Document language
  findings.push({
    id: 'document-lang',
    category: 'metadata',
    title: 'Document Language',
    status: traits.lang ? 'pass' : 'fail',
    summary: traits.lang
      ? `Document language is set: "${traits.lang}"`
      : 'No document language specified. Screen readers may use the wrong pronunciation rules.',
    details: traits.lang ? [{ label: 'Language', value: traits.lang }] : [],
    remediation: traits.lang
      ? null
      : 'Set the document language in your authoring tool. In Word: File > Options > Language. In Acrobat: File > Properties > Advanced > Language.',
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
      ? 'Remove security restrictions that block accessibility access. In Acrobat: File > Properties > Security > Change Settings, then enable "Enable text access for screen reader devices."'
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
      : 'Document does not claim PDF/UA conformance. This is informational — the document may still be accessible.',
    details: [],
    remediation: traits.isPdfUA
      ? null
      : 'PDF/UA conformance is declared via XMP metadata. Tools like Acrobat Pro and axesPDF can add this declaration after validation.',
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
      : 'In Acrobat: File > Properties > Initial View > Window Options > Show: Document Title.',
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
      : 'Add bookmarks in your authoring tool. In Word, use heading styles — they become bookmarks automatically on export. In Acrobat: View > Navigation Panels > Bookmarks.',
    wcagRef: '2.4.5',
    pdfuaRef: null,
  });

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
      summary: 'No encryption — accessibility access is unrestricted.',
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
