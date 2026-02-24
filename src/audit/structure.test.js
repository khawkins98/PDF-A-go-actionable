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

  it('should fail heading hierarchy when levels are skipped (H1 -> H3)', async () => {
    const bytes = await createPdfWithHeadingSkip();
    const ctx = await buildTestContext(bytes);
    const findings = checkStructure(ctx.pdfDoc, ctx);

    const headingFinding = findings.find(f => f.id === 'heading-hierarchy');
    expect(headingFinding).toBeDefined();
    expect(headingFinding.status).toBe('fail');
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
});
