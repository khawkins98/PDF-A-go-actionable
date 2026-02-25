/**
 * Tests for the forms audit module.
 *
 * Covers:
 * - Form fields with TU tooltips (pass)
 * - Form fields without TU tooltips (warning)
 * - No form fields (not-applicable)
 * - Tab order set to structure (pass)
 * - Tab order not set (warning)
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import { checkForms } from './forms.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createPdfWithForms,
  createPdfWithTabOrder,
  createPdfWithEmptyAcroForm,
  createPdfWithFormsNoFT,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkForms', () => {
  it('should pass when form fields have TU tooltips', async () => {
    const bytes = await createPdfWithForms({ hasTU: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('pass');
    expect(formFinding.summary).toContain('tooltip');
  });

  it('should warn when form fields lack TU tooltips', async () => {
    const bytes = await createPdfWithForms({ hasTU: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('warning');
    expect(formFinding.summary).toContain('missing');
  });

  it('should report not-applicable when no form fields exist', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('not-applicable');
  });

  it('should pass tab order when /Tabs /S is set', async () => {
    const bytes = await createPdfWithTabOrder(true);
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const tabFinding = findings.find(f => f.id === 'tab-order');
    expect(tabFinding).toBeDefined();
    expect(tabFinding.status).toBe('pass');
    expect(tabFinding.summary).toContain('structure order');
  });

  it('should warn when /Tabs /S is not set', async () => {
    const bytes = await createPdfWithTabOrder(false);
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const tabFinding = findings.find(f => f.id === 'tab-order');
    expect(tabFinding).toBeDefined();
    expect(tabFinding.status).toBe('warning');
    expect(tabFinding.summary).toContain('missing');
  });

  it('should report not-applicable for empty AcroForm (Fields array present but empty)', async () => {
    const bytes = await createPdfWithEmptyAcroForm();
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('not-applicable');
  });

  it('should warn when form fields lack /FT (field type)', async () => {
    const bytes = await createPdfWithFormsNoFT();
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    // Fields without FT should still be counted and warned about missing TU
    expect(formFinding.status).toBe('warning');
  });

  it('should decode HexString-encoded /TU values correctly', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const field = doc.context.obj({
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of('name_field'),
      TU: PDFHexString.fromText('Enter your full name'),
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    const fieldRef = doc.context.register(field);
    const acroForm = doc.context.obj({ Fields: doc.context.obj([fieldRef]) });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkForms(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'form-labels');
    expect(f).toBeDefined();
    expect(f.status).toBe('pass');
    expect(f.details.some(d => d.value && d.value.includes('Enter your full name'))).toBe(true);
  });

  it('should warn when multi-page PDF has inconsistent tab order', async () => {
    const doc = await PDFDocument.create();
    const page1 = doc.addPage();
    const page2 = doc.addPage();
    // Only page 1 has /Tabs /S; page 2 does not
    page1.node.set(PDFName.of('Tabs'), PDFName.of('S'));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkForms(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'tab-order');
    expect(f).toBeDefined();
    expect(f.status).toBe('warning');
    expect(f.summary).toContain('1 of 2');
  });
});
