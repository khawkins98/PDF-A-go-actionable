/**
 * Tests for the images audit module.
 *
 * Covers:
 * - Figures with alt text (pass)
 * - Figures without alt text (fail)
 * - No figures in a tagged PDF (not-applicable)
 * - No structure tree (warning or not-applicable)
 */
import { describe, it, expect } from 'vitest';
import { checkImages } from './images.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithFigures,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkImages', () => {
  it('should pass when all figures have alt text', async () => {
    const bytes = await createPdfWithFigures([
      { hasAlt: true, alt: 'Bar chart showing Q4 revenue' },
      { hasAlt: true, alt: 'Team photo' },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('pass');
    expect(altFinding.summary).toContain('2 Figure');
  });

  it('should fail when some figures lack alt text', async () => {
    const bytes = await createPdfWithFigures([
      { hasAlt: true, alt: 'A chart' },
      { hasAlt: false },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('fail');
    expect(altFinding.summary).toContain('1 of 2');
  });

  it('should report not-applicable when no figures and no images exist', async () => {
    // createTaggedPdf has Document > P but no figures or image XObjects
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('not-applicable');
  });

  it('should report not-applicable when no struct tree and no images', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('not-applicable');
  });

  it('should fail when all figures lack alt text', async () => {
    const bytes = await createPdfWithFigures([
      { hasAlt: false },
      { hasAlt: false },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('fail');
    expect(altFinding.summary).toContain('2 of 2');
  });
});
