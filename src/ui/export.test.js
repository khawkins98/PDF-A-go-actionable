/**
 * Tests for the export module.
 *
 * Covers:
 * - escapeCsvField: quoting, escaping, null handling
 * - buildFilename: strips .pdf, appends report suffix
 * - initExport: returns three export functions
 */
import { describe, it, expect } from 'vitest';
import { escapeCsvField, buildFilename, initExport } from './export.js';

describe('escapeCsvField', () => {
  it('should return a plain string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('should wrap values containing commas in quotes', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('should escape double quotes by doubling them', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('should wrap values containing newlines in quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('should wrap values containing carriage returns in quotes', () => {
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
  });

  it('should return empty quoted string for null', () => {
    expect(escapeCsvField(null)).toBe('""');
  });

  it('should return empty quoted string for undefined', () => {
    expect(escapeCsvField(undefined)).toBe('""');
  });

  it('should handle values with both commas and quotes', () => {
    expect(escapeCsvField('he said, "hello"')).toBe('"he said, ""hello"""');
  });

  it('should convert non-string values to strings', () => {
    expect(escapeCsvField(42)).toBe('42');
  });
});

describe('buildFilename', () => {
  it('should strip .pdf extension and append report suffix', () => {
    expect(buildFilename({ fileName: 'report.pdf' }, 'json')).toBe(
      'report-accessibility-report.json'
    );
  });

  it('should strip .PDF extension case-insensitively', () => {
    expect(buildFilename({ fileName: 'REPORT.PDF' }, 'csv')).toBe(
      'REPORT-accessibility-report.csv'
    );
  });

  it('should use default name when fileName is missing', () => {
    expect(buildFilename({}, 'json')).toBe(
      'accessibility-report-accessibility-report.json'
    );
  });

  it('should handle filenames without .pdf extension', () => {
    expect(buildFilename({ fileName: 'my-document' }, 'pdf')).toBe(
      'my-document-accessibility-report.pdf'
    );
  });
});

describe('initExport', () => {
  it('should return an object with three export functions', () => {
    const data = { findings: [], meta: {} };
    const exports = initExport(data);

    expect(typeof exports.exportJSON).toBe('function');
    expect(typeof exports.exportCSV).toBe('function');
    expect(typeof exports.exportPDF).toBe('function');
  });
});
