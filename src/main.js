/**
 * PDF-A-go-actionable — Entry point.
 *
 * Initializes the UI shell, creates the Web Worker, and wires up
 * drag-and-drop file handling.
 */
import { initAppShell } from './ui/app-shell.js';
import { initDropZone } from './ui/drop-zone.js';
import { state } from './ui/state.js';

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

// Create and manage Web Worker
function createWorker() {
  const worker = new Worker(
    new URL('./worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.addEventListener('message', (e) => {
    const { type, ...data } = e.data;
    switch (type) {
      case 'progress':
        state.emit('progress', data);
        break;
      case 'result':
        state.emit('result', data);
        break;
      case 'error':
        state.emit('error', data);
        break;
    }
  });

  return worker;
}

function init() {
  initSmallScreenBanner();

  const appEl = document.getElementById('app');
  const worker = createWorker();

  const shell = initAppShell(appEl);
  initDropZone(appEl, worker, shell);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
