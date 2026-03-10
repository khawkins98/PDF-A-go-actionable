/**
 * Tests for the metadata audit module.
 *
 * Covers:
 * - Document title present / absent
 * - Document language present / absent
 * - Security check (no encryption = pass)
 * - Bookmarks present / absent
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, PDFRawStream } from 'pdf-lib';
import { checkMetadata } from './metadata.js';
import { buildTestContext } from '../../test/helpers/context.js';
import { detectAccessibilityTraits } from '../engine/utils/accessibility-detect.js';
import { getRoleMapFromDoc } from '../engine/utils/role-map.js';
import {
  createUntaggedPdf,
  createPdfWithTitle,
  createPdfWithLang,
  createTaggedPdf,
  createPdfWithBookmarks,
  createPdfWithPerElementLang,
  createPdfWithInvalidLang,
} from '../../test/fixtures/create-test-pdfs.js';

/**
 * Helper: create a PDF with XMP metadata containing dc:title.
 * This sets the title in XMP (the PDF/UA-required location).
 */
async function createPdfWithXmpTitle(title = 'XMP Title Test') {
  const doc = await PDFDocument.create();
  doc.addPage();

  const xmpXml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${title}</rdf:li>
        </rdf:Alt>
      </dc:title>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const xmpBytes = new TextEncoder().encode(xmpXml);
  const xmpStream = PDFRawStream.of(
    doc.context.obj({
      Type: 'Metadata',
      Subtype: PDFName.of('XML'),
      Length: xmpBytes.length,
    }),
    xmpBytes,
  );
  const xmpRef = doc.context.register(xmpStream);
  doc.catalog.set(PDFName.of('Metadata'), xmpRef);

  return doc.save();
}

describe('checkMetadata', () => {
  it('should pass when title is in XMP metadata', async () => {
    const bytes = await createPdfWithXmpTitle('My XMP Report');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const titleFinding = findings.find(f => f.id === 'document-title');
    expect(titleFinding).toBeDefined();
    expect(titleFinding.status).toBe('pass');
    expect(titleFinding.summary).toContain('My XMP Report');
  });

  it('should warn when title is only in Info dict (not XMP)', async () => {
    const bytes = await createPdfWithTitle('My Accessible Report');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const titleFinding = findings.find(f => f.id === 'document-title');
    expect(titleFinding).toBeDefined();
    expect(titleFinding.status).toBe('warning');
    expect(titleFinding.summary).toContain('My Accessible Report');
    expect(titleFinding.summary).toContain('Info dictionary');
    expect(titleFinding.remediation).toContain('XMP');
  });

  it('should fail when title is missing', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const titleFinding = findings.find(f => f.id === 'document-title');
    expect(titleFinding).toBeDefined();
    expect(titleFinding.status).toBe('fail');
    expect(titleFinding.remediation).toBeTruthy();
  });

  it('should pass when language is set', async () => {
    const bytes = await createPdfWithLang('en-US');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'document-lang');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('pass');
    expect(langFinding.summary).toContain('en-US');
  });

  it('should fail when language is missing', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'document-lang');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('fail');
    expect(langFinding.remediation).toBeTruthy();
  });

  it('should pass security when there is no encryption', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const securityFinding = findings.find(f => f.id === 'security-permissions');
    expect(securityFinding).toBeDefined();
    expect(securityFinding.status).toBe('pass');
    expect(securityFinding.summary).toContain('unrestricted');
  });

  it('should detect bookmarks when present', async () => {
    const bytes = await createPdfWithBookmarks();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const bookmarkFinding = findings.find(f => f.id === 'bookmarks');
    expect(bookmarkFinding).toBeDefined();
    expect(bookmarkFinding.status).toBe('pass');
    expect(bookmarkFinding.summary).toContain('bookmarks');
  });

  it('should warn when bookmarks are missing', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const bookmarkFinding = findings.find(f => f.id === 'bookmarks');
    expect(bookmarkFinding).toBeDefined();
    expect(bookmarkFinding.status).toBe('warning');
  });

  it('should return all expected finding IDs', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const ids = findings.map(f => f.id);
    expect(ids).toContain('document-title');
    expect(ids).toContain('document-lang');
    expect(ids).toContain('security-permissions');
    expect(ids).toContain('pdfua-conformance');
    expect(ids).toContain('display-doc-title');
    expect(ids).toContain('bookmarks');
  });

  it('should warn when DisplayDocTitle is explicitly set to false', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Explicitly set DisplayDocTitle to false in ViewerPreferences
    const viewerPrefs = doc.context.obj({ DisplayDocTitle: false });
    doc.catalog.set(PDFName.of('ViewerPreferences'), viewerPrefs);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const displayFinding = findings.find(f => f.id === 'display-doc-title');
    expect(displayFinding).toBeDefined();
    expect(displayFinding.status).toBe('warning');
    expect(displayFinding.summary).toContain('not set');
  });

  // --- Encryption edge case tests ---
  // These tests inject an Encrypt dict into trailerInfo after loading
  // to simulate encrypted PDFs without actual encryption processing.

  /**
   * Helper: create a minimal loaded PDF and inject an Encrypt dict with given P value.
   * Returns the pdfDoc and a hand-built context suitable for checkMetadata.
   */
  async function buildEncryptedContext(pValue) {
    const doc = await PDFDocument.create();
    doc.addPage();
    const saved = await doc.save();
    const pdfDoc = await PDFDocument.load(saved, { updateMetadata: false });

    const encryptEntries = { Filter: PDFName.of('Standard'), V: 2 };
    if (pValue !== undefined) {
      encryptEntries.P = pValue;
    }
    const encryptDict = pdfDoc.context.obj(encryptEntries);
    const encryptRef = pdfDoc.context.register(encryptDict);
    pdfDoc.context.trailerInfo.Encrypt = encryptRef;

    const traits = detectAccessibilityTraits(pdfDoc);
    const roleMap = getRoleMapFromDoc(pdfDoc);
    const ctx = { pdfDoc, context: pdfDoc.context, traits, roleMap, structTreeRoot: null };
    return { pdfDoc, ctx };
  }

  it('should pass when encryption allows accessibility (bit 10 set)', async () => {
    // P = -3392 (0xFFFFF2C0): bits 5,6,7,8,9,10,11,12 set
    // Bit 10 (0x200) is set -> accessibility allowed
    const { pdfDoc, ctx } = await buildEncryptedContext(-3392);
    const findings = checkMetadata(pdfDoc, ctx);

    const security = findings.find(f => f.id === 'security-permissions');
    expect(security).toBeDefined();
    expect(security.status).toBe('pass');
    expect(security.summary).toContain('permitted');
    expect(security.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Accessibility extraction', value: 'Allowed' }),
      ]),
    );
  });

  it('should fail when encryption blocks accessibility (bit 10 cleared)', async () => {
    // P = -3904 (0xFFFFF0C0): bit 10 (0x200) is cleared -> accessibility blocked
    // Bit 5 (0x10) is also cleared -> content extraction blocked
    const { pdfDoc, ctx } = await buildEncryptedContext(-3904);
    const findings = checkMetadata(pdfDoc, ctx);

    const security = findings.find(f => f.id === 'security-permissions');
    expect(security).toBeDefined();
    expect(security.status).toBe('fail');
    expect(security.summary).toContain('blocks');
    expect(security.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Accessibility extraction', value: 'Blocked' }),
      ]),
    );
    expect(security.remediation).toBeTruthy();
  });

  it('should fail when encryption P value is non-numeric (malformed)', async () => {
    // A PDFString P value like "(abc)" will produce NaN from Number(),
    // and NaN & 0x200 === 0 (bitwise converts NaN to 0), so accessibility
    // is treated as blocked — fail-safe behavior for malformed encryption.
    const { pdfDoc, ctx } = await buildEncryptedContext(PDFString.of('abc'));
    const findings = checkMetadata(pdfDoc, ctx);

    const security = findings.find(f => f.id === 'security-permissions');
    expect(security).toBeDefined();
    // NaN bitwise AND with any mask is 0, so both permissions are "blocked"
    expect(security.status).toBe('fail');
  });

  it('should warn when encryption P value is missing', async () => {
    // Encrypt dict exists but has no /P entry -> warning
    const { pdfDoc, ctx } = await buildEncryptedContext(undefined);
    const findings = checkMetadata(pdfDoc, ctx);

    const security = findings.find(f => f.id === 'security-permissions');
    expect(security).toBeDefined();
    expect(security.status).toBe('warning');
    expect(security.summary).toContain('could not be read');
  });

  // --- Per-element language check tests ---

  it('should report per-element languages when StructElems have /Lang', async () => {
    const bytes = await createPdfWithPerElementLang({
      docLang: 'en-US',
      elements: [
        { type: 'P', lang: 'fr-FR' },
        { type: 'P' },
        { type: 'Span', lang: 'de-DE' },
      ],
    });
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('pass');
    expect(langFinding.category).toBe('metadata');
    expect(langFinding.details.length).toBeGreaterThanOrEqual(2);
    // Should mention the languages found
    expect(langFinding.summary).toContain('2');
  });

  it('should warn when no StructElems have /Lang in a tagged PDF', async () => {
    const bytes = await createPdfWithPerElementLang({
      docLang: 'en-US',
      elements: [
        { type: 'P' },
        { type: 'Span' },
      ],
    });
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('warning');
    expect(langFinding.remediation).toBeTruthy();
  });

  it('should be not-applicable when there is no structure tree', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('not-applicable');
  });

  it('should list distinct languages in details', async () => {
    const bytes = await createPdfWithPerElementLang({
      docLang: 'en-US',
      elements: [
        { type: 'P', lang: 'fr-FR' },
        { type: 'Span', lang: 'fr-FR' },
        { type: 'P', lang: 'de-DE' },
      ],
    });
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding).toBeDefined();
    expect(langFinding.status).toBe('pass');
    // Should have details for each distinct language (language is the label)
    const labels = langFinding.details.map(d => d.label);
    expect(labels).toContain('fr-FR');
    expect(labels).toContain('de-DE');
  });

  it('should include per-element-language in the finding IDs for tagged PDFs', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const ids = findings.map(f => f.id);
    expect(ids).toContain('per-element-language');
  });

  // --- BCP-47 language validation ---

  it('should warn when document lang is invalid BCP-47 (e.g., en_US)', async () => {
    const bytes = await createPdfWithInvalidLang('en_US');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'document-lang');
    expect(langFinding.status).toBe('warning');
    expect(langFinding.summary).toContain('not a valid BCP-47');
  });

  it('should warn when document lang is invalid BCP-47 (e.g., English)', async () => {
    const bytes = await createPdfWithInvalidLang('English');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'document-lang');
    expect(langFinding.status).toBe('warning');
  });

  it('should pass for valid BCP-47 subtags (en-US, zh-Hans-CN)', async () => {
    for (const lang of ['en-US', 'zh-Hans-CN', 'fr', 'de-DE']) {
      const bytes = await createPdfWithLang(lang);
      const ctx = await buildTestContext(bytes);
      const findings = checkMetadata(ctx.pdfDoc, ctx);
      const langFinding = findings.find(f => f.id === 'document-lang');
      expect(langFinding.status).toBe('pass');
    }
  });

  it('should warn when per-element lang has invalid BCP-47 format', async () => {
    const bytes = await createPdfWithPerElementLang({
      docLang: 'en-US',
      elements: [
        { type: 'P', lang: 'en_US' },
        { type: 'Span', lang: 'fr-FR' },
      ],
    });
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding.status).toBe('warning');
    expect(langFinding.details.some(d => d.label === 'Invalid language tag')).toBe(true);
  });

  it('should reference WCAG 3.1.2 for per-element language', async () => {
    const bytes = await createPdfWithPerElementLang({
      docLang: 'en-US',
      elements: [{ type: 'P', lang: 'fr-FR' }],
    });
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const langFinding = findings.find(f => f.id === 'per-element-language');
    expect(langFinding.wcagRef).toBe('3.1.2');
    expect(langFinding.pdfuaRef).toBe('7.2');
  });
});
