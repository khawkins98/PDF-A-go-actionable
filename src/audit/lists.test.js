/**
 * Tests for the lists audit module.
 *
 * Covers:
 * - Proper list structure L > LI > Lbl + LBody (pass)
 * - Missing LBody (fail)
 * - No lists in document (not-applicable)
 * - No structure tree (not-applicable)
 */
import { describe, it, expect } from 'vitest';
import { checkLists } from './lists.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithList,
  createPdfWithListNoLbl,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkLists', () => {
  it('should pass with proper L > LI > Lbl + LBody structure', async () => {
    const bytes = await createPdfWithList({ hasLBody: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('pass');
    expect(listFinding.summary).toContain('proper');
  });

  it('should fail when LBody is missing from list items', async () => {
    const bytes = await createPdfWithList({ hasLBody: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('fail');
    expect(listFinding.summary).toContain('issue');
  });

  it('should report not-applicable when no lists exist', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('not-applicable');
    expect(listFinding.summary).toContain('No lists');
  });

  it('should report not-applicable when no structure tree', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('not-applicable');
  });

  it('should fail when LI has LBody but no Lbl (PDF/UA 7.6)', async () => {
    const bytes = await createPdfWithListNoLbl();
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('fail');
    expect(listFinding.summary).toContain('issue');
  });
});
