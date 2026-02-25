/**
 * Integration tests — verify bundled sample PDFs produce expected audit results.
 *
 * These tests read the pre-generated sample PDFs from public/samples/ and run
 * them through the full audit pipeline. They ensure the samples stay consistent
 * with what the app promises (accessible sample passes key checks, issues sample
 * fails them).
 *
 * No network required — reads from disk.
 * Run with: npx vitest run test/integration/sample-pdf-audit.test.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { runAudit } from '../../src/audit/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, '../../public/samples');

/** Read a sample PDF and return its ArrayBuffer. */
function readSample(name) {
  const buf = readFileSync(join(SAMPLES_DIR, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/** Find a specific finding by ID. */
function findFinding(findings, id) {
  return findings.find((f) => f.id === id);
}

describe('Bundled sample PDF audit', () => {
  describe('sample-accessible.pdf', () => {
    let result;

    it('should audit without errors', async () => {
      const buffer = readSample('sample-accessible.pdf');
      result = await runAudit(buffer, { fileName: 'sample-accessible.pdf' });

      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.meta.pageCount).toBe(1);
    });

    it('should pass or warn document-title (Info dict only, no XMP)', () => {
      const f = findFinding(result.findings, 'document-title');
      expect(f).toBeDefined();
      // pdf-lib setTitle() sets Info dict only — engine returns 'warning' (not XMP)
      expect(['pass', 'warning']).toContain(f.status);
    });

    it('should pass document-lang', () => {
      const f = findFinding(result.findings, 'document-lang');
      expect(f).toBeDefined();
      expect(f.status).toBe('pass');
    });

    it('should pass tagged-pdf', () => {
      const f = findFinding(result.findings, 'tagged-pdf');
      expect(f).toBeDefined();
      expect(f.status).toBe('pass');
    });

    it('should pass structure-tree', () => {
      const f = findFinding(result.findings, 'structure-tree');
      expect(f).toBeDefined();
      expect(f.status).toBe('pass');
    });

    it('should pass image-alt-text (figure has alt)', () => {
      const f = findFinding(result.findings, 'image-alt-text');
      expect(f).toBeDefined();
      expect(['pass', 'not-applicable']).toContain(f.status);
    });
  });

  describe('sample-issues.pdf', () => {
    let result;

    it('should audit without errors', async () => {
      const buffer = readSample('sample-issues.pdf');
      result = await runAudit(buffer, { fileName: 'sample-issues.pdf' });

      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.meta.pageCount).toBe(1);
    });

    it('should fail document-title', () => {
      const f = findFinding(result.findings, 'document-title');
      expect(f).toBeDefined();
      expect(f.status).toBe('fail');
    });

    it('should fail document-lang', () => {
      const f = findFinding(result.findings, 'document-lang');
      expect(f).toBeDefined();
      expect(f.status).toBe('fail');
    });

    it('should fail tagged-pdf', () => {
      const f = findFinding(result.findings, 'tagged-pdf');
      expect(f).toBeDefined();
      expect(f.status).toBe('fail');
    });

    it('should fail structure-tree', () => {
      const f = findFinding(result.findings, 'structure-tree');
      expect(f).toBeDefined();
      expect(f.status).toBe('fail');
    });
  });
});
