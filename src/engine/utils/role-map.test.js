/**
 * Tests for the RoleMap resolution utilities.
 *
 * Covers:
 * - buildRoleMap: reading custom->standard mappings from a PDFDict
 * - resolveRole: standard types pass through, custom types resolve,
 *   chaining, cycle detection
 * - getRoleMapFromDoc: integration with a full PDFDocument
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { buildRoleMap, resolveRole, getRoleMapFromDoc, STANDARD_TYPES } from './role-map.js';
import { buildTestContext } from '../../../test/helpers/context.js';
import { createPdfWithRoleMap, createUntaggedPdf } from '../../../test/fixtures/create-test-pdfs.js';

describe('buildRoleMap', () => {
  it('should return an empty map when given null', () => {
    const map = buildRoleMap(null);
    expect(map.size).toBe(0);
  });

  it('should build a map from a PDFDict with custom->standard entries', async () => {
    const doc = await PDFDocument.create();
    const roleMapDict = doc.context.obj({
      Heading1: PDFName.of('H1'),
      Slide: PDFName.of('Sect'),
    });
    const map = buildRoleMap(roleMapDict);

    expect(map.get('Heading1')).toBe('H1');
    expect(map.get('Slide')).toBe('Sect');
    expect(map.size).toBe(2);
  });
});

describe('resolveRole', () => {
  it('should return a standard type as-is', () => {
    const map = new Map();
    expect(resolveRole('H1', map)).toBe('H1');
    expect(resolveRole('Figure', map)).toBe('Figure');
    expect(resolveRole('Table', map)).toBe('Table');
  });

  it('should resolve a custom type to its standard mapping', () => {
    const map = new Map([['Heading1', 'H1']]);
    expect(resolveRole('Heading1', map)).toBe('H1');
  });

  it('should handle chained mappings (custom -> custom -> standard)', () => {
    const map = new Map([
      ['MyHeading', 'Heading1'],
      ['Heading1', 'H1'],
    ]);
    expect(resolveRole('MyHeading', map)).toBe('H1');
  });

  it('should handle cycles without infinite loop', () => {
    const map = new Map([
      ['A', 'B'],
      ['B', 'A'],
    ]);
    // Should terminate and return one of the cycle values
    const result = resolveRole('A', map);
    expect(['A', 'B']).toContain(result);
  });

  it('should return original type when map is empty', () => {
    const map = new Map();
    expect(resolveRole('CustomType', map)).toBe('CustomType');
  });

  it('should return original type when not in map', () => {
    const map = new Map([['Other', 'H1']]);
    expect(resolveRole('NotMapped', map)).toBe('NotMapped');
  });
});

describe('getRoleMapFromDoc', () => {
  it('should return empty map for untagged PDF', async () => {
    const bytes = await createUntaggedPdf();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const map = getRoleMapFromDoc(doc);
    expect(map.size).toBe(0);
  });

  it('should extract RoleMap from a tagged PDF', async () => {
    const bytes = await createPdfWithRoleMap({ Heading1: 'H1', Slide: 'Sect' });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const map = getRoleMapFromDoc(doc);

    expect(map.get('Heading1')).toBe('H1');
    expect(map.get('Slide')).toBe('Sect');
  });
});

describe('STANDARD_TYPES', () => {
  it('should contain common PDF structure types', () => {
    const expected = ['Document', 'P', 'H1', 'H2', 'H3', 'Table', 'TR', 'TH', 'TD',
      'L', 'LI', 'Lbl', 'LBody', 'Figure', 'Link', 'Span'];
    for (const type of expected) {
      expect(STANDARD_TYPES.has(type)).toBe(true);
    }
  });
});
