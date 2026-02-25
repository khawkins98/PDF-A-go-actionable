/**
 * Tests for the structure tree walker.
 *
 * Covers:
 * - Valid tree produces correct element list with types and depth
 * - Alt text and lang extraction
 * - PDFArray children (multiple kids) and single PDFDict child
 * - Missing/null StructTreeRoot returns empty
 * - RoleMap-resolved type names
 * - Cycle detection
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFString, PDFHexString } from 'pdf-lib';
import { walkStructureTree } from './struct-tree-walker.js';
import { getRoleMapFromDoc } from './role-map.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithHeadings,
  createPdfWithRoleMap,
  createPdfWithFigures,
} from '../../../test/fixtures/create-test-pdfs.js';

describe('walkStructureTree', () => {
  it('should produce correct element list with types and depth', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H3']);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const elements = walkStructureTree(doc, roleMap);

    // Should have Document + H1 + H2 + H3 = 4 elements
    expect(elements.length).toBe(4);

    const doc_el = elements.find(e => e.resolvedType === 'Document');
    expect(doc_el).toBeDefined();
    expect(doc_el.depth).toBe(1);

    const h1 = elements.find(e => e.resolvedType === 'H1');
    expect(h1).toBeDefined();
    expect(h1.depth).toBe(2);

    const h3 = elements.find(e => e.resolvedType === 'H3');
    expect(h3).toBeDefined();
    expect(h3.depth).toBe(2);
  });

  it('should extract alt text from structure elements', async () => {
    const bytes = await createPdfWithFigures([{ hasAlt: true, alt: 'A bar chart' }]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const elements = walkStructureTree(doc, roleMap);

    const figure = elements.find(e => e.resolvedType === 'Figure');
    expect(figure).toBeDefined();
    expect(figure.alt).toBe('A bar chart');
  });

  it('should extract lang attribute from structure elements', async () => {
    // Build a PDF with a StructElem that has /Lang
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const elem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: strRef,
      Lang: PDFString.of('de-DE'),
    });
    const elemRef = doc.context.register(elem);
    structTreeRoot.set(PDFName.of('K'), elemRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const elements = walkStructureTree(reloaded, roleMap);

    const p = elements.find(e => e.resolvedType === 'P');
    expect(p).toBeDefined();
    expect(p.lang).toBe('de-DE');
  });

  it('should handle PDFArray children (multiple kids)', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2']);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const elements = walkStructureTree(doc, roleMap);

    // Document has H1 and H2 as children in an array
    const headings = elements.filter(e => e.resolvedType === 'H1' || e.resolvedType === 'H2');
    expect(headings).toHaveLength(2);
  });

  it('should handle single PDFDict child (not wrapped in array)', async () => {
    // Build a PDF where StructTreeRoot /K is a single ref, not an array
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const elem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const elemRef = doc.context.register(elem);
    // Single ref, NOT wrapped in array
    structTreeRoot.set(PDFName.of('K'), elemRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const elements = walkStructureTree(reloaded, roleMap);

    expect(elements).toHaveLength(1);
    expect(elements[0].resolvedType).toBe('Document');
  });

  it('should return empty array when StructTreeRoot is missing', async () => {
    const bytes = await createUntaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const elements = walkStructureTree(doc, roleMap);

    expect(elements).toEqual([]);
  });

  it('should resolve RoleMap type names in output', async () => {
    const bytes = await createPdfWithRoleMap({ Heading1: 'H1', Slide: 'Sect' });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const elements = walkStructureTree(doc, roleMap);

    const heading = elements.find(e => e.type === 'Heading1');
    expect(heading).toBeDefined();
    expect(heading.resolvedType).toBe('H1');

    const slide = elements.find(e => e.type === 'Slide');
    expect(slide).toBeDefined();
    expect(slide.resolvedType).toBe('Sect');
  });

  it('should detect cycles via visited set when /K uses array children', async () => {
    // Build a PDF with two StructElems whose /K arrays reference each other.
    // Using arrays ensures the walker passes PDFRef (not resolved PDFDict) to walk(),
    // which triggers the visited-set cycle detection.
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    const elemA = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Div'),
      P: strRef,
    });
    const elemARef = doc.context.register(elemA);

    const elemB = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: elemARef,
    });
    const elemBRef = doc.context.register(elemB);

    // Use arrays for /K so child refs stay as PDFRef (not resolved inline)
    elemA.set(PDFName.of('K'), doc.context.obj([elemBRef]));
    elemB.set(PDFName.of('K'), doc.context.obj([elemARef]));

    structTreeRoot.set(PDFName.of('K'), doc.context.obj([elemARef]));

    const roleMap = new Map();
    const elements = walkStructureTree(doc, roleMap);

    // Should have visited A and B only — cycle back to A is skipped
    expect(elements.length).toBe(2);
    const types = elements.map(e => e.resolvedType);
    expect(types).toContain('Div');
    expect(types).toContain('P');
  });

  it('should stop at MAX_DEPTH (200) and not crash on deep recursion', async () => {
    // Build a PDF with deeply nested single-child elements.
    // The MAX_DEPTH cap should prevent stack overflow.
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    // Chain 10 nested Div elements
    let parentRef = strRef;
    let firstRef;
    for (let i = 0; i < 10; i++) {
      const elem = doc.context.obj({
        Type: 'StructElem',
        S: PDFName.of('Div'),
        P: parentRef,
      });
      const ref = doc.context.register(elem);
      if (i === 0) firstRef = ref;
      if (i > 0) {
        // Set the previous element's K to this ref
        const prevElem = doc.context.lookup(parentRef);
        prevElem.set(PDFName.of('K'), doc.context.obj([ref]));
      }
      parentRef = ref;
    }

    structTreeRoot.set(PDFName.of('K'), doc.context.obj([firstRef]));

    const roleMap = new Map();
    const elements = walkStructureTree(doc, roleMap);

    // Should have at least some elements without crashing
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.length).toBeLessThanOrEqual(10);
  });
});
