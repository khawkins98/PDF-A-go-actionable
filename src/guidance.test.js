/**
 * Tests for the consolidated guidance module.
 */
import { describe, it, expect } from 'vitest';
import {
  FINDINGS,
  getRemediation,
  META_TOOLTIPS,
  CREATOR_HINTS,
  detectCreatorTool,
  COMPLEMENTARY_TOOLS,
  UNDRR_CHECKLIST,
} from './guidance.js';

describe('FINDINGS', () => {
  const EXPECTED_IDS = [
    'document-title', 'document-lang', 'security-permissions',
    'tagged-pdf', 'structure-tree', 'heading-hierarchy',
    'image-alt-text', 'decorative-images', 'table-headers',
    'list-structure', 'font-tounicode', 'font-embedding',
    'form-labels', 'tab-order', 'link-text',
    'color-contrast', 'reading-order',
    'screen-reader-test', 'pdfa-conformance', 'pdfua-conformance',
    'display-doc-title', 'bookmarks', 'per-element-language',
    'load-failure',
  ];

  it('should contain all expected finding IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(FINDINGS[id], `Missing FINDINGS entry for "${id}"`).toBeDefined();
    }
  });

  it('should have "why" and "remediation" keys on every entry', () => {
    for (const [id, entry] of Object.entries(FINDINGS)) {
      expect(entry).toHaveProperty('why');
      expect(entry).toHaveProperty('remediation');
    }
  });

  it('should have non-empty "why" for audit findings (not load-failure)', () => {
    for (const [id, entry] of Object.entries(FINDINGS)) {
      if (id === 'load-failure') continue;
      expect(typeof entry.why, `FINDINGS["${id}"].why should be a string`).toBe('string');
      expect(entry.why.length, `FINDINGS["${id}"].why should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe('getRemediation', () => {
  it('should return string remediation directly', () => {
    const result = getRemediation('security-permissions');
    expect(result).toContain('Remove the security restrictions');
  });

  it('should return status-keyed remediation when status is provided', () => {
    const result = getRemediation('document-title', 'fail');
    expect(result).toContain('Set the document title');
  });

  it('should return null for status-keyed when status does not match', () => {
    const result = getRemediation('document-title', 'pass');
    expect(result).toBeNull();
  });

  it('should return null when finding has null remediation', () => {
    const result = getRemediation('load-failure');
    expect(result).toBeNull();
  });

  it('should return null for unknown finding ID', () => {
    const result = getRemediation('nonexistent-finding');
    expect(result).toBeNull();
  });

  it('should return string remediation regardless of status param', () => {
    const result = getRemediation('table-headers', 'fail');
    expect(result).toContain('Mark header cells as TH');
  });
});

describe('META_TOOLTIPS', () => {
  const EXPECTED_LABELS = [
    'Title', 'Author', 'Subject', 'Keywords', 'Language',
    'Pages', 'File Size', 'Tagged', 'PDF/UA', 'PDF/A',
    'Viewer Shows Title', 'Structure Tree', 'Creator', 'Producer',
  ];

  it('should have all 14 expected label keys', () => {
    for (const label of EXPECTED_LABELS) {
      expect(META_TOOLTIPS[label], `Missing META_TOOLTIPS["${label}"]`).toBeDefined();
    }
    expect(Object.keys(META_TOOLTIPS).length).toBe(14);
  });

  it('should have non-empty string values', () => {
    for (const [label, text] of Object.entries(META_TOOLTIPS)) {
      expect(typeof text).toBe('string');
      expect(text.length, `META_TOOLTIPS["${label}"] should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe('CREATOR_HINTS', () => {
  it('should have 5 tool entries', () => {
    expect(Object.keys(CREATOR_HINTS).length).toBe(5);
  });

  it('each entry should have tool and hint strings', () => {
    for (const [key, entry] of Object.entries(CREATOR_HINTS)) {
      expect(typeof entry.tool).toBe('string');
      expect(typeof entry.hint).toBe('string');
    }
  });
});

describe('detectCreatorTool', () => {
  it('should detect InDesign', () => {
    expect(detectCreatorTool({ creator: 'Adobe InDesign 2025' })).toBe('indesign');
  });

  it('should detect Word', () => {
    expect(detectCreatorTool({ creator: 'Microsoft Word 365' })).toBe('word');
  });

  it('should detect PowerPoint from producer', () => {
    expect(detectCreatorTool({ producer: 'Microsoft PowerPoint 2021' })).toBe('powerpoint');
  });

  it('should detect LibreOffice', () => {
    expect(detectCreatorTool({ creator: 'LibreOffice 7' })).toBe('libreoffice');
  });

  it('should detect Acrobat', () => {
    expect(detectCreatorTool({ producer: 'Adobe Acrobat Pro DC' })).toBe('acrobat');
  });

  it('should return null for unknown tools', () => {
    expect(detectCreatorTool({ creator: 'PptxGenJS' })).toBeNull();
  });

  it('should return null for null meta', () => {
    expect(detectCreatorTool(null)).toBeNull();
  });
});

describe('COMPLEMENTARY_TOOLS', () => {
  it('should have 7 tool entries', () => {
    expect(Object.keys(COMPLEMENTARY_TOOLS).length).toBe(7);
  });

  it('each entry should have name, description, platform, and role', () => {
    for (const [key, entry] of Object.entries(COMPLEMENTARY_TOOLS)) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(typeof entry.platform).toBe('string');
      expect(typeof entry.role).toBe('string');
    }
  });
});

describe('UNDRR_CHECKLIST', () => {
  it('should have 13 items', () => {
    expect(UNDRR_CHECKLIST.length).toBe(13);
  });

  it('should number items 1-13', () => {
    const numbers = UNDRR_CHECKLIST.map(i => i.undrrNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('each item should have title, findingIds array, and authoringTips', () => {
    for (const item of UNDRR_CHECKLIST) {
      expect(typeof item.title).toBe('string');
      expect(Array.isArray(item.findingIds)).toBe(true);
      expect(item.authoringTips).toBeDefined();
      expect(typeof item.authoringTips.general).toBe('string');
    }
  });

  it('whyItMatters should reference FINDINGS.why for mapped items', () => {
    for (const item of UNDRR_CHECKLIST) {
      if (item.findingIds.length > 0) {
        const firstFinding = FINDINGS[item.findingIds[0]];
        if (firstFinding && firstFinding.why) {
          expect(item.whyItMatters).toBe(firstFinding.why);
        }
      }
    }
  });
});
