/**
 * URL reachability test — verify every test PDF URL is still valid.
 *
 * Upstream repos (veraPDF, PDF Association) occasionally rename directories,
 * breaking our CDN URLs. This test does a HEAD request against each URL so
 * we catch 404s before they surface as confusing runtime errors.
 *
 * Requires network access. Skipped when SKIP_NETWORK_TESTS=true.
 * Run with: npx vitest run test/integration/test-pdf-urls.test.js
 */
import { describe, it, expect } from 'vitest';
import { testPdfs } from '../../src/ui/dev-test-pdfs.js';

const SKIP = process.env.SKIP_NETWORK_TESTS === 'true';

describe.skipIf(SKIP)('Test PDF URL reachability', () => {
  for (const entry of testPdfs) {
    it(`${entry.name} — URL returns 200`, async () => {
      const resp = await fetch(entry.url, { method: 'HEAD' });
      expect(resp.status, `${entry.url} returned ${resp.status}`).toBe(200);
    }, 10_000);
  }
});
