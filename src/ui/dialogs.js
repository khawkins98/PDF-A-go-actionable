/**
 * Application dialogs — About, Help, and informational dialogs.
 *
 * Each function creates dialog content and opens it in a WinBox window.
 * Returns the WinBox instance for singleton management by the caller.
 */

import { MENUBAR_HEIGHT } from './menu-bar.js';
import { setWinBoxAriaRole } from './window-manager.js';
import { COMPLEMENTARY_TOOLS } from './undrr-checklist.js';

/**
 * Show the About dialog.
 *
 * @param {HTMLElement} root - The app root element
 * @param {Function} WinBox - WinBox constructor
 * @param {Function} [onClose] - Callback when dialog is closed
 * @returns {object} WinBox instance
 */
export function showAboutDialog(root, WinBox, onClose) {
  const content = document.createElement('div');
  content.className = 'about-dialog';
  content.setAttribute('tabindex', '-1');
  content.innerHTML = `
    <div class="about-hero">
      <svg class="about-hero__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="4" fill="#333"/>
        <text x="16" y="22" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">A</text>
        <circle cx="26" cy="6" r="4" fill="#22c55e"/>
      </svg>
      <div class="about-hero__name">PDF-A-go-actionable</div>
      <div class="about-hero__version">Version 1.3.0</div>
      <div class="about-hero__tagline">PDF Accessibility Checker</div>
    </div>
    <div class="about-info-panel">
      <dl class="about-info-grid">
        <dt>Purpose</dt>
        <dd>Checks ~13 things that most affect screen reader usability</dd>
        <dt>Privacy</dt>
        <dd>Everything runs in the browser -- no uploads, no server</dd>
        <dt>License</dt>
        <dd><a href="https://github.com/khawkins98/PDF-A-go-actionable" target="_blank" rel="noopener noreferrer">MIT</a></dd>
        <dt>Changelog</dt>
        <dd><a href="https://github.com/khawkins98/PDF-A-go-actionable/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">v1.3.0</a></dd>
      </dl>
      <details class="about-details">
        <summary>Built With</summary>
        <ul class="about-credits">
          <li><a href="https://github.com/Hopding/pdf-lib" target="_blank" rel="noopener noreferrer">pdf-lib</a> -- PDF object access</li>
          <li><a href="https://github.com/101arrowz/fflate" target="_blank" rel="noopener noreferrer">fflate</a> -- stream decompression</li>
          <li><a href="https://github.com/nextapps-de/winbox" target="_blank" rel="noopener noreferrer">WinBox</a> -- window management</li>
          <li><a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener noreferrer">PDF.js</a> -- PDF rendering</li>
        </ul>
      </details>
      <details class="about-details">
        <summary>Why NeXTSTEP?</summary>
        <p>PDF has <a href="https://en.wikipedia.org/wiki/NeXTSTEP" target="_blank" rel="noopener noreferrer">NeXTSTEP</a>
        in its DNA. NeXT's display engine was built on Adobe's
        <a href="https://en.wikipedia.org/wiki/Display_PostScript" target="_blank" rel="noopener noreferrer">Display PostScript</a>,
        and <a href="https://en.wikipedia.org/wiki/PDF#History" target="_blank" rel="noopener noreferrer">PDF itself</a>
        grew out of PostScript. When Apple acquired NeXT in 1997, that technology became
        <a href="https://en.wikipedia.org/wiki/Quartz_(graphics_layer)" target="_blank" rel="noopener noreferrer">Quartz</a>,
        the macOS graphics layer that renders PDF natively to this day.</p>
      </details>
    </div>
  `;

  const win = new WinBox({
    title: 'About',
    mount: content,
    root,
    x: 'center',
    y: 'center',
    width: 380,
    height: 480,
    top: MENUBAR_HEIGHT,
    overflow: true,
    class: ['white', 'no-full', 'no-max', 'no-min', 'no-resize'],
    border: 1,
    onclose: onClose || undefined,
  });

  setWinBoxAriaRole(win, 'About');

  // Move focus into the dialog content
  requestAnimationFrame(() => content.focus());

  return win;
}

/**
 * Show the Help dialog.
 *
 * @param {HTMLElement} root - The app root element
 * @param {Function} WinBox - WinBox constructor
 * @param {Function} [onClose] - Callback when dialog is closed
 * @returns {object} WinBox instance
 */
export function showHelpDialog(root, WinBox, onClose) {
  const content = document.createElement('div');
  content.className = 'dialog-content';
  content.setAttribute('tabindex', '-1');
  content.innerHTML = `
    <h2>How to Use</h2>
    <ol>
      <li>Click <strong>Open File(s)</strong> in the menu bar, or drag PDFs onto the welcome window</li>
      <li>Wait for each analysis to complete</li>
      <li>Review findings in the results window. Click any finding for details</li>
      <li>Use the toolbar to open Structure Tree, Font, or Image panels</li>
      <li>Export results as JSON, CSV, or PDF</li>
    </ol>
    <h3>Tips</h3>
    <ul>
      <li>Open multiple PDFs at once for batch analysis</li>
      <li>Use <strong>Window &gt; Tile All</strong> to see results side by side</li>
      <li>Each result window has its own export and panel buttons</li>
      <li><strong>Export All</strong> downloads results for every open analysis</li>
    </ul>
    <h3>Keyboard Shortcuts</h3>
    <ul>
      <li><strong>Arrow Left / Right</strong> -- navigate menu bar items</li>
      <li><strong>Arrow Down</strong> -- open submenu</li>
      <li><strong>Arrow Up / Down</strong> -- navigate within submenus</li>
      <li><strong>Enter / Space</strong> -- activate buttons</li>
      <li><strong>Escape</strong> -- close menus and dialogs</li>
      <li><strong>Home / End</strong> -- jump to first or last menu item</li>
    </ul>
    <h3>Complementary Tools</h3>
    <p>This tool covers the most common checks. For full PDF/UA
    conformance or additional depth, use these alongside it:</p>
    <ul class="help-tools-list">
      ${Object.values(COMPLEMENTARY_TOOLS).map((tool) =>
        `<li><strong>${tool.url ? `<a href="${tool.url}" target="_blank" rel="noopener noreferrer">${tool.name}</a>` : tool.name}</strong> -- ${tool.role} (${tool.platform})</li>`
      ).join('\n      ')}
    </ul>
  `;

  const win = new WinBox({
    title: 'Help',
    mount: content,
    root,
    x: 'center',
    y: 'center',
    width: 500,
    height: 560,
    top: MENUBAR_HEIGHT,
    overflow: true,
    class: ['white', 'no-full', 'no-max', 'no-min'],
    border: 1,
    onclose: onClose || undefined,
  });

  setWinBoxAriaRole(win, 'Help');

  // Move focus into the dialog content
  requestAnimationFrame(() => content.focus());

  return win;
}

/**
 * Show the Bookmark placeholder dialog.
 *
 * @param {HTMLElement} root - The app root element
 * @param {Function} WinBox - WinBox constructor
 */
export function showBookmarkPlaceholder(root, WinBox) {
  const content = document.createElement('div');
  content.className = 'dialog-content';
  content.innerHTML = `
    <h2>Bookmarks / Outlines</h2>
    <p>No CORS-friendly test PDFs for bookmarks have been found
    in the public test corpus repositories yet.</p>
    <p>The audit checks for <code>/Outlines</code> in the document catalog
    and reports whether bookmarks exist. It's a simple metadata check,
    so it doesn't need complex pass/fail test fixtures.</p>
    <h3>Can you help?</h3>
    <p>If you know of a public, CORS-accessible PDF with bookmarks (or without),
    open an issue on GitHub and we'll add it to the test suite.</p>
  `;

  const win = new WinBox({
    title: 'Test PDFs: Bookmarks',
    mount: content,
    root,
    x: 'center',
    y: 'center',
    width: 440,
    height: 340,
    top: MENUBAR_HEIGHT,
    overflow: true,
    class: ['white', 'no-full', 'no-max', 'no-min'],
    border: 1,
  });

  setWinBoxAriaRole(win, 'Bookmarks');
}
