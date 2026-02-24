/**
 * PDF-A-go-actionable — Web Worker.
 *
 * Receives PDF ArrayBuffer, runs the audit pipeline, and posts back
 * progress/result/error messages to the main thread.
 */
import { runAudit } from './audit/runner.js';

self.addEventListener('message', async (e) => {
  const { type, buffer, fileName } = e.data;

  if (type !== 'audit') return;

  try {
    const result = await runAudit(buffer, {
      fileName,
      onProgress: (phase, percent) => {
        self.postMessage({ type: 'progress', phase, percent });
      },
    });

    self.postMessage({ type: 'result', ...result });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err.message || 'An unknown error occurred during the audit.',
    });
  }
});
