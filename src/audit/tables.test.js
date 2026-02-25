/**
 * Tests for the tables audit module.
 *
 * Covers:
 * - Table with TH + Scope (pass)
 * - Table without TH (fail)
 * - Table with TH but no Scope (fail)
 * - No tables in document (not-applicable)
 * - No structure tree (not-applicable)
 */
import { describe, it, expect } from 'vitest';
import { checkTables } from './tables.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithTable,
  createPdfWithTableInvalidScope,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkTables', () => {
  it('should pass when table has TH cells with Scope', async () => {
    const bytes = await createPdfWithTable({ hasTH: true, hasScope: true });
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('pass');
    expect(tableFinding.summary).toContain('1 table');
  });

  it('should fail when table has no TH cells', async () => {
    const bytes = await createPdfWithTable({ hasTH: false, hasScope: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('fail');
    expect(tableFinding.summary).toContain('header issues');
  });

  it('should fail when TH cells lack Scope attribute', async () => {
    const bytes = await createPdfWithTable({ hasTH: true, hasScope: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('fail');
    expect(tableFinding.summary).toContain('header issues');
  });

  it('should report not-applicable when no tables exist', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('not-applicable');
  });

  it('should report not-applicable when no structure tree', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('not-applicable');
  });

  it('should fail when TH cells have invalid Scope value', async () => {
    const bytes = await createPdfWithTableInvalidScope('Invalid');
    const ctx = await buildTestContext(bytes);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('fail');
    expect(tableFinding.summary).toContain('header issues');
  });
});
