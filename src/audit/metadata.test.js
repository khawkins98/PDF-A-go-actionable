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
import { checkMetadata } from './metadata.js';
import { buildTestContext } from '../../test/helpers/context.js';
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
});
