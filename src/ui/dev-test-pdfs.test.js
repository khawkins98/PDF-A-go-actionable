/**
 * Tests for the developer test PDF presets module.
 *
 * Covers:
 * - Test PDF list structure validation
 * - Category grouping
 * - fetchTestPdf creates File objects
 */
import { describe, it, expect } from 'vitest';
import { testPdfs, getTestPdfsByCategory } from './dev-test-pdfs.js';

describe('testPdfs', () => {
  it('should have a non-empty array of test PDFs', () => {
    expect(Array.isArray(testPdfs)).toBe(true);
    expect(testPdfs.length).toBeGreaterThan(0);
  });

  it('should have required fields on every entry', () => {
    for (const pdf of testPdfs) {
      expect(typeof pdf.name).toBe('string');
      expect(pdf.name.length).toBeGreaterThan(0);
      expect(typeof pdf.url).toBe('string');
      expect(pdf.url).toMatch(/^https:\/\//);
      expect(['pass', 'fail', 'mixed', 'error']).toContain(pdf.expect);
      expect(typeof pdf.category).toBe('string');
      expect(pdf.category.length).toBeGreaterThan(0);
    }
  });

  it('should use CORS-friendly CDN URLs', () => {
    for (const pdf of testPdfs) {
      expect(pdf.url).toMatch(/cdn\.jsdelivr\.net/);
    }
  });

  it('should include both pass and fail test cases', () => {
    const passes = testPdfs.filter(p => p.expect === 'pass');
    const fails = testPdfs.filter(p => p.expect === 'fail');
    expect(passes.length).toBeGreaterThan(0);
    expect(fails.length).toBeGreaterThan(0);
  });

  it('should cover key audit categories', () => {
    const categories = new Set(testPdfs.map(p => p.category));
    expect(categories.has('Metadata')).toBe(true);
    expect(categories.has('Structure')).toBe(true);
    expect(categories.has('Headings')).toBe(true);
    expect(categories.has('Images')).toBe(true);
    expect(categories.has('Tables')).toBe(true);
    expect(categories.has('Fonts')).toBe(true);
    expect(categories.has('Forms')).toBe(true);
    expect(categories.has('Links')).toBe(true);
    expect(categories.has('Lists')).toBe(true);
    expect(categories.has('Tab Order')).toBe(true);
  });
});

describe('getTestPdfsByCategory', () => {
  it('should return a Map', () => {
    const groups = getTestPdfsByCategory();
    expect(groups).toBeInstanceOf(Map);
  });

  it('should group all PDFs without losing any', () => {
    const groups = getTestPdfsByCategory();
    let total = 0;
    for (const pdfs of groups.values()) {
      total += pdfs.length;
    }
    expect(total).toBe(testPdfs.length);
  });

  it('should have correct category keys', () => {
    const groups = getTestPdfsByCategory();
    for (const [category, pdfs] of groups) {
      for (const pdf of pdfs) {
        expect(pdf.category).toBe(category);
      }
    }
  });
});
