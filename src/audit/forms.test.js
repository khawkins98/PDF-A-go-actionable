/**
 * Tests for the forms audit module.
 *
 * Covers:
 * - Form fields with TU tooltips (pass)
 * - Form fields without TU tooltips (fail)
 * - No form fields (not-applicable)
 * - Tab order set to structure (pass)
 * - Tab order not set, no forms (warning — best practice)
 * - Tab order not set, with forms (fail — keyboard navigation broken)
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
  createPdfWithNestedFormFields,
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
    expect(formFinding.status).toBe('fail');
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

  it('should warn when /Tabs /S is not set and no form fields (best practice)', async () => {
    const bytes = await createPdfWithTabOrder(false);
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const tabFinding = findings.find(f => f.id === 'tab-order');
    expect(tabFinding).toBeDefined();
    expect(tabFinding.status).toBe('warning');
    expect(tabFinding.summary).toContain('missing');
  });

  it('should fail when /Tabs /S is not set and document has form fields', async () => {
    // Create a PDF with form fields but no /Tabs /S
    const { PDFDocument: PDFDoc, PDFName: Name, PDFString: Str } = await import('pdf-lib');
    const doc = await PDFDoc.create();
    doc.addPage(); // no /Tabs /S
    const field = doc.context.obj({
      Type: 'Annot',
      Subtype: Name.of('Widget'),
      FT: Name.of('Tx'),
      T: Str.of('name_field'),
      TU: Str.of('Enter name'),
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    const fieldRef = doc.context.register(field);
    const acroForm = doc.context.obj({ Fields: doc.context.obj([fieldRef]) });
    doc.catalog.set(Name.of('AcroForm'), doc.context.register(acroForm));
    const saved = await doc.save();

    const ctx = await buildTestContext(saved);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const tabFinding = findings.find(f => f.id === 'tab-order');
    expect(tabFinding).toBeDefined();
    expect(tabFinding.status).toBe('fail');
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
    // Fields without FT should still be counted — missing TU is now fail
    expect(formFinding.status).toBe('fail');
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

  it('should handle form field with /Ff read-only flag gracefully', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    // Field 1: read-only (Ff bit 1 = 1), with TU
    const field1 = doc.context.obj({
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of('readonly_field'),
      TU: PDFString.of('This field is read-only'),
      Ff: 1, // ReadOnly flag
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    const field1Ref = doc.context.register(field1);
    // Field 2: not read-only, no TU
    const field2 = doc.context.obj({
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of('editable_field'),
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    const field2Ref = doc.context.register(field2);
    const acroForm = doc.context.obj({ Fields: doc.context.obj([field1Ref, field2Ref]) });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkForms(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'form-labels');
    expect(f).toBeDefined();
    // Both fields should be counted (read-only doesn't skip the field)
    expect(f.status).toBe('fail'); // field2 missing TU
    expect(f.summary).toContain('1 of 2');
    // Field 1 should show its tooltip text
    expect(f.details.some(d => d.value && d.value.includes('This field is read-only'))).toBe(true);
  });

  it('should use WCAG 3.3.2 reference for form-labels findings', async () => {
    const bytes = await createPdfWithForms({ hasTU: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding.wcagRef).toBe('3.3.2');
  });

  it('should warn when multi-page PDF has inconsistent tab order (no forms)', async () => {
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

  // --- Nested form fields ---

  it('should find nested form fields via /Kids traversal', async () => {
    const bytes = await createPdfWithNestedFormFields({ hasTU: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('pass');
    expect(formFinding.summary).toContain('2 form field(s)');
  });

  it('should check /TU on leaf fields inside nested /Kids', async () => {
    const bytes = await createPdfWithNestedFormFields({ hasTU: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkForms(ctx.pdfDoc, ctx);

    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
    expect(formFinding.status).toBe('fail');
    expect(formFinding.summary).toContain('2 of 2');
  });

  it('should respect depth cap for nested /Kids', async () => {
    // Create deeply nested fields — should not crash
    const doc = await PDFDocument.create();
    doc.addPage();

    // Build a chain 25 levels deep (beyond cap of 20)
    let current = doc.context.obj({
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of('deep_field'),
      Rect: doc.context.obj([0, 0, 100, 20]),
    });
    let currentRef = doc.context.register(current);

    for (let i = 0; i < 25; i++) {
      const parent = doc.context.obj({
        T: PDFString.of(`level_${i}`),
        Kids: doc.context.obj([currentRef]),
      });
      currentRef = doc.context.register(parent);
    }

    const acroForm = doc.context.obj({ Fields: doc.context.obj([currentRef]) });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkForms(ctx.pdfDoc, ctx);

    // Should not crash, but the deep field may not be found due to depth cap
    const formFinding = findings.find(f => f.id === 'form-labels');
    expect(formFinding).toBeDefined();
  });
});
