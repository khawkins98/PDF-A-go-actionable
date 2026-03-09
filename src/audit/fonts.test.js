/**
 * Tests for the fonts audit module.
 *
 * Covers:
 * - Not-applicable when no fonts in document
 * - Pass/warning based on ToUnicode coverage
 * - Finding structure validation
 * - Font embedding as a separate finding
 */
import { describe, it, expect } from 'vitest';
import { checkFonts } from './fonts.js';
import { buildTestContext } from '../../test/helpers/context.js';
import { PDFDocument, PDFName, PDFDict, PDFRef } from 'pdf-lib';
import { createUntaggedPdf, createTaggedPdf, createPdfWithCompositeFont } from '../../test/fixtures/create-test-pdfs.js';

describe('checkFonts', () => {
  it('should return two findings (both not-applicable) when no fonts in document', async () => {
    // An untagged PDF with no drawn text has zero font objects
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);

    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode).toBeDefined();
    expect(tounicode.status).toBe('not-applicable');
    expect(tounicode.category).toBe('fonts');
    expect(tounicode.summary).toContain('No fonts');

    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding).toBeDefined();
    expect(embedding.status).toBe('not-applicable');
    expect(embedding.category).toBe('fonts');
  });

  it('should return font-tounicode finding with correct structure', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const f = findings.find(f => f.id === 'font-tounicode');
    expect(f.id).toBe('font-tounicode');
    expect(f.category).toBe('fonts');
    expect(f.title).toBe('Font Unicode Mapping');
    expect(f.pdfuaRef).toBe('7.21.3');
    expect(Array.isArray(f.details)).toBe(true);
  });

  it('should return font-embedding finding with correct structure', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const f = findings.find(f => f.id === 'font-embedding');
    expect(f.id).toBe('font-embedding');
    expect(f.category).toBe('fonts');
    expect(f.title).toBe('Font Embedding');
    expect(f.pdfuaRef).toBe('7.21.4');
    expect(Array.isArray(f.details)).toBe(true);
  });

  it('should return pass or warning for documents with fonts', async () => {
    // A tagged PDF with a title has at least standard fonts when text is drawn,
    // but pdf-lib create() might not produce font objects without drawing text.
    // Use createTaggedPdf which at least sets up the structure.
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    // Should be not-applicable (no actual text drawn) or pass/warning
    expect(['pass', 'warning', 'not-applicable']).toContain(tounicode.status);
  });

  it('should include correct pdfuaRef on both findings', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.pdfuaRef).toBe('7.21.3');

    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding.pdfuaRef).toBe('7.21.4');
  });

  it('should use WCAG 4.1.1 reference for font-tounicode findings', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.wcagRef).toBe('4.1.1');
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

    expect(findings).toHaveLength(2);

    // font-tounicode: should not throw, and should report the font as 'Unknown'
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.status).not.toBe('not-applicable'); // has at least one font
    expect(tounicode.details.some(d => d.label === 'Unknown')).toBe(true);
  });

  it('should fail when some fonts lack ToUnicode', async () => {
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

    expect(findings).toHaveLength(2);
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.status).toBe('fail');
    expect(tounicode.summary).toContain('missing ToUnicode');
  });

  // --- Font embedding detection tests ---

  it('should show embedded for font with FontDescriptor + FontFile (Type1)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Create a dummy object to serve as the font file
    const dummyObj = doc.context.obj({});
    const dummyRef = doc.context.register(dummyObj);

    // Create FontDescriptor with FontFile (Type1 embedding)
    const descriptor = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('TestType1'),
    });
    descriptor.set(PDFName.of('FontFile'), dummyRef);
    const descriptorRef = doc.context.register(descriptor);

    // Create font dict
    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('TestType1-Embedded'),
      FontDescriptor: descriptorRef,
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    // Font is embedded, so no "Not embedded" detail for this font
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);
    expect(embedding.status).toBe('pass');
  });

  it('should show embedded for font with FontDescriptor + FontFile2 (TrueType)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const dummyObj = doc.context.obj({});
    const dummyRef = doc.context.register(dummyObj);

    const descriptor = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('TestTrueType'),
    });
    descriptor.set(PDFName.of('FontFile2'), dummyRef);
    const descriptorRef = doc.context.register(descriptor);

    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('TrueType'),
      BaseFont: PDFName.of('TestTrueType-Embedded'),
      FontDescriptor: descriptorRef,
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);
    expect(embedding.status).toBe('pass');
  });

  it('should show embedded for font with FontDescriptor + FontFile3 (CFF/OpenType)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const dummyObj = doc.context.obj({});
    const dummyRef = doc.context.register(dummyObj);

    const descriptor = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('TestCFF'),
    });
    descriptor.set(PDFName.of('FontFile3'), dummyRef);
    const descriptorRef = doc.context.register(descriptor);

    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('TestCFF-Embedded'),
      FontDescriptor: descriptorRef,
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);
    expect(embedding.status).toBe('pass');
  });

  it('should show "Not embedded" for font with FontDescriptor but no FontFile/FontFile2/FontFile3', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // FontDescriptor without any FontFile entry
    const descriptor = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('TestNotEmbedded'),
    });
    const descriptorRef = doc.context.register(descriptor);

    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('TrueType'),
      BaseFont: PDFName.of('TestNotEmbedded-Regular'),
      FontDescriptor: descriptorRef,
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding.status).toBe('fail');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(1);
    expect(notEmbeddedDetails[0].label).toBe('TestNotEmbedded-Regular');
  });

  it('should skip CIDFontType0 and CIDFontType2 subtypes', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // CIDFontType0 — should be skipped
    const cidDescriptor0 = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('CIDFont0'),
    });
    const cidDescriptor0Ref = doc.context.register(cidDescriptor0);

    const cidFont0 = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('CIDFontType0'),
      BaseFont: PDFName.of('CIDFont0-Regular'),
      FontDescriptor: cidDescriptor0Ref,
    });
    doc.context.register(cidFont0);

    // CIDFontType2 — should be skipped
    const cidDescriptor2 = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('CIDFont2'),
    });
    const cidDescriptor2Ref = doc.context.register(cidDescriptor2);

    const cidFont2 = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('CIDFontType2'),
      BaseFont: PDFName.of('CIDFont2-Regular'),
      FontDescriptor: cidDescriptor2Ref,
    });
    doc.context.register(cidFont2);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    // CIDFont subtypes are skipped entirely — should not appear as not-embedded
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);

    // They should also not appear in the ToUnicode details
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    const cidDetails = tounicode.details.filter(d =>
      d.label && (d.label.includes('CIDFont0') || d.label.includes('CIDFont2'))
    );
    expect(cidDetails).toHaveLength(0);
  });

  it('should skip Type3 fonts', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Type3 font with a FontDescriptor but no font file — should not count as not-embedded
    const descriptor = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('Type3Font'),
    });
    const descriptorRef = doc.context.register(descriptor);

    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type3'),
      BaseFont: PDFName.of('Type3Font-Custom'),
      FontDescriptor: descriptorRef,
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);
    // Type3 is skipped — should not appear as not-embedded
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);

    // Should not appear in ToUnicode details either
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    const type3Details = tounicode.details.filter(d =>
      d.label && d.label.includes('Type3Font')
    );
    expect(type3Details).toHaveLength(0);
  });

  it('should pass standard 14 fonts without ToUnicode (exempt)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Standard 14 font — no FontDescriptor, no ToUnicode (like Helvetica in simple PDFs)
    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('Helvetica'),
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);

    // font-tounicode: standard 14 font is exempt — should pass
    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.status).toBe('pass');
    // Helvetica should appear in ToUnicode details with exempt note
    const helveticaDetail = tounicode.details.find(d => d.label === 'Helvetica');
    expect(helveticaDetail).toBeDefined();
    expect(helveticaDetail.value).toContain('Standard font');

    // font-embedding: No FontDescriptor, so nothing to check for embedding
    // Helvetica should NOT appear as "Not embedded" since there's no FontDescriptor
    const embedding = findings.find(f => f.id === 'font-embedding');
    const notEmbeddedDetails = embedding.details.filter(d =>
      d.value === 'Not embedded' && d.label === 'Helvetica'
    );
    expect(notEmbeddedDetails).toHaveLength(0);
  });

  it('should fail non-standard fonts without ToUnicode', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Non-standard font without ToUnicode (custom icon font, etc.)
    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('CustomIconFont'),
      Encoding: PDFName.of('WinAnsiEncoding'),
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode).toBeDefined();
    expect(tounicode.status).toBe('fail');
    expect(tounicode.summary).toContain('missing ToUnicode');

    // Should appear in details
    const iconDetail = tounicode.details.find(d => d.label === 'CustomIconFont');
    expect(iconDetail).toBeDefined();
    expect(iconDetail.value).toBe('Missing ToUnicode');
  });

  it('should pass standard 14 ZapfDingbats without ToUnicode (exempt)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const fontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('ZapfDingbats'),
    });
    doc.context.register(fontDict);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const tounicode = findings.find(f => f.id === 'font-tounicode');
    expect(tounicode.status).toBe('pass');
    const detail = tounicode.details.find(d => d.label === 'ZapfDingbats');
    expect(detail.value).toContain('Standard font');
  });

  it('should report correct counts in embedding summary for mixed fonts', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    // Font 1: embedded (has FontFile2)
    const dummyObj1 = doc.context.obj({});
    const dummyRef1 = doc.context.register(dummyObj1);

    const descriptor1 = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('EmbeddedFont'),
    });
    descriptor1.set(PDFName.of('FontFile2'), dummyRef1);
    const descriptorRef1 = doc.context.register(descriptor1);

    const font1 = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('TrueType'),
      BaseFont: PDFName.of('EmbeddedFont-Bold'),
      FontDescriptor: descriptorRef1,
    });
    doc.context.register(font1);

    // Font 2: NOT embedded (FontDescriptor without font file)
    const descriptor2 = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('NotEmbeddedFont'),
    });
    const descriptorRef2 = doc.context.register(descriptor2);

    const font2 = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('TrueType'),
      BaseFont: PDFName.of('NotEmbeddedFont-Regular'),
      FontDescriptor: descriptorRef2,
    });
    doc.context.register(font2);

    // Font 3: also embedded (has FontFile)
    const dummyObj3 = doc.context.obj({});
    const dummyRef3 = doc.context.register(dummyObj3);

    const descriptor3 = doc.context.obj({
      Type: 'FontDescriptor',
      FontName: PDFName.of('AnotherEmbedded'),
    });
    descriptor3.set(PDFName.of('FontFile'), dummyRef3);
    const descriptorRef3 = doc.context.register(descriptor3);

    const font3 = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('AnotherEmbedded-Italic'),
      FontDescriptor: descriptorRef3,
    });
    doc.context.register(font3);

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    expect(findings).toHaveLength(2);

    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding.status).toBe('fail');

    // Should have exactly 1 "Not embedded" detail for the not-embedded font
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(1);
    expect(notEmbeddedDetails[0].label).toBe('NotEmbeddedFont-Regular');

    // Should have an embedding summary since notEmbedded > 0
    const summaryDetail = embedding.details.find(d => d.label === 'Embedding summary');
    expect(summaryDetail).toBeDefined();
    expect(summaryDetail.value).toBe('2 embedded, 1 not embedded');

    // Summary text should mention the count
    expect(embedding.summary).toContain('1 of 3');
  });

  // --- CIDFont composite font embedding tests ---

  it('should detect embedded CIDFont via Type0 DescendantFonts', async () => {
    const bytes = await createPdfWithCompositeFont({ embedded: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding).toBeDefined();
    expect(embedding.status).toBe('pass');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(0);
  });

  it('should detect not-embedded CIDFont via Type0 DescendantFonts', async () => {
    const bytes = await createPdfWithCompositeFont({ embedded: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkFonts(ctx.pdfDoc, ctx);

    const embedding = findings.find(f => f.id === 'font-embedding');
    expect(embedding).toBeDefined();
    expect(embedding.status).toBe('fail');
    const notEmbeddedDetails = embedding.details.filter(d => d.value === 'Not embedded');
    expect(notEmbeddedDetails).toHaveLength(1);
    expect(notEmbeddedDetails[0].label).toBe('TestComposite-Regular');
  });
});
