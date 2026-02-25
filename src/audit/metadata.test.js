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
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
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
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkMetadata', () => {
  it('should pass when title is set', async () => {
    const bytes = await createPdfWithTitle('My Accessible Report');
    const ctx = await buildTestContext(bytes);
    const findings = checkMetadata(ctx.pdfDoc, ctx);

    const titleFinding = findings.find(f => f.id === 'document-title');
    expect(titleFinding).toBeDefined();
    expect(titleFinding.status).toBe('pass');
    expect(titleFinding.summary).toContain('My Accessible Report');
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
});
