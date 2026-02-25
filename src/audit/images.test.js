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
  createPdfWithFigureAlts,
} from '../../test/fixtures/create-test-pdfs.js';
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';

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

  // --- Alt text quality checks ---

  it('should treat empty alt text as missing', async () => {
    const bytes = await createPdfWithFigureAlts([{ alt: '' }]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('fail');
  });

  it('should treat whitespace-only alt text as missing', async () => {
    const bytes = await createPdfWithFigureAlts([{ alt: '   ' }]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('fail');
  });

  it('should warn on generic alt text like "image"', async () => {
    const bytes = await createPdfWithFigureAlts([{ alt: 'image' }]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    // Should warn about generic alt text
    expect(altFinding.status).toBe('warning');
  });

  it('should report mixed figures with per-figure detail', async () => {
    const bytes = await createPdfWithFigureAlts([
      { alt: 'A descriptive caption for the chart' },
      { alt: null },
      { alt: 'photo' },
    ]);
    const ctx = await buildTestContext(bytes);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    // Has at least one figure without alt and one generic
    expect(['fail', 'warning']).toContain(altFinding.status);
  });

  it('should detect custom figure type via RoleMap (e.g., "Image" → "Figure")', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const roleMap = doc.context.obj({ Image: PDFName.of('Figure') });
    structTreeRoot.set(PDFName.of('RoleMap'), roleMap);

    const docElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const docElemRef = doc.context.register(docElem);

    // "Image" custom type without alt → should be detected as Figure via RoleMap
    const imgElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Image'),
      P: docElemRef,
    });
    const imgElemRef = doc.context.register(imgElem);

    docElem.set(PDFName.of('K'), doc.context.obj([imgElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkImages(ctx.pdfDoc, ctx);

    const altFinding = findings.find(f => f.id === 'image-alt-text');
    expect(altFinding).toBeDefined();
    expect(altFinding.status).toBe('fail');
    expect(altFinding.summary).toContain('1 of 1');
  });
});
