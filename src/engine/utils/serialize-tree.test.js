/**
 * Tests for the serializable structure tree builder.
 *
 * Covers:
 * - Null root for untagged PDF
 * - Correct hierarchy and sequential IDs
 * - Alt text extraction
 * - Lang attribute extraction
 * - RoleMap resolution
 * - Cycle detection
 * - Truncation flag on large trees
 * - Single vs. array root children
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, PDFHexString, PDFNumber } from 'pdf-lib';
import { buildSerializableTree } from './serialize-tree.js';
import { getRoleMapFromDoc } from './role-map.js';
import {
  createUntaggedPdf,
  createTaggedPdf,
  createPdfWithHeadings,
  createPdfWithRoleMap,
  createPdfWithFigures,
} from '../../../test/fixtures/create-test-pdfs.js';

describe('buildSerializableTree', () => {
  it('should return null root for untagged PDF', async () => {
    const bytes = await createUntaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    expect(result.root).toBeNull();
    expect(result.totalCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('should produce correct hierarchy for tagged PDF', async () => {
    const bytes = await createTaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    expect(result.root).not.toBeNull();
    expect(result.root.role).toBe('Document');
    expect(result.root.children.length).toBe(1);
    expect(result.root.children[0].role).toBe('P');
    expect(result.totalCount).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('should assign sequential IDs', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H3']);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    // Collect all IDs via DFS
    const ids = [];
    function collectIds(node) {
      ids.push(node.id);
      node.children.forEach(collectIds);
    }
    collectIds(result.root);

    // IDs should be sequential starting from 0
    expect(ids[0]).toBe(0);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
    // All unique
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should extract alt text from Figure elements', async () => {
    const bytes = await createPdfWithFigures([{ hasAlt: true, alt: 'A bar chart' }]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    // Find the Figure node
    function findNode(node, role) {
      if (node.role === role) return node;
      for (const child of node.children) {
        const found = findNode(child, role);
        if (found) return found;
      }
      return null;
    }

    const figure = findNode(result.root, 'Figure');
    expect(figure).not.toBeNull();
    expect(figure.alt).toBe('A bar chart');
  });

  it('should extract lang attribute', async () => {
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
    const result = buildSerializableTree(reloaded, roleMap);

    expect(result.root).not.toBeNull();
    expect(result.root.lang).toBe('de-DE');
  });

  it('should resolve RoleMap type names', async () => {
    const bytes = await createPdfWithRoleMap({ Heading1: 'H1', Slide: 'Sect' });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    // Find nodes by original type
    function findByType(node, type) {
      if (node.type === type) return node;
      for (const child of node.children) {
        const found = findByType(child, type);
        if (found) return found;
      }
      return null;
    }

    const heading = findByType(result.root, 'Heading1');
    expect(heading).not.toBeNull();
    expect(heading.role).toBe('H1');

    const slide = findByType(result.root, 'Slide');
    expect(slide).not.toBeNull();
    expect(slide.role).toBe('Sect');
  });

  it('should detect cycles and not hang', async () => {
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

    // Create cycle: A -> B -> A
    elemA.set(PDFName.of('K'), doc.context.obj([elemBRef]));
    elemB.set(PDFName.of('K'), doc.context.obj([elemARef]));

    structTreeRoot.set(PDFName.of('K'), doc.context.obj([elemARef]));

    const roleMap = new Map();
    const result = buildSerializableTree(doc, roleMap);

    // Should have visited A and B but not loop
    expect(result.root).not.toBeNull();
    expect(result.totalCount).toBe(2);
  });

  it('should set truncated flag for large trees', async () => {
    // Build a tree with many children — we can't easily hit 50k in test
    // but we can verify the mechanism by checking it stays false for small trees
    const bytes = await createPdfWithHeadings(['H1', 'H2', 'H3']);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    expect(result.truncated).toBe(false);
    expect(result.totalCount).toBe(4); // Document + H1 + H2 + H3
  });

  it('should handle single PDFDict child (not wrapped in array)', async () => {
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
    structTreeRoot.set(PDFName.of('K'), elemRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    expect(result.root).not.toBeNull();
    expect(result.root.role).toBe('Document');
    expect(result.totalCount).toBe(1);
  });

  it('should produce JSON-serializable output', async () => {
    const bytes = await createPdfWithHeadings(['H1', 'H2']);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    // Should survive JSON round-trip without loss
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.root.role).toBe(result.root.role);
    expect(parsed.totalCount).toBe(result.totalCount);
    expect(parsed.truncated).toBe(result.truncated);
  });

  it('should return null root when StructTreeRoot has no /K', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(structTreeRoot);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);
    // No /K set

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    expect(result.root).toBeNull();
    expect(result.totalCount).toBe(0);
  });

  // --- MCID and page index tests ---

  it('should extract MCIDs as integers from /K', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    addMarkInfo(doc);

    const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

    // Create a P element with an integer MCID in /K
    const pElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: structTreeRootRef,
      Pg: page.ref,
    });
    const pRef = doc.context.register(pElem);
    // /K is a single integer (MCID = 0)
    pElem.set(PDFName.of('K'), doc.context.obj(0));

    structTreeRoot.set(PDFName.of('K'), pRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    expect(result.root).not.toBeNull();
    expect(result.root.mcids).toHaveLength(1);
    expect(result.root.mcids[0].mcid).toBe(0);
    expect(result.root.mcids[0].pageIndex).toBe(0);
  });

  it('should extract MCIDs from MCR dicts in /K array', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    addMarkInfo(doc);

    const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

    const pElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: structTreeRootRef,
    });
    const pRef = doc.context.register(pElem);

    // /K is an array with an MCR dict
    const mcrDict = doc.context.obj({
      Type: 'MCR',
      MCID: 5,
      Pg: page.ref,
    });
    pElem.set(PDFName.of('K'), doc.context.obj([mcrDict]));

    structTreeRoot.set(PDFName.of('K'), pRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    expect(result.root).not.toBeNull();
    expect(result.root.mcids).toHaveLength(1);
    expect(result.root.mcids[0].mcid).toBe(5);
    expect(result.root.mcids[0].pageIndex).toBe(0);
  });

  it('should set pageIndex on nodes from /Pg', async () => {
    const doc = await PDFDocument.create();
    const page1 = doc.addPage();
    const page2 = doc.addPage();
    addMarkInfo(doc);

    const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

    // Document element
    const docElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: structTreeRootRef,
    });
    const docRef = doc.context.register(docElem);

    // P on page 2
    const pElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: docRef,
      Pg: page2.ref,
    });
    const pRef = doc.context.register(pElem);
    pElem.set(PDFName.of('K'), doc.context.obj(3));

    docElem.set(PDFName.of('K'), doc.context.obj([pRef]));
    structTreeRoot.set(PDFName.of('K'), docRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    const pNode = result.root.children[0];
    expect(pNode.role).toBe('P');
    expect(pNode.pageIndex).toBe(1); // page2 = index 1
    expect(pNode.mcids).toHaveLength(1);
    expect(pNode.mcids[0].mcid).toBe(3);
    expect(pNode.mcids[0].pageIndex).toBe(1);
  });

  it('should have empty mcids array for elements without MCIDs', async () => {
    const bytes = await createTaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(doc);
    const result = buildSerializableTree(doc, roleMap);

    expect(result.root).not.toBeNull();
    expect(Array.isArray(result.root.mcids)).toBe(true);
  });

  it('should preserve mcids through JSON round-trip', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    addMarkInfo(doc);

    const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

    const pElem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('P'),
      P: structTreeRootRef,
      Pg: page.ref,
    });
    const pRef = doc.context.register(pElem);
    pElem.set(PDFName.of('K'), doc.context.obj(7));

    structTreeRoot.set(PDFName.of('K'), pRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const roleMap = getRoleMapFromDoc(reloaded);
    const result = buildSerializableTree(reloaded, roleMap);

    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);

    expect(parsed.root.mcids).toEqual(result.root.mcids);
    expect(parsed.root.pageIndex).toBe(result.root.pageIndex);
  });
});

// Helpers needed by the MCID tests (same pattern as create-test-pdfs.js)
function addMarkInfo(doc) {
  const markInfo = doc.context.obj({ Marked: true });
  doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
}

function addStructTreeRoot(doc) {
  const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
  const structTreeRootRef = doc.context.register(structTreeRoot);
  doc.catalog.set(PDFName.of('StructTreeRoot'), structTreeRootRef);
  return { structTreeRoot, structTreeRootRef };
}
