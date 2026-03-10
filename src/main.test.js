// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock app-shell before importing main
vi.mock('./ui/app-shell.js', () => ({
  initAppShell: vi.fn(),
}));

describe('main.js', () => {
  let origWorker;

  beforeEach(() => {
    origWorker = globalThis.Worker;

    // Mock Worker constructor
    globalThis.Worker = vi.fn(() => ({ postMessage: vi.fn(), terminate: vi.fn() }));

    // Ensure #app exists
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    globalThis.Worker = origWorker;
    vi.resetModules();
    document.body.innerHTML = '';
  });

  describe('small-screen banner', () => {
    it('displays banner below 768px', async () => {
      window.innerWidth = 500;
      await import('./main.js');

      const banner = document.querySelector('.small-screen-banner');
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain('designed for larger screens');
    });

    it('does not display banner at 768px or above', async () => {
      window.innerWidth = 1024;
      await import('./main.js');

      const banner = document.querySelector('.small-screen-banner');
      expect(banner).toBeNull();
    });

    it('dismiss button adds dismissed class', async () => {
      window.innerWidth = 500;
      await import('./main.js');

      const banner = document.querySelector('.small-screen-banner');
      const btn = banner.querySelector('button');
      btn.click();
      expect(banner.classList.contains('dismissed')).toBe(true);
    });
  });

  describe('Worker creation', () => {
    it('creates worker with module type', async () => {
      window.innerWidth = 1024;
      await import('./main.js');

      expect(globalThis.Worker).toHaveBeenCalledTimes(1);
      const [url, opts] = globalThis.Worker.mock.calls[0];
      expect(url).toBeInstanceOf(URL);
      expect(opts).toEqual({ type: 'module' });
    });
  });
});
