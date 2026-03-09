/**
 * Performance benchmark tests.
 *
 * Ensures the audit completes within acceptable time for large documents.
 */
import { describe, it, expect } from 'vitest';
import { runAudit } from '../../src/audit/runner.js';
import { createLargePdf } from '../fixtures/create-test-pdfs.js';

describe('Performance', () => {
  it('should audit a 1000-element PDF in under 3 seconds', async () => {
    const bytes = await createLargePdf(1000);
    const start = performance.now();
    const result = await runAudit(bytes.buffer);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.meta.isTagged).toBe(true);
  });
});
