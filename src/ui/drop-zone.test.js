// @vitest-environment happy-dom
/**
 * Tests for the file upload component.
 *
 * Covers:
 * - createUploadZone returns a properly structured element
 * - filterPdfs utility
 * - Accessibility attributes
 */
import { describe, it, expect, vi } from 'vitest';
import { createUploadZone, filterPdfs } from './drop-zone.js';

describe('createUploadZone', () => {
  it('should return a div with drop-zone class', () => {
    const zone = createUploadZone(() => {});
    expect(zone.tagName).toBe('DIV');
    expect(zone.className).toBe('drop-zone');
  });

  it('should contain a hidden file input', () => {
    const zone = createUploadZone(() => {});
    const input = zone.querySelector('input[type="file"]');
    expect(input).toBeDefined();
    expect(input.accept).toContain('.pdf');
    expect(input.multiple).toBe(true);
  });

  it('should have drop zone title and subtitle text', () => {
    const zone = createUploadZone(() => {});
    expect(zone.textContent).toContain('Drop PDF');
    expect(zone.textContent).toContain('click to browse');
  });

  it('should have aria-label for accessibility', () => {
    const zone = createUploadZone(() => {});
    expect(zone.getAttribute('aria-label')).toBe('PDF file upload area');
  });

  it('should have role="region"', () => {
    const zone = createUploadZone(() => {});
    expect(zone.getAttribute('role')).toBe('region');
  });

  it('should be focusable via tabindex', () => {
    const zone = createUploadZone(() => {});
    expect(zone.getAttribute('tabindex')).toBe('0');
  });

  it('should have aria-label on the file input', () => {
    const zone = createUploadZone(() => {});
    const input = zone.querySelector('input[type="file"]');
    expect(input.getAttribute('aria-label')).toBe('Choose PDF files');
  });
});

describe('filterPdfs', () => {
  function makeFileList(files) {
    // Mimic a FileList — an array-like with File-like objects
    return files;
  }

  it('should keep files with application/pdf type', () => {
    const files = makeFileList([
      { name: 'report.pdf', type: 'application/pdf' },
      { name: 'image.png', type: 'image/png' },
    ]);

    const result = filterPdfs(files);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('report.pdf');
  });

  it('should keep files with .pdf extension regardless of type', () => {
    const files = makeFileList([
      { name: 'document.pdf', type: '' },
      { name: 'image.png', type: 'image/png' },
    ]);

    const result = filterPdfs(files);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('document.pdf');
  });

  it('should be case-insensitive on extension', () => {
    const files = makeFileList([
      { name: 'REPORT.PDF', type: '' },
    ]);

    const result = filterPdfs(files);
    expect(result).toHaveLength(1);
  });

  it('should return empty array for non-PDF files', () => {
    const files = makeFileList([
      { name: 'image.png', type: 'image/png' },
      { name: 'doc.docx', type: 'application/vnd.openxmlformats' },
    ]);

    const result = filterPdfs(files);
    expect(result).toHaveLength(0);
  });

  it('should handle empty file list', () => {
    const result = filterPdfs([]);
    expect(result).toHaveLength(0);
  });

  it('should keep multiple PDFs', () => {
    const files = makeFileList([
      { name: 'a.pdf', type: 'application/pdf' },
      { name: 'b.pdf', type: 'application/pdf' },
      { name: 'c.txt', type: 'text/plain' },
    ]);

    const result = filterPdfs(files);
    expect(result).toHaveLength(2);
  });
});
