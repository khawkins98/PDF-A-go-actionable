/**
 * Drag-and-drop + file input handler for PDF files.
 */
import { state } from './state.js';

/**
 * Initialize the drop zone in the app container.
 *
 * @param {HTMLElement} container - The #app element
 * @param {Worker} worker - The audit Web Worker
 * @param {object} shell - The app shell instance
 */
export function initDropZone(container, worker, shell) {
  const zone = document.createElement('div');
  zone.className = 'drop-zone';
  zone.setAttribute('role', 'region');
  zone.setAttribute('aria-label', 'PDF file upload area');
  zone.innerHTML = `
    <div class="drop-zone__title">Drop a PDF here</div>
    <div class="drop-zone__subtitle">or click to browse</div>
    <input type="file" accept=".pdf,application/pdf" class="visually-hidden" id="file-input" aria-label="Choose PDF file" />
    <div class="progress-bar" style="display:none;" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar__fill" style="width:0%"></div>
    </div>
    <div class="drop-zone__status visually-hidden" role="status" aria-live="polite"></div>
  `;

  const fileInput = zone.querySelector('#file-input');
  const progressBar = zone.querySelector('.progress-bar');
  const progressFill = zone.querySelector('.progress-bar__fill');
  const statusEl = zone.querySelector('.drop-zone__status');

  // Click to browse
  zone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });

  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  zone.setAttribute('tabindex', '0');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drop-zone--active');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drop-zone--active');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drop-zone--active');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleFile(file);
    }
  });

  // Progress updates
  state.on('progress', ({ phase, percent }) => {
    progressBar.style.display = '';
    progressFill.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', String(percent));
    statusEl.textContent = `Analyzing: ${phase} (${percent}%)`;
  });

  // Result
  state.on('result', (data) => {
    progressBar.style.display = 'none';
    statusEl.textContent = 'Analysis complete.';
    zone.style.display = 'none';
    shell.showReport(data);
  });

  // Error
  state.on('error', ({ message }) => {
    progressBar.style.display = 'none';
    statusEl.textContent = `Error: ${message}`;
    zone.querySelector('.drop-zone__title').textContent = 'Error analyzing PDF';
    zone.querySelector('.drop-zone__subtitle').textContent = message;
  });

  container.appendChild(zone);

  async function handleFile(file) {
    state.reset();
    zone.querySelector('.drop-zone__title').textContent = `Analyzing ${file.name}...`;
    zone.querySelector('.drop-zone__subtitle').textContent = '';
    statusEl.textContent = 'Starting analysis...';
    progressBar.style.display = '';
    progressFill.style.width = '0%';

    const buffer = await file.arrayBuffer();
    worker.postMessage(
      { type: 'audit', buffer, fileName: file.name },
      [buffer]
    );
  }
}
