/**
 * Tests for the UNDRR 13-point checklist data module.
 */
import { describe, it, expect } from 'vitest';
import {
  UNDRR_CHECKLIST,
  COMPLEMENTARY_TOOLS,
  resolveChecklistStatus,
  getUndrrItemForFinding,
  getAdditionalFindings,
} from './undrr-checklist.js';

// --- Data integrity ---

describe('UNDRR_CHECKLIST data integrity', () => {
  it('should have exactly 13 items', () => {
    expect(UNDRR_CHECKLIST).toHaveLength(13);
  });

  it('should have undrrNumber 1 through 13 in order', () => {
    const numbers = UNDRR_CHECKLIST.map((item) => item.undrrNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('should have required fields on every item', () => {
    for (const item of UNDRR_CHECKLIST) {
      expect(item.title, `item ${item.undrrNumber} title`).toBeTruthy();
      expect(item.whyItMatters, `item ${item.undrrNumber} whyItMatters`).toBeTruthy();
      expect(item.authoringTips, `item ${item.undrrNumber} authoringTips`).toBeDefined();
      expect(item.authoringTips.general, `item ${item.undrrNumber} general tip`).toBeTruthy();
      expect(item.complementaryTools, `item ${item.undrrNumber} complementaryTools`).toBeDefined();
      expect(Array.isArray(item.findingIds)).toBe(true);
    }
  });

  it('should have authoring tips for all 5 tool categories', () => {
    const toolKeys = ['general', 'word', 'indesign', 'powerpoint', 'acrobat'];
    for (const item of UNDRR_CHECKLIST) {
      for (const key of toolKeys) {
        expect(item.authoringTips[key], `item ${item.undrrNumber} missing tip for ${key}`).toBeTruthy();
      }
    }
  });

  it('should reference only valid complementary tool keys', () => {
    const validKeys = Object.keys(COMPLEMENTARY_TOOLS);
    for (const item of UNDRR_CHECKLIST) {
      for (const toolKey of item.complementaryTools) {
        expect(validKeys).toContain(toolKey);
      }
    }
  });

  it('should not have duplicate finding IDs across items', () => {
    const allIds = UNDRR_CHECKLIST.flatMap((item) => item.findingIds);
    const uniqueIds = new Set(allIds);
    expect(allIds.length).toBe(uniqueIds.size);
  });
});

describe('COMPLEMENTARY_TOOLS data integrity', () => {
  it('should have required fields on every tool', () => {
    for (const [key, tool] of Object.entries(COMPLEMENTARY_TOOLS)) {
      expect(tool.name, `${key} name`).toBeTruthy();
      expect(tool.description, `${key} description`).toBeTruthy();
      expect(tool.platform, `${key} platform`).toBeTruthy();
      expect(tool.role, `${key} role`).toBeTruthy();
    }
  });

  it('should include PAC, NVDA, VoiceOver, and Acrobat Pro', () => {
    expect(COMPLEMENTARY_TOOLS.pac).toBeDefined();
    expect(COMPLEMENTARY_TOOLS.nvda).toBeDefined();
    expect(COMPLEMENTARY_TOOLS.voiceover).toBeDefined();
    expect(COMPLEMENTARY_TOOLS.acrobatPro).toBeDefined();
  });
});

// --- resolveChecklistStatus ---

describe('resolveChecklistStatus', () => {
  it('should return 13 items', () => {
    const result = resolveChecklistStatus([]);
    expect(result).toHaveLength(13);
  });

  it('should return not-checked for items with no matching findings', () => {
    const result = resolveChecklistStatus([]);
    // Item 1 has finding IDs but no findings were provided
    expect(result[0].status).toBe('not-checked');
  });

  it('should include summary from the worst-status finding', () => {
    // Item 4 maps to tagged-pdf + structure-tree
    const findings = [
      { id: 'tagged-pdf', status: 'pass', summary: 'Tagged.' },
      { id: 'structure-tree', status: 'fail', summary: 'No structure tree.' },
    ];
    const result = resolveChecklistStatus(findings);
    // Item 4 is index 3
    expect(result[3].summary).toBe('No structure tree.');
  });

  it('should resolve pass status when all mapped findings pass', () => {
    const findings = [
      { id: 'tagged-pdf', status: 'pass' },
      { id: 'structure-tree', status: 'pass' },
    ];
    const result = resolveChecklistStatus(findings);
    expect(result[3].status).toBe('pass');
  });

  it('should use worst-status-wins for items with multiple findings', () => {
    const findings = [
      { id: 'tagged-pdf', status: 'pass' },
      { id: 'structure-tree', status: 'fail' },
    ];
    const result = resolveChecklistStatus(findings);
    // fail > pass, so item 4 should be fail
    expect(result[3].status).toBe('fail');
  });

  it('should resolve warning > pass', () => {
    const findings = [
      { id: 'tagged-pdf', status: 'warning' },
      { id: 'structure-tree', status: 'pass' },
    ];
    const result = resolveChecklistStatus(findings);
    expect(result[3].status).toBe('warning');
  });

  it('should resolve fail > warning', () => {
    const findings = [
      { id: 'tagged-pdf', status: 'fail' },
      { id: 'structure-tree', status: 'warning' },
    ];
    const result = resolveChecklistStatus(findings);
    // Item 4 (index 3): tagged-pdf, structure-tree
    expect(result[3].status).toBe('fail');
  });

  it('should include the actual finding objects in the result', () => {
    const findings = [
      { id: 'document-lang', status: 'pass', title: 'Language' },
    ];
    const result = resolveChecklistStatus(findings);
    // Item 2 (index 1): document-lang
    expect(result[1].findings).toHaveLength(1);
    expect(result[1].findings[0].id).toBe('document-lang');
  });

  it('should derive item 11 status from overall verdict (pass when all pass)', () => {
    const findings = [
      { id: 'document-title', status: 'pass', summary: 'OK' },
      { id: 'document-lang', status: 'pass', summary: 'OK' },
    ];
    const result = resolveChecklistStatus(findings);
    expect(result[10].status).toBe('pass');
    expect(result[10].summary).toContain('passed');
  });

  it('should derive item 11 status as warning (not fail) when findings fail', () => {
    const findings = [
      { id: 'document-title', status: 'fail', summary: 'Missing' },
      { id: 'document-lang', status: 'pass', summary: 'OK' },
    ];
    const result = resolveChecklistStatus(findings);
    // Checker was run, so it never fails — just warns about issues
    expect(result[10].status).toBe('warning');
    expect(result[10].summary).toContain('issue');
  });

  it('should derive item 11 status as not-checked when no findings', () => {
    const result = resolveChecklistStatus([]);
    expect(result[10].status).toBe('not-checked');
  });

  it('should handle manual status correctly', () => {
    const findings = [
      { id: 'reading-order', status: 'manual' },
      { id: 'tab-order', status: 'pass' },
    ];
    const result = resolveChecklistStatus(findings);
    // Item 5 (index 4): manual > pass
    expect(result[4].status).toBe('manual');
  });
});

// --- getUndrrItemForFinding ---

describe('getUndrrItemForFinding', () => {
  it('should return the UNDRR item for a mapped finding', () => {
    const item = getUndrrItemForFinding('document-title');
    expect(item).not.toBeNull();
    expect(item.undrrNumber).toBe(1);
  });

  it('should return null for an unmapped finding', () => {
    const item = getUndrrItemForFinding('font-tounicode');
    expect(item).toBeNull();
  });

  it('should return null for display-doc-title (no longer in checklist)', () => {
    const item = getUndrrItemForFinding('display-doc-title');
    expect(item).toBeNull();
  });

  it('should return the correct item for heading-hierarchy', () => {
    const item = getUndrrItemForFinding('heading-hierarchy');
    expect(item.undrrNumber).toBe(8);
  });

  it('should return null for a nonexistent finding ID', () => {
    expect(getUndrrItemForFinding('does-not-exist')).toBeNull();
  });
});

// --- getAdditionalFindings ---

describe('getAdditionalFindings', () => {
  it('should return findings not mapped to any UNDRR item', () => {
    const findings = [
      { id: 'document-title', status: 'pass' },
      { id: 'font-tounicode', status: 'warning' },
      { id: 'font-embedding', status: 'pass' },
    ];
    const additional = getAdditionalFindings(findings);
    expect(additional).toHaveLength(2);
    expect(additional.map((f) => f.id)).toEqual(['font-tounicode', 'font-embedding']);
  });

  it('should return empty array when all findings are mapped', () => {
    const findings = [
      { id: 'document-title', status: 'pass' },
      { id: 'document-lang', status: 'pass' },
    ];
    const additional = getAdditionalFindings(findings);
    expect(additional).toHaveLength(0);
  });

  it('should return all findings when none are mapped', () => {
    const findings = [
      { id: 'font-tounicode', status: 'pass' },
      { id: 'form-labels', status: 'fail' },
    ];
    const additional = getAdditionalFindings(findings);
    expect(additional).toHaveLength(2);
  });

  it('should handle empty findings array', () => {
    expect(getAdditionalFindings([])).toHaveLength(0);
  });
});
