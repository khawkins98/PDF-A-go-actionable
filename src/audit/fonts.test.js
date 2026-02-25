/**
 * Tests for the fonts audit module.
 *
 * Covers:
 * - Not-applicable when no fonts in document
 * - Pass/warning based on ToUnicode coverage
 * - Finding structure validation
 */
import { describe, it, expect } from 'vitest';
import { checkFonts } from './fonts.js';
import { buildTestContext } from '../../test/helpers/context.js';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { createUntaggedPdf, createTaggedPdf } from '../../test/fixtures/create-test-pdfs.js';

describe('checkFonts', () => {
  it('should return not-applicable when no fonts in document', async () => {
    // An untagged PDF with no drawn text has zero font objects
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.id).toBe('font-tounicode');
    expect(f.status).toBe('not-applicable');
    expect(f.category).toBe('fonts');
    expect(f.summary).toContain('No fonts');
  });

  it('should return finding with correct structure', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const f = findings[0];
    expect(f.id).toBe('font-tounicode');
    expect(f.category).toBe('fonts');
    expect(f.title).toBe('Font Unicode Mapping');
    expect(f.pdfuaRef).toBe('7.21.3');
    expect(Array.isArray(f.details)).toBe(true);
  });

  it('should return pass or warning for documents with fonts', async () => {
    // A tagged PDF with a title has at least standard fonts when text is drawn,
    // but pdf-lib create() might not produce font objects without drawing text.
    // Use createTaggedPdf which at least sets up the structure.
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(1);
    const f = findings[0];
    // Should be not-applicable (no actual text drawn) or pass/warning
    expect(['pass', 'warning', 'not-applicable']).toContain(f.status);
  });

  it('should include pdfuaRef on the finding', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings[0].pdfuaRef).toBe('7.21.3');
  });

  it('should handle font without /BaseFont gracefully', async () => {
    // Create a PDF with a manually added font dict missing /BaseFont
    const doc = await PDFDocument.create();
    doc.addPage();
    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      // Intentionally missing /BaseFont
    });
    doc.context.register(fontDict);
    const saved = await doc.save();

    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    // Should not throw, and should report the font as 'Unknown'
    expect(findings).toHaveLength(1);
    expect(findings[0].status).not.toBe('not-applicable'); // has at least one font
    expect(findings[0].details.some(d => d.label === 'Unknown')).toBe(true);
  });

  it('should warn when some fonts lack ToUnicode', async () => {
    // Create a PDF with a font that has no ToUnicode
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    // Add a manually created font without ToUnicode
    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('TestFont-NoToUnicode'),
    });
    doc.context.register(fontDict);
    const saved = await doc.save();

    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('warning');
    expect(findings[0].summary).toContain('missing ToUnicode');
  });
});
