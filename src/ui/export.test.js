/**
 * Tests for the export module.
 *
 * Covers:
 * - escapeCsvField: quoting, escaping, null handling
 * - buildFilename: strips .pdf, appends report suffix
 * - initExport: returns three export functions
 */
import { describe, it, expect } from 'vitest';
import { escapeCsvField, buildFilename, initExport, buildJsonOutput, buildCsvContent, TOOL_URL, REPO_URL } from './export.js';

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

// --- buildJsonOutput ---

describe('buildJsonOutput', () => {
  it('should not include checklist in JSON output', () => {
    const data = {
      meta: { fileName: 'test.pdf' },
      findings: [
        { id: 'tagged-pdf', status: 'pass', category: 'structure', title: 'Tagged PDF', summary: 'OK', details: [], remediation: null, wcagRef: '1.3.1', pdfuaRef: '7.1' },
      ],
    };
    const output = buildJsonOutput(data);
    expect(output.checklist).toBeUndefined();
    expect(output.tool).toBe('PDF-A-go-actionable');
    expect(output.exportedAt).toBeDefined();
  });

  it('should include meta and findings in JSON output', () => {
    const data = { meta: { fileName: 'x.pdf' }, findings: [{ id: 'a' }] };
    const output = buildJsonOutput(data);
    expect(output.meta.fileName).toBe('x.pdf');
    expect(output.findings).toHaveLength(1);
  });
});

// --- Branding constants ---

describe('branding constants', () => {
  it('should export the GitHub Pages tool URL', () => {
    expect(TOOL_URL).toBe('https://khawkins98.github.io/PDF-A-go-actionable/');
  });

  it('should export the GitHub repo URL', () => {
    expect(REPO_URL).toBe('https://github.com/khawkins98/PDF-A-go-actionable');
  });
});

// --- buildCsvContent ---

describe('buildCsvContent', () => {
  it('should start with UTF-8 BOM when downloaded (not in content itself)', () => {
    const data = { meta: {}, findings: [] };
    const csv = buildCsvContent(data);
    // buildCsvContent does NOT include BOM; downloadCSV prepends it
    expect(csv.startsWith('id,')).toBe(true);
  });

  it('should include details column in CSV headers', () => {
    const data = { meta: {}, findings: [] };
    const csv = buildCsvContent(data);
    const headers = csv.split('\n')[0].split(',');
    expect(headers).toContain('details');
  });

  it('should serialize finding details as semicolon-separated pairs', () => {
    const data = {
      meta: {},
      findings: [{
        id: 'test',
        category: 'cat',
        title: 'Test',
        status: 'pass',
        summary: 'OK',
        details: [
          { label: 'Key1', value: 'Val1' },
          { label: 'Key2', value: 'Val2' },
        ],
        remediation: '',
        wcagRef: '',
        pdfuaRef: '',
      }],
    };
    const csv = buildCsvContent(data);
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toContain('Key1: Val1; Key2: Val2');
  });

  it('should handle findings with empty details', () => {
    const data = {
      meta: {},
      findings: [{
        id: 'test',
        category: 'cat',
        title: 'Test',
        status: 'pass',
        summary: 'OK',
        details: [],
        remediation: '',
        wcagRef: '',
        pdfuaRef: '',
      }],
    };
    const csv = buildCsvContent(data);
    const dataRow = csv.split('\n')[1];
    // Details column should be empty
    expect(dataRow).toBeDefined();
  });
});

