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

  it('should fail for data-only table (all TD, no TH)', async () => {
    // Table with TR > TD only, no TH cells at all
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const tableElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const tableElemRef = doc.context.register(tableElem);
    const tr = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: tableElemRef });
    const trRef = doc.context.register(tr);
    const td1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: trRef });
    const td1Ref = doc.context.register(td1);
    const td2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: trRef });
    const td2Ref = doc.context.register(td2);
    tr.set(PDFName.of('K'), doc.context.obj([td1Ref, td2Ref]));
    tableElem.set(PDFName.of('K'), doc.context.obj([trRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([tableElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'table-headers');
    expect(f).toBeDefined();
    expect(f.status).toBe('fail');
    expect(f.details.some(d => d.value && d.value.includes('No TH'))).toBe(true);
  });

  it('should handle TH with /A as array of attribute dicts', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const tableElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const tableElemRef = doc.context.register(tableElem);
    const tr = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: tableElemRef });
    const trRef = doc.context.register(tr);
    // TH with /A as an array containing a dict with Scope
    const attrDict = doc.context.obj({ O: PDFName.of('Table'), Scope: PDFName.of('Column') });
    const attrRef = doc.context.register(attrDict);
    const attrArray = doc.context.obj([attrRef]);
    const th = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TH'), P: trRef, A: attrArray });
    const thRef = doc.context.register(th);
    const td = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: trRef });
    const tdRef = doc.context.register(td);
    tr.set(PDFName.of('K'), doc.context.obj([thRef, tdRef]));
    tableElem.set(PDFName.of('K'), doc.context.obj([trRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([tableElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'table-headers');
    expect(f).toBeDefined();
    expect(f.status).toBe('pass');
  });

  it('should fail when some TH cells have Scope and others do not', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const tableElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const tableElemRef = doc.context.register(tableElem);
    const tr = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: tableElemRef });
    const trRef = doc.context.register(tr);
    // TH 1 with Scope
    const attrDict = doc.context.obj({ O: PDFName.of('Table'), Scope: PDFName.of('Column') });
    const th1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TH'), P: trRef, A: doc.context.register(attrDict) });
    const th1Ref = doc.context.register(th1);
    // TH 2 without Scope
    const th2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TH'), P: trRef });
    const th2Ref = doc.context.register(th2);
    tr.set(PDFName.of('K'), doc.context.obj([th1Ref, th2Ref]));
    const dataRow = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: tableElemRef });
    const dataRowRef = doc.context.register(dataRow);
    const td1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: dataRowRef });
    const td2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: dataRowRef });
    dataRow.set(PDFName.of('K'), doc.context.obj([doc.context.register(td1), doc.context.register(td2)]));
    tableElem.set(PDFName.of('K'), doc.context.obj([trRef, dataRowRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([tableElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'table-headers');
    expect(f).toBeDefined();
    expect(f.status).toBe('fail');
    expect(f.details.some(d => d.value && d.value.includes('missing /Scope'))).toBe(true);
  });

  it('should handle multiple tables with mixed TH coverage', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);

    // Table 1: good (TH with Scope)
    const table1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const table1Ref = doc.context.register(table1);
    const tr1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: table1Ref });
    const tr1Ref = doc.context.register(tr1);
    const attr1 = doc.context.obj({ O: PDFName.of('Table'), Scope: PDFName.of('Column') });
    const th1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TH'), P: tr1Ref, A: doc.context.register(attr1) });
    tr1.set(PDFName.of('K'), doc.context.obj([doc.context.register(th1)]));
    table1.set(PDFName.of('K'), doc.context.obj([tr1Ref]));

    // Table 2: bad (TD only)
    const table2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const table2Ref = doc.context.register(table2);
    const tr2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: table2Ref });
    const tr2Ref = doc.context.register(tr2);
    const td = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: tr2Ref });
    tr2.set(PDFName.of('K'), doc.context.obj([doc.context.register(td)]));
    table2.set(PDFName.of('K'), doc.context.obj([tr2Ref]));

    docElem.set(PDFName.of('K'), doc.context.obj([table1Ref, table2Ref]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'table-headers');
    expect(f).toBeDefined();
    expect(f.status).toBe('fail');
    expect(f.summary).toContain('1 of 2');
  });

  it('should handle table with nested THead/TBody structure', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const tableElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Table'), P: docElemRef });
    const tableElemRef = doc.context.register(tableElem);
    // THead > TR > TH (with Scope)
    const thead = doc.context.obj({ Type: 'StructElem', S: PDFName.of('THead'), P: tableElemRef });
    const theadRef = doc.context.register(thead);
    const headerRow = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: theadRef });
    const headerRowRef = doc.context.register(headerRow);
    const attr = doc.context.obj({ O: PDFName.of('Table'), Scope: PDFName.of('Column') });
    const th = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TH'), P: headerRowRef, A: doc.context.register(attr) });
    headerRow.set(PDFName.of('K'), doc.context.obj([doc.context.register(th)]));
    thead.set(PDFName.of('K'), doc.context.obj([headerRowRef]));
    // TBody > TR > TD
    const tbody = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TBody'), P: tableElemRef });
    const tbodyRef = doc.context.register(tbody);
    const dataRow = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TR'), P: tbodyRef });
    const dataRowRef = doc.context.register(dataRow);
    const td = doc.context.obj({ Type: 'StructElem', S: PDFName.of('TD'), P: dataRowRef });
    dataRow.set(PDFName.of('K'), doc.context.obj([doc.context.register(td)]));
    tbody.set(PDFName.of('K'), doc.context.obj([dataRowRef]));
    tableElem.set(PDFName.of('K'), doc.context.obj([theadRef, tbodyRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([tableElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkTables(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'table-headers');
    expect(f).toBeDefined();
    expect(f.status).toBe('pass');
  });
});
