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
import { PDFDocument, PDFName } from 'pdf-lib';

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

  it('should detect custom list type via RoleMap (e.g., "ItemList" → "L")', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const roleMap = doc.context.obj({ ItemList: PDFName.of('L') });
    structTreeRoot.set(PDFName.of('RoleMap'), roleMap);

    const docElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const docElemRef = doc.context.register(docElem);

    // "ItemList" custom type → should be detected as L via RoleMap
    const listElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('ItemList'),
      P: docElemRef,
    });
    const listElemRef = doc.context.register(listElem);

    // LI > Lbl + LBody (proper structure)
    const liElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('LI'),
      P: listElemRef,
    });
    const liElemRef = doc.context.register(liElem);

    const lblElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Lbl'),
      P: liElemRef,
    });
    const lblElemRef = doc.context.register(lblElem);

    const lbodyElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('LBody'),
      P: liElemRef,
    });
    const lbodyElemRef = doc.context.register(lbodyElem);

    liElem.set(PDFName.of('K'), doc.context.obj([lblElemRef, lbodyElemRef]));
    listElem.set(PDFName.of('K'), doc.context.obj([liElemRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([listElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('pass');
  });

  it('should fail when LI has no children (empty LI)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const docElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const docElemRef = doc.context.register(docElem);

    const listElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('L'),
      P: docElemRef,
    });
    const listElemRef = doc.context.register(listElem);

    // LI with NO children (empty)
    const liElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('LI'),
      P: listElemRef,
    });
    const liElemRef = doc.context.register(liElem);
    // No /K set — empty LI

    listElem.set(PDFName.of('K'), doc.context.obj([liElemRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([listElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('fail');
  });
});
