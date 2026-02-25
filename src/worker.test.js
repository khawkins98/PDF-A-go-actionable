/**
 * Tests for the Web Worker message protocol (src/worker.js).
 *
 * Strategy: Since real Web Workers are unavailable in Node/Vitest,
 * we mock `globalThis.self` with spy versions of addEventListener
 * and postMessage, then dynamically import worker.js so it registers
 * its listener on our mock. We invoke the captured listener manually
 * to simulate incoming messages from the main thread.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

describe('Worker message protocol', () => {
  let messageHandler;
  let postMessageSpy;
  let originalSelf;

  beforeEach(() => {
    originalSelf = globalThis.self;
    postMessageSpy = vi.fn();

    globalThis.self = {
      addEventListener: (event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      },
      postMessage: postMessageSpy,
    };

    vi.resetModules();
  });

  afterEach(() => {
    globalThis.self = originalSelf;
    vi.restoreAllMocks();
    messageHandler = null;
  });

  /** Create a minimal valid single-page PDF and return its ArrayBuffer. */
  async function createTestBuffer() {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    return bytes.buffer;
  }

  it('should post result with findings and meta for audit messages', async () => {
    await import('./worker.js');
    expect(messageHandler).toBeDefined();

    const buffer = await createTestBuffer();
    await messageHandler({
      data: { type: 'audit', buffer, fileName: 'test.pdf', sessionId: 'sess-1' },
    });

    const resultCall = postMessageSpy.mock.calls.find((c) => c[0].type === 'result');
    expect(resultCall).toBeDefined();
    const msg = resultCall[0];
    expect(msg.sessionId).toBe('sess-1');
    expect(Array.isArray(msg.findings)).toBe(true);
    expect(msg.findings.length).toBeGreaterThan(0);
    expect(msg.meta).toBeDefined();
    expect(msg.meta.fileName).toBe('test.pdf');
    expect(typeof msg.meta.pageCount).toBe('number');
  });

  it('should post progress messages during audit', async () => {
    await import('./worker.js');
    const buffer = await createTestBuffer();

    await messageHandler({
      data: { type: 'audit', buffer, fileName: 'test.pdf', sessionId: 'sess-2' },
    });

    const progressCalls = postMessageSpy.mock.calls.filter((c) => c[0].type === 'progress');
    expect(progressCalls.length).toBeGreaterThan(0);

    for (const call of progressCalls) {
      expect(call[0].sessionId).toBe('sess-2');
      expect(typeof call[0].phase).toBe('string');
      expect(typeof call[0].percent).toBe('number');
    }
  });

  it('should include findings array and meta object with expected keys in result', async () => {
    await import('./worker.js');
    const buffer = await createTestBuffer();

    await messageHandler({
      data: { type: 'audit', buffer, fileName: 'shape-check.pdf', sessionId: 'sess-shape' },
    });

    const resultCall = postMessageSpy.mock.calls.find((c) => c[0].type === 'result');
    expect(resultCall).toBeDefined();

    const msg = resultCall[0];

    // Findings shape
    expect(Array.isArray(msg.findings)).toBe(true);
    for (const finding of msg.findings) {
      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('status');
      expect(finding).toHaveProperty('title');
    }

    // Meta shape
    expect(msg.meta).toEqual(
      expect.objectContaining({
        fileName: 'shape-check.pdf',
        pageCount: expect.any(Number),
        fileSize: expect.any(Number),
      }),
    );
  });

  it('should post error message with sessionId when runAudit throws', async () => {
    vi.doMock('./audit/runner.js', () => ({
      runAudit: vi.fn().mockRejectedValue(new Error('Unexpected crash')),
    }));

    await import('./worker.js');
    const buffer = await createTestBuffer();

    await messageHandler({
      data: { type: 'audit', buffer, fileName: 'bad.pdf', sessionId: 'sess-err' },
    });

    const errorCall = postMessageSpy.mock.calls.find((c) => c[0].type === 'error');
    expect(errorCall).toBeDefined();
    expect(errorCall[0].sessionId).toBe('sess-err');
    expect(errorCall[0].message).toBe('Unexpected crash');
  });

  it('should include sessionId on every outbound message', async () => {
    await import('./worker.js');
    const buffer = await createTestBuffer();
    const sid = 'unique-session-789';

    await messageHandler({
      data: { type: 'audit', buffer, fileName: 'test.pdf', sessionId: sid },
    });

    expect(postMessageSpy.mock.calls.length).toBeGreaterThan(0);
    for (const call of postMessageSpy.mock.calls) {
      expect(call[0].sessionId).toBe(sid);
    }
  });

  it('should silently ignore non-audit message types', async () => {
    await import('./worker.js');

    await messageHandler({ data: { type: 'something-else', sessionId: 'sess-3' } });
    await messageHandler({ data: { type: 'ping' } });
    await messageHandler({ data: { type: '' } });

    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});
