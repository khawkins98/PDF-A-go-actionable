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
});
