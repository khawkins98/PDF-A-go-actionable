/**
 * PDF-A-go-actionable — Entry point.
 *
 * Creates the Web Worker and passes it to the app shell.
 * The app shell manages the full lifecycle including worker message routing.
 */
import { initAppShell } from './ui/app-shell.js';

// Show small-screen banner
function initSmallScreenBanner() {
  if (window.innerWidth >= 768) return;
  const banner = document.createElement('div');
  banner.className = 'small-screen-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    This tool is designed for larger screens.
    <button type="button">Dismiss</button>
  `;
  banner.querySelector('button').addEventListener('click', () => {
    banner.classList.add('dismissed');
  });
  document.body.prepend(banner);
}

// Create Web Worker
function createWorker() {
  return new Worker(
    new URL('./worker.js', import.meta.url),
    { type: 'module' }
  );
}

function init() {
  initSmallScreenBanner();

  const appEl = document.getElementById('app');
  const worker = createWorker();

  initAppShell(appEl, worker);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
