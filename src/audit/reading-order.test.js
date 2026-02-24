/**
 * Tests for the reading-order audit module.
 *
 * Covers:
 * - Returns exactly 3 findings
 * - All findings have status 'manual'
 * - Expected finding IDs
 * - Each finding has required fields
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { checkReadingOrder } from './reading-order.js';
import { buildTestContext } from '../../test/helpers/context.js';
import { createUntaggedPdf } from '../../test/fixtures/create-test-pdfs.js';

describe('checkReadingOrder', () => {
  let findings;

  // Reading order returns deterministic results regardless of PDF content,
  // so we only need one test context.
  beforeAll(async () => {
    const bytes = await createUntaggedPdf();
    const ctx = await buildTestContext(bytes);
    findings = checkReadingOrder(ctx.pdfDoc, ctx);
  });

  it('should return exactly 3 findings', () => {
    expect(findings).toHaveLength(3);
  });

  it('should return all findings with status "manual"', () => {
    for (const f of findings) {
      expect(f.status).toBe('manual');
    }
  });

  it('should include reading-order finding', () => {
    const f = findings.find(f => f.id === 'reading-order');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('Reading Order');
    expect(f.wcagRef).toBe('1.3.2');
  });

  it('should include pac-validation finding', () => {
    const f = findings.find(f => f.id === 'pac-validation');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('PAC');
  });

  it('should include screen-reader-test finding', () => {
    const f = findings.find(f => f.id === 'screen-reader-test');
    expect(f).toBeDefined();
    expect(f.category).toBe('reading-order');
    expect(f.title).toContain('Screen Reader');
  });

  it('should include details and remediation on each finding', () => {
    for (const f of findings) {
      expect(Array.isArray(f.details)).toBe(true);
      expect(f.details.length).toBeGreaterThan(0);
      expect(typeof f.remediation).toBe('string');
      expect(f.remediation.length).toBeGreaterThan(0);
    }
  });

  it('should have summary text on each finding', () => {
    for (const f of findings) {
      expect(typeof f.summary).toBe('string');
      expect(f.summary.length).toBeGreaterThan(0);
    }
  });
});
