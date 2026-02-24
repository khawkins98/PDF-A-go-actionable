/**
 * File upload component — drag-and-drop + file input.
 * Supports selecting multiple PDF files at once.
 */

/**
 * Create a file upload zone element.
 *
 * @param {Function} onFiles - Callback receiving an array of selected Files
 * @returns {HTMLElement} The upload zone element
 */
export function createUploadZone(onFiles) {
  const zone = document.createElement('div');
  zone.className = 'drop-zone';
  zone.setAttribute('role', 'region');
  zone.setAttribute('aria-label', 'PDF file upload area');
  zone.setAttribute('tabindex', '0');
  zone.innerHTML = `
    <div class="drop-zone__title">Drop PDF(s) here</div>
    <div class="drop-zone__subtitle">or click to browse</div>
    <input type="file" accept=".pdf,application/pdf" multiple class="visually-hidden" aria-label="Choose PDF files" />
  `;

  const fileInput = zone.querySelector('input[type="file"]');

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

  fileInput.addEventListener('change', (e) => {
    const files = filterPdfs(e.target.files);
    if (files.length > 0) onFiles(files);
    fileInput.value = ''; // reset so re-selecting same file works
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
    const files = filterPdfs(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  });

  return zone;
}

/**
 * Filter a FileList to only PDF files.
 * @param {FileList} fileList
 * @returns {File[]}
 */
export function filterPdfs(fileList) {
  return [...fileList].filter(
    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  );
}
