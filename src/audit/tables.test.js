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
import { PDFDocument, PDFName } from 'pdf-lib';

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

  it('should detect custom table type via RoleMap (e.g., "DataTable" → "Table")', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const roleMap = doc.context.obj({ DataTable: PDFName.of('Table') });
    structTreeRoot.set(PDFName.of('RoleMap'), roleMap);

    const docElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const docElemRef = doc.context.register(docElem);

    // "DataTable" custom type → should be detected as Table via RoleMap
    const tableElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('DataTable'),
      P: docElemRef,
    });
    const tableElemRef = doc.context.register(tableElem);

    // Add TR > TD structure (no TH → should fail)
    const trElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('TR'),
      P: tableElemRef,
    });
    const trElemRef = doc.context.register(trElem);

    const tdElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('TD'),
      P: trElemRef,
    });
    const tdElemRef = doc.context.register(tdElem);

    trElem.set(PDFName.of('K'), doc.context.obj([tdElemRef]));
    tableElem.set(PDFName.of('K'), doc.context.obj([trElemRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([tableElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);

    const tableFinding = findings.find(f => f.id === 'table-headers');
    expect(tableFinding).toBeDefined();
    expect(tableFinding.status).toBe('fail');
    expect(tableFinding.summary).toContain('header issues');
  });
});
