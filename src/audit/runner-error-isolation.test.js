/**
 * Tests for runner error isolation — verifying that individual module
 * errors produce warning findings rather than crashing the audit.
 *
 * Uses vi.mock to inject errors into specific audit modules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaggedPdf, createUntaggedPdf } from '../../test/fixtures/create-test-pdfs.js';

// Mock checkImages to throw an error
vi.mock('./images.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    checkImages: vi.fn().mockImplementation(() => {
      throw new Error('Simulated images module crash');
    }),
  };
});

const { runAudit } = await import('./runner.js');

describe('runner error isolation', () => {
  it('should produce warning finding when a module throws', async () => {
    const bytes = await createTaggedPdf();
    const result = await runAudit(bytes.buffer, { fileName: 'test.pdf' });

    // Should have an images-error finding
    const errorFinding = result.findings.find(f => f.id === 'images-error');
    expect(errorFinding).toBeDefined();
    expect(errorFinding.status).toBe('warning');
    expect(errorFinding.category).toBe('images');
    expect(errorFinding.summary).toContain('Simulated images module crash');
    expect(errorFinding.remediation).toBeTruthy();
  });

  it('should still include findings from other modules when one fails', async () => {
    const bytes = await createTaggedPdf();
    const result = await runAudit(bytes.buffer, { fileName: 'test.pdf' });

    // Images module is mocked to throw, but other modules should still produce findings
    const categories = new Set(result.findings.map(f => f.category));
    expect(categories.has('metadata')).toBe(true);
    expect(categories.has('structure')).toBe(true);
    expect(categories.has('fonts')).toBe(true);
    expect(categories.has('reading-order')).toBe(true);
  });

  it('should return valid meta even when a module throws', async () => {
    const bytes = await createTaggedPdf();
    const result = await runAudit(bytes.buffer, { fileName: 'test.pdf' });

    expect(result.meta).toBeDefined();
    expect(result.meta.fileName).toBe('test.pdf');
    expect(result.meta.pageCount).toBeGreaterThan(0);
    expect(result.meta.fileSize).toBeGreaterThan(0);
  });

  it('should still build structureTree when a non-structure module throws', async () => {
    const bytes = await createTaggedPdf();
    const result = await runAudit(bytes.buffer, { fileName: 'test.pdf' });

    // Images module crashed but structure tree should still be built
    expect(result.structureTree).not.toBeNull();
  });

  it('should handle corrupt PDF data gracefully', async () => {
    // Pure garbage bytes — both load attempts should fail
    const garbage = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01]).buffer;
    const result = await runAudit(garbage, { fileName: 'corrupt.pdf' });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe('load-failure');
    expect(result.findings[0].status).toBe('fail');
    expect(result.meta.pageCount).toBe(0);
  });

  it('should handle PDF with cycling structure tree gracefully', async () => {
    // Build a PDF where a StructElem's /K points back to itself
    const { PDFDocument, PDFName, PDFString } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.catalog.set(PDFName.of('Lang'), PDFString.of('en-US'));

    // MarkInfo
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of('MarkInfo'), markInfo);

    // StructTreeRoot
    const str = doc.context.obj({ Type: 'StructTreeRoot' });
    const strRef = doc.context.register(str);
    doc.catalog.set(PDFName.of('StructTreeRoot'), strRef);

    // StructElem that references itself via /K
    const elem = doc.context.obj({
      Type: 'StructElem',
      S: PDFName.of('Document'),
      P: strRef,
    });
    const elemRef = doc.context.register(elem);
    // Cycle: elem's /K points back to itself
    elem.set(PDFName.of('K'), doc.context.obj([elemRef]));
    str.set(PDFName.of('K'), doc.context.obj([elemRef]));

    const saved = await doc.save();
    const result = await runAudit(saved.buffer, { fileName: 'cyclic.pdf' });

    // Should NOT crash, should have findings from all modules
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.meta).toBeDefined();
    expect(result.meta.fileName).toBe('cyclic.pdf');
    // structureTree may be truncated or null, but should not throw
    // (the serialize-tree.js visited set prevents infinite loops)
  });

  it('should handle PDF with malformed XMP metadata without crashing', async () => {
    const { PDFDocument, PDFName, PDFRawStream } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage();

    // Create a malformed metadata stream (not valid XML)
    const malformedXmp = new TextEncoder().encode('<<<NOT VALID XMP>>>');
    const metaStream = PDFRawStream.of(
      doc.context.obj({
        Type: 'Metadata',
        Subtype: PDFName.of('XML'),
        Length: malformedXmp.length,
      }),
      malformedXmp,
    );
    const metaRef = doc.context.register(metaStream);
    doc.catalog.set(PDFName.of('Metadata'), metaRef);

    const saved = await doc.save();
    const result = await runAudit(saved.buffer, { fileName: 'malformed-xmp.pdf' });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.meta).toBeDefined();
    expect(result.meta.fileName).toBe('malformed-xmp.pdf');
    // Should not detect PDF/A or PDF/UA from malformed metadata
    expect(result.meta.isPdfA).toBe(false);
    expect(result.meta.isPdfUA).toBe(false);
  });
});
