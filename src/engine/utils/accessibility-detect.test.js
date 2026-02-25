/**
 * Tests for accessibility detection utilities.
 *
 * Covers:
 * - XMP conformance parsing (PDF/A element & attribute style, PDF/UA)
 * - Title extraction from XMP dc:title
 * - Missing/malformed XMP handling
 * - detectAccessibilityTraits (MarkInfo, language, ToUnicode)
 * - auditToUnicodeCoverage
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, PDFDict } from 'pdf-lib';
import {
  parseConformanceFromXmp,
  parseTitleFromXmp,
  detectAccessibilityTraits,
  auditToUnicodeCoverage,
} from './accessibility-detect.js';
import {
  createTaggedPdf,
  createUntaggedPdf,
  createPdfWithSuspects,
} from '../../../test/fixtures/create-test-pdfs.js';

const encode = (str) => new TextEncoder().encode(str);

// ---- XMP conformance parsing ----

describe('parseConformanceFromXmp', () => {
  it('should detect PDF/A part and conformance from element-style XMP', () => {
    const xmp = encode('<pdfaid:part>2</pdfaid:part><pdfaid:conformance>A</pdfaid:conformance>');
    const result = parseConformanceFromXmp(xmp);
    expect(result.pdfAPart).toBe('2');
    expect(result.pdfAConformance).toBe('A');
  });

  it('should detect PDF/A from attribute-style XMP', () => {
    const xmp = encode('<rdf:Description pdfaid:part="1" pdfaid:conformance="B" />');
    const result = parseConformanceFromXmp(xmp);
    expect(result.pdfAPart).toBe('1');
    expect(result.pdfAConformance).toBe('B');
  });

  it('should detect multiple PDF/A levels (1a, 1b, 2a, 2b, 3a, 3b)', () => {
    const cases = [
      { part: '1', conf: 'A' },
      { part: '1', conf: 'B' },
      { part: '2', conf: 'A' },
      { part: '2', conf: 'B' },
      { part: '3', conf: 'A' },
      { part: '3', conf: 'B' },
    ];
    for (const { part, conf } of cases) {
      const xmp = encode(`<pdfaid:part>${part}</pdfaid:part><pdfaid:conformance>${conf}</pdfaid:conformance>`);
      const result = parseConformanceFromXmp(xmp);
      expect(result.pdfAPart).toBe(part);
      expect(result.pdfAConformance).toBe(conf);
    }
  });

  it('should detect PDF/UA from element-style XMP', () => {
    const xmp = encode('<pdfuaid:part>1</pdfuaid:part>');
    const result = parseConformanceFromXmp(xmp);
    expect(result.pdfUAPart).toBe('1');
  });

  it('should detect PDF/UA from attribute-style XMP', () => {
    const xmp = encode('<rdf:Description pdfuaid:part="1" />');
    const result = parseConformanceFromXmp(xmp);
    expect(result.pdfUAPart).toBe('1');
  });

  it('should return nulls for missing XMP metadata', () => {
    const result = parseConformanceFromXmp(encode(''));
    expect(result.pdfAPart).toBeNull();
    expect(result.pdfAConformance).toBeNull();
    expect(result.pdfUAPart).toBeNull();
  });

  it('should not throw on malformed XMP bytes', () => {
    const result = parseConformanceFromXmp(new Uint8Array([0xFF, 0xFE, 0x00, 0x01]));
    expect(result.pdfAPart).toBeNull();
    expect(result.pdfAConformance).toBeNull();
    expect(result.pdfUAPart).toBeNull();
  });
});

// ---- Title extraction ----

describe('parseTitleFromXmp', () => {
  it('should extract title from standard RDF structure', () => {
    const xmp = encode('<dc:title><rdf:Alt><rdf:li xml:lang="x-default">My Document Title</rdf:li></rdf:Alt></dc:title>');
    expect(parseTitleFromXmp(xmp)).toBe('My Document Title');
  });

  it('should return null when no dc:title present', () => {
    const xmp = encode('<rdf:Description />');
    expect(parseTitleFromXmp(xmp)).toBeNull();
  });

  it('should return null for empty title text', () => {
    const xmp = encode('<dc:title><rdf:Alt><rdf:li xml:lang="x-default">  </rdf:li></rdf:Alt></dc:title>');
    // Trimmed empty string should return null
    expect(parseTitleFromXmp(xmp)).toBeNull();
  });
});

// ---- detectAccessibilityTraits ----

describe('detectAccessibilityTraits', () => {
  it('should detect MarkInfo/Marked true', async () => {
    const bytes = await createTaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const traits = detectAccessibilityTraits(doc);
    expect(traits.isTagged).toBe(true);
    expect(traits.markedStatus).toBe('true');
  });

  it('should detect MarkInfo/Marked false', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: false });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const traits = detectAccessibilityTraits(reloaded);
    expect(traits.isTagged).toBe(false);
    expect(traits.markedStatus).toBe('false');
  });

  it('should detect missing MarkInfo', async () => {
    const bytes = await createUntaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const traits = detectAccessibilityTraits(doc);
    expect(traits.isTagged).toBe(false);
    expect(traits.markedStatus).toBe('missing');
  });

  it('should detect MarkInfo/Suspects true', async () => {
    const bytes = await createPdfWithSuspects();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const traits = detectAccessibilityTraits(doc);
    expect(traits.hasSuspects).toBe(true);
  });

  it('should extract language from catalog /Lang', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.catalog.set(PDFName.of('Lang'), PDFString.of('fr-FR'));
    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const traits = detectAccessibilityTraits(reloaded);
    expect(traits.lang).toBe('fr-FR');
  });

  it('should detect DisplayDocTitle preference', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const vp = doc.context.obj({ DisplayDocTitle: true });
    doc.catalog.set(PDFName.of('ViewerPreferences'), vp);
    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const traits = detectAccessibilityTraits(reloaded);
    expect(traits.displayDocTitle).toBe(true);
  });
});

// ---- auditToUnicodeCoverage ----

describe('auditToUnicodeCoverage', () => {
  it('should return total=0 for a PDF with no fonts', async () => {
    const bytes = await createUntaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const result = auditToUnicodeCoverage(doc);
    expect(result.total).toBe(0);
    expect(result.fonts).toEqual([]);
  });

  it('should count fonts and detect ToUnicode presence', async () => {
    // Create a PDF that embeds a font (pdf-lib embeds fonts with ToUnicode)
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont('Helvetica');
    page.drawText('Test', { font, size: 12 });
    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const result = auditToUnicodeCoverage(reloaded);
    expect(result.total).toBeGreaterThan(0);
    expect(result.fonts.length).toBeGreaterThan(0);
  });
});
