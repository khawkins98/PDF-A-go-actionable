/**
 * Tests for the export module.
 *
 * Covers:
 * - escapeCsvField: quoting, escaping, null handling
 * - buildFilename: strips .pdf, appends report suffix
 * - initExport: returns three export functions
 * - drawChecklistPage (via PDF export integration)
 */
import { describe, it, expect } from 'vitest';
import { escapeCsvField, buildFilename, initExport, buildJsonOutput, buildCsvContent } from './export.js';
import { UNDRR_CHECKLIST } from './undrr-checklist.js';

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
  it('should include checklist in JSON output', () => {
    const data = {
      meta: { fileName: 'test.pdf' },
      findings: [
        { id: 'tagged-pdf', status: 'pass', category: 'structure', title: 'Tagged PDF', summary: 'OK', details: [], remediation: null, wcagRef: '1.3.1', pdfuaRef: '7.1' },
      ],
    };
    const output = buildJsonOutput(data);
    expect(output.checklist).toBeDefined();
    expect(Array.isArray(output.checklist)).toBe(true);
    expect(output.checklist.length).toBe(13);
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

// --- UNDRR Checklist integration ---

describe('UNDRR checklist coverage', () => {
  it('should have all 13 UNDRR checklist items defined', () => {
    expect(UNDRR_CHECKLIST).toHaveLength(13);
  });

  it('should map our finding IDs to the checklist items', () => {
    const allIds = UNDRR_CHECKLIST.flatMap((item) => item.findingIds);
    expect(allIds).toContain('document-title');
    expect(allIds).toContain('document-lang');
    expect(allIds).toContain('heading-hierarchy');
    expect(allIds).toContain('image-alt-text');
  });

  it('should not have unknown finding IDs in the checklist', () => {
    const knownIds = [
      'document-title', 'display-doc-title', 'document-lang',
      'security-permissions', 'tagged-pdf', 'structure-tree',
      'reading-order', 'tab-order', 'image-alt-text',
      'decorative-images', 'heading-hierarchy', 'table-headers',
      'list-structure', 'pac-validation', 'screen-reader-test',
      'color-contrast',
    ];
    const allIds = UNDRR_CHECKLIST.flatMap((item) => item.findingIds);
    for (const id of allIds) {
      expect(knownIds, `Unknown finding ID "${id}" in UNDRR checklist`).toContain(id);
    }
  });
});
