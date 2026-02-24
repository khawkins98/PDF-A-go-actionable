/**
 * PDF-A-go-actionable — Web Worker.
 *
 * Receives PDF ArrayBuffer, runs the audit pipeline, and posts back
 * progress/result/error messages to the main thread.
 *
 * Each message includes a `sessionId` so the main thread can route
 * responses to the correct analysis session.
 */
import { runAudit } from './audit/runner.js';

self.addEventListener('message', async (e) => {
  const { type, buffer, fileName, sessionId } = e.data;

  if (type !== 'audit') return;

  try {
    const result = await runAudit(buffer, {
      fileName,
      onProgress: (phase, percent) => {
        self.postMessage({ type: 'progress', sessionId, phase, percent });
      },
    });

    self.postMessage({ type: 'result', sessionId, ...result });
  } catch (err) {
    self.postMessage({
      type: 'error',
      sessionId,
      message: err.message || 'An unknown error occurred during the audit.',
    });
  }
});
