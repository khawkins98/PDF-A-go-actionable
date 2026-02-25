/**
 * Tests for the reading-order audit module.
 *
 * Covers:
 * - Returns exactly 3 findings
 * - All findings have status 'manual'
 * - Expected finding IDs
 * - Each finding has required fields
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { checkReadingOrder } from './reading-order.js';
import { buildTestContext } from '../../test/helpers/context.js';
import { createUntaggedPdf, createTaggedPdf } from '../../test/fixtures/create-test-pdfs.js';

describe('checkReadingOrder', () => {
  let findings;

  // Reading order returns deterministic results regardless of PDF content,
  // so we only need one test context.
  beforeAll(async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    findings = checkReadingOrder(ctx.pdfDoc, ctx);
  });

  it('should return exactly 3 findings', () => {
    expect(findings).toHaveLength(3);
  });

  it('should return all findings with status "manual"', () => {
    for (const f of findings) {
      expect(f.status).toBe('manual');
    }
  });

  it('should include reading-order finding', () => {
    const f = findings.find(f => f.id === 'reading-order');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('Reading Order');
    expect(f.wcagRef).toBe('1.3.2');
  });

  it('should include pac-validation finding', () => {
    const f = findings.find(f => f.id === 'pac-validation');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('PAC');
  });

  it('should include screen-reader-test finding', () => {
    const f = findings.find(f => f.id === 'screen-reader-test');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('Screen Reader');
  });

  it('should include details and remediation on each finding', () => {
    for (const f of findings) {
      expect(Array.isArray(f.details)).toBe(true);
      expect(f.details.length).toBeGreaterThan(0);
      expect(typeof f.remediation).toBe('string');
      expect(f.remediation.length).toBeGreaterThan(0);
    }
  });

  it('should have summary text on each finding', () => {
    for (const f of findings) {
      expect(typeof f.summary).toBe('string');
      expect(f.summary.length).toBeGreaterThan(0);
    }
  });

  it('should include tab order guidance when form fields exist without /Tabs /S', async () => {
    // Build a PDF with form fields but no /Tabs /S
    const doc = await PDFDocument.create();
    doc.addPage();

    // Add MarkInfo + StructTreeRoot to make it tagged
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const str = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(str);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    str.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    // Add form fields
    const field = doc.context.obj({
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of('field1'),
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    const fieldRef = doc.context.register(field);
    const acroForm = doc.context.obj({ Fields: doc.context.obj([fieldRef]) });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
    // No /Tabs /S on page

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const formFindings = checkReadingOrder(ctx.pdfDoc, ctx);

    const f = formFindings.find(f => f.id === 'reading-order');
    expect(f).toBeDefined();
    const tabDetail = f.details.find(d => d.label === 'Form tab order');
    expect(tabDetail).toBeDefined();
    expect(tabDetail.value).toContain('form fields');
  });

  it('should include no-headings guidance when document has structure but no headings', async () => {
    // Tagged PDF with only P elements, no headings
    const bytes = await createTaggedPdf(); // has Document > P, no headings
    const ctx = await buildTestContext(bytes);
    const headingFindings = checkReadingOrder(ctx.pdfDoc, ctx);

    const f = headingFindings.find(f => f.id === 'reading-order');
    expect(f).toBeDefined();
    const headingDetail = f.details.find(d => d.label === 'No headings found');
    expect(headingDetail).toBeDefined();
    expect(headingDetail.value).toContain('heading');
  });
});
