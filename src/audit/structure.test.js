/**
 * Tests for the structure audit module.
 *
 * Covers:
 * - Tagged / untagged detection
 * - Structure tree present / absent
 * - Heading hierarchy: correct order, skip, no headings
 */
import { describe, it, expect } from 'vitest';
import { checkStructure } from './structure.js';
import { buildTestContext } from '../../test/helpers/context.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithHeadings,
  createPdfWithHeadingSkip,
  createPdfWithRoleMap,
  createPdfWithSuspects,
} from '../../test/fixtures/create-test-pdfs.js';

describe('checkStructure', () => {
  it('should fail when PDF is not tagged', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const taggedFinding = findings.find(f => f.id === 'tagged-pdf');
    expect(taggedFinding).toBeDefined();
    expect(taggedFinding.status).toBe('fail');
  });

  it('should pass when PDF is tagged', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const taggedFinding = findings.find(f => f.id === 'tagged-pdf');
    expect(taggedFinding).toBeDefined();
    expect(taggedFinding.status).toBe('pass');
  });

  it('should fail when PDF is tagged but has Suspects flag', async () => {
    const bytes = await createPdfWithSuspects();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const taggedFinding = findings.find(f => f.id === 'tagged-pdf');
    expect(taggedFinding).toBeDefined();
    expect(taggedFinding.status).toBe('fail');
    expect(taggedFinding.summary).toContain('Suspects');
    expect(taggedFinding.remediation).toBeTruthy();
  });

  it('should fail when structure tree is absent', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const structFinding = findings.find(f => f.id === 'structure-tree');
    expect(structFinding).toBeDefined();
    expect(structFinding.status).toBe('fail');
  });

  it('should pass when structure tree is present', async () => {
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const structFinding = findings.find(f => f.id === 'structure-tree');
    expect(structFinding).toBeDefined();
    expect(structFinding.status).toBe('pass');
  });

  it('should pass heading hierarchy with correct order (H1, H2, H3)', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H3']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
    expect(headingFinding.summary).toContain('3 headings');
  });

  it('should warn when heading levels are skipped (H1 -> H3)', async () => {
    const bytes = await createPdfWithHeadingSkip();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('warning');
    expect(headingFinding.summary).toContain('H2');
  });

  it('should report not-applicable for headings when no structure tree', async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('not-applicable');
  });

  it('should warn when no headings found in a tagged PDF', async () => {
    // createTaggedPdf has Document > P, but no headings
    const bytes = await createTaggedPdf();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('warning');
    expect(headingFinding.summary).toContain('No headings');
  });

  it('should produce a structure summary for tagged PDFs', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const summaryFinding = findings.find(f => f.id === 'structure-summary');
    expect(summaryFinding).toBeDefined();
    expect(summaryFinding.status).toBe('pass');
    expect(summaryFinding.summary).toContain('elements');
  });

  // --- Heading edge cases ---

  it('should warn (not fail) when headings start at H2 (no H1, no skips)', async () => {
    const bytes = await createPdfWithHeadings(['H2', 'H3']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('warning');
    expect(headingFinding.summary).toContain('H2');
    expect(headingFinding.summary).toContain('instead of H1');
  });

  it('should pass with a single H1 only', async () => {
    const bytes = await createPdfWithHeadings(['H1']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
    expect(headingFinding.summary).toContain('1 heading');
  });

  it('should pass with deep heading nesting H1 through H6', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
    expect(headingFinding.summary).toContain('6 headings');
  });

  it('should pass with multiple headings of same level in sequence', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H2', 'H3']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
  });

  it('should warn when heading skips after decrease (H1 -> H2 -> H1 -> H3)', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H1', 'H3']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('warning');
    expect(headingFinding.summary).toContain('H2');
  });

  it('should treat generic H as a heading (level 0) and skip gap detection', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H', 'H3']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    // H -> H3 should not trigger a skip (H is generic, level 0)
    expect(headingFinding.status).toBe('pass');
    expect(headingFinding.summary).toContain('3 headings');
  });

  it('should pass with only generic H headings', async () => {
    const bytes = await createPdfWithHeadings(['H']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
  });

  it('should warn when real heading levels skip (H1 -> H3) regardless of H present', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H', 'H3', 'H5']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('warning');
  });

  it('should use WCAG 2.4.6 reference for heading-hierarchy findings', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2']);
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding.wcagRef).toBe('2.4.6');
  });

  it('should resolve custom heading types via RoleMap', async () => {
    const bytes = await createPdfWithRoleMap({ Heading1: 'H1', Heading2: 'H2' });
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
    expect(headingFinding.summary).toContain('2 headings');
  });

  // --- Page numbers in heading details ---

  it('should include page numbers in heading detail values when /Pg is present', async () => {
    const { PDFDocument, PDFName } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page1 = doc.addPage();
    const page2 = doc.addPage();
    const page1Ref = doc.getPages()[0].ref;
    const page2Ref = doc.getPages()[1].ref;

    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    const docElem = doc.context.obj({ Type: 'StructElem', S: PDFName.of('Document'), P: strRef });
    const docElemRef = doc.context.register(docElem);
    // H1 on page 1
    const h1 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('H1'), P: docElemRef, Pg: page1Ref });
    const h1Ref = doc.context.register(h1);
    // H2 on page 2
    const h2 = doc.context.obj({ Type: 'StructElem', S: PDFName.of('H2'), P: docElemRef, Pg: page2Ref });
    const h2Ref = doc.context.register(h2);
    docElem.set(PDFName.of('K'), doc.context.obj([h1Ref, h2Ref]));
    structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

    const saved = await doc.save();
    const ctx = await buildTestContext(saved);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('pass');
    // Heading on page 1 should show "Page 1: H1"
    const page1Detail = headingFinding.details.find(d => d.value && d.value.includes('Page 1'));
    expect(page1Detail).toBeDefined();
    // Heading on page 2 should show "Page 2: H2"
    const page2Detail = headingFinding.details.find(d => d.value && d.value.includes('Page 2'));
    expect(page2Detail).toBeDefined();
  });
});
