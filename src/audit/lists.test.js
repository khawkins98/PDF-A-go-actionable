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

  it('should warn (not fail) when LI has LBody but no Lbl (Lbl optional)', async () => {
    const bytes = await createPdfWithListNoLbl();
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    expect(listFinding.status).toBe('warning');
    expect(listFinding.summary).toContain('issue');
  });

  it('should fail when LBody is missing (structural issue), not just Lbl', async () => {
    const bytes = await createPdfWithList({ hasLBody: false });
    const ctx = await buildTestContext(bytes);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const listFinding = findings.find(f => f.id === 'list-structure');
    expect(listFinding).toBeDefined();
    // Missing LBody is a structural issue → fail (not just warning)
    expect(listFinding.status).toBe('fail');
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

  it('should pass when list has nested L within LBody', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    // Outer list
    const outerList = doc.context.obj({ Type: 'StructElem', S: PDFName.of('L'), P: docElemRef });
    const outerListRef = doc.context.register(outerList);
    const li = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LI'), P: outerListRef });
    const liRef = doc.context.register(li);
    const lbl = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Lbl'), P: liRef });
    const lblRef = doc.context.register(lbl);
    const lbody = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LBody'), P: liRef });
    const lbodyRef = doc.context.register(lbody);
    // Nested list inside LBody
    const innerList = doc.context.obj({ Type: 'StructElem', S: PDFName.of('L'), P: lbodyRef });
    const innerListRef = doc.context.register(innerList);
    const innerLi = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LI'), P: innerListRef });
    const innerLiRef = doc.context.register(innerLi);
    const innerLbl = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Lbl'), P: innerLiRef });
    const innerLblRef = doc.context.register(innerLbl);
    const innerLbody = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LBody'), P: innerLiRef });
    const innerLbodyRef = doc.context.register(innerLbody);
    innerLi.set(PDFName.of('K'), doc.context.obj([innerLblRef, innerLbodyRef]));
    innerList.set(PDFName.of('K'), doc.context.obj([innerLiRef]));
    lbody.set(PDFName.of('K'), doc.context.obj([innerListRef]));
    li.set(PDFName.of('K'), doc.context.obj([lblRef, lbodyRef]));
    outerList.set(PDFName.of('K'), doc.context.obj([liRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([outerListRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);
    // Both outer and inner lists should pass (nested L within LBody is valid)
    const f = findings.find(f => f.id === 'list-structure');
    expect(f).toBeDefined();
    // The outer list passes. The inner list is a separate L found by flat scan.
    expect(f.status).toBe('pass');
  });

  it('should fail with unexpected child type inside L (e.g., Div instead of LI)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const listElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('L'), P: docElemRef });
    const listElemRef = doc.context.register(listElem);
    // Add a Div directly as child of L (invalid — should be LI)
    const divElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Div'), P: listElemRef });
    const divElemRef = doc.context.register(divElem);
    listElem.set(PDFName.of('K'), doc.context.obj([divElemRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([listElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'list-structure');
    expect(f).toBeDefined();
    expect(f.status).toBe('fail');
    expect(f.details.some(d => d.value && d.value.includes('Unexpected child type'))).toBe(true);
  });

  // --- Page numbers in list details ---

  it('should include page numbers in list detail values when /Pg is present', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const page2Ref = doc.getPages()[1].ref;

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);

    // List on page 2 with LI missing LBody (fail)
    const listElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('L'), P: docElemRef, Pg: page2Ref });
    const listElemRef = doc.context.register(listElem);
    const liElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LI'), P: listElemRef });
    const liElemRef = doc.context.register(liElem);
    const lblElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Lbl'), P: liElemRef });
    const lblElemRef = doc.context.register(lblElem);
    // No LBody — structural fail
    liElem.set(PDFName.of('K'), doc.context.obj([lblElemRef]));
    listElem.set(PDFName.of('K'), doc.context.obj([liElemRef]));
    docElem.set(PDFName.of('K'), doc.context.obj([listElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);

    const f = findings.find(f => f.id === 'list-structure');
    expect(f).toBeDefined();
    expect(f.status).toBe('fail');
    // Detail should show "Page 2:" prefix
    const detailWithPage = f.details.find(d => d.value && d.value.includes('Page 2'));
    expect(detailWithPage).toBeDefined();
  });

  it('should report which LIs are broken in mixed valid/invalid list', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    const listElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('L'), P: docElemRef });
    const listElemRef = doc.context.register(listElem);
    // LI 1: valid (Lbl + LBody)
    const li1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LI'), P: listElemRef });
    const li1Ref = doc.context.register(li1);
    const lbl1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Lbl'), P: li1Ref });
    const lbody1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LBody'), P: li1Ref });
    li1.set(PDFName.of('K'), doc.context.obj([doc.context.register(lbl1), doc.context.register(lbody1)]));
    // LI 2: invalid (missing Lbl)
    const li2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LI'), P: listElemRef });
    const li2Ref = doc.context.register(li2);
    const lbody2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('LBody'), P: li2Ref });
    li2.set(PDFName.of('K'), doc.context.obj([doc.context.register(lbody2)]));
    listElem.set(PDFName.of('K'), doc.context.obj([li1Ref, li2Ref]));
    docElem.set(PDFName.of('K'), doc.context.obj([listElemRef]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));
    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkLists(ctx.pdfDoc, ctx);
    const f = findings.find(f => f.id === 'list-structure');
    expect(f).toBeDefined();
    expect(f.status).toBe('warning');
    // Should identify which LI is missing Lbl (LI 2)
    expect(f.details.some(d => d.label && d.label.includes('LI 2') && d.value && d.value.includes('Missing Lbl'))).toBe(true);
  });
});
