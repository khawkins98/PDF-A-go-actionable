/**
 * Tests for the links audit module.
 *
 * Covers:
 * - Good link text (pass)
 * - Generic link text like "click here" (warning)
 * - Bare URL as link text (warning)
 * - No links in document (not-applicable)
 * - No structure tree (not-applicable)
 */
import { describe, it, expect } from 'vitest';
import { checkLinks } from './links.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithLinks,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkLinks', () => {
  it('should pass when link text is descriptive', async () => {
    const bytes = await createPdfWithLinks([
      'Download the 2024 annual report',
      'View accessibility guidelines',
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('pass');
    expect(linkFinding.summary).toContain('2 link');
  });

  it('should warn when link text is generic', async () => {
    const bytes = await createPdfWithLinks([
      'Click here',
      'Read our accessibility policy',
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('warning');
    expect(linkFinding.summary).toContain('generic');
  });

  it('should warn when link text is a bare URL', async () => {
    const bytes = await createPdfWithLinks([
      'https://example.com/some-long-path',
      'Visit our documentation portal',
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('warning');
    expect(linkFinding.summary).toContain('bare URL');
  });

  it('should report not-applicable when no links exist', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('not-applicable');
    expect(linkFinding.summary).toContain('No links');
  });

  it('should report not-applicable when no structure tree', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('not-applicable');
  });
});
