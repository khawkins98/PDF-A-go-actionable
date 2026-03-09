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
  createPdfWithMixedLinks,
  createPdfWithLinksWithChildText,
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

  // --- Additional link text quality tests ---

  it('should fail when link has no ActualText AND no Alt', async () => {
    const bytes = await createPdfWithMixedLinks([
      { text: null },
      { text: 'Read the full report' },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('fail');
    expect(linkFinding.summary).toContain('missing text');
  });

  it('should detect all GENERIC_LINK_TEXT patterns', async () => {
    const genericTexts = [
      'click here', 'here', 'read more', 'learn more',
      'link', 'this link', 'more info', 'download', 'more',
    ];
    const bytes = await createPdfWithLinks(genericTexts);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('warning');
    expect(linkFinding.summary).toContain(`${genericTexts.length} generic`);
  });

  it('should be case-insensitive for generic text matching', async () => {
    const bytes = await createPdfWithLinks(['CLICK HERE', 'Click Here', 'HERE']);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('warning');
    expect(linkFinding.summary).toContain('3 generic');
  });

  it('should detect FTP bare URL as an issue', async () => {
    const bytes = await createPdfWithLinks(['ftp://files.example.com/report.pdf']);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('warning');
    expect(linkFinding.summary).toContain('bare URL');
  });

  it('should report mixed link issues with detail', async () => {
    const bytes = await createPdfWithMixedLinks([
      { text: 'View full accessibility report' },    // good
      { text: 'click here' },                         // generic
      { text: 'https://example.com/long-path' },      // bare URL
      { text: null },                                  // missing
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('fail'); // missing text makes it a fail
    expect(linkFinding.summary).toContain('3 of 4');
  });

  // --- Link text extraction from children ---

  it('should extract text from child Span elements when Link has no direct text', async () => {
    const bytes = await createPdfWithLinksWithChildText([
      { text: null, childTexts: ['Download the report'] },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('pass');
  });

  it('should concatenate text from multiple child elements', async () => {
    const bytes = await createPdfWithLinksWithChildText([
      { text: null, childTexts: ['View', 'accessibility', 'guidelines'] },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('pass');
  });

  it('should prefer direct ActualText over child text', async () => {
    const bytes = await createPdfWithLinksWithChildText([
      { text: 'click here', childTexts: ['Download the full annual report'] },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    // Direct text is "click here" (generic) so it should warn
    expect(linkFinding.status).toBe('warning');
  });

  it('should report missing text when Link has no text and children have no text', async () => {
    const bytes = await createPdfWithLinksWithChildText([
      { text: null, childTexts: [] },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    expect(linkFinding.status).toBe('fail');
  });

  it('should fail when link text is whitespace-only', async () => {
    const bytes = await createPdfWithMixedLinks([
      { text: '   ' },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkLinks(ctx.pdfDoc, ctx);

    const linkFinding = findings.find(f => f.id === 'link-text');
    expect(linkFinding).toBeDefined();
    // Whitespace-only text is effectively empty
    expect(linkFinding.status).toBe('fail');
  });
});
