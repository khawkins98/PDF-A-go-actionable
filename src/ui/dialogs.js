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
  content.className = 'dialog-content';
  content.setAttribute('tabindex', '-1');
  content.innerHTML = `
    <h2>PDF-A-go-actionable</h2>
    <p style="color:var(--color-text);font-size:var(--font-size-base);">Version 1.3.0</p>
    <p>Free, browser-based PDF accessibility checker. Everything runs
    in your browser. No uploads, no accounts.</p>
    <p>Checks the ~13 things that most affect whether people can use
    your PDF with a screen reader. Not a PDF/UA conformance validator;
    for full standard compliance, use PAC or veraPDF.</p>
    <h3>Built With</h3>
    <ul>
      <li><a href="https://github.com/Hopding/pdf-lib" target="_blank" rel="noopener noreferrer"><strong>pdf-lib</strong></a> -- PDF object access (MIT)</li>
      <li><a href="https://github.com/101arrowz/fflate" target="_blank" rel="noopener noreferrer"><strong>fflate</strong></a> -- stream decompression (MIT)</li>
      <li><a href="https://github.com/nextapps-de/winbox" target="_blank" rel="noopener noreferrer"><strong>WinBox</strong></a> -- window management (Apache-2.0)</li>
      <li><a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener noreferrer"><strong>PDF.js</strong></a> -- PDF rendering (Apache-2.0)</li>
    </ul>
    <h3>Why NeXTSTEP?</h3>
    <p>PDF has <a href="https://en.wikipedia.org/wiki/NeXTSTEP" target="_blank" rel="noopener noreferrer">NeXTSTEP</a>
    in its DNA. NeXT's display engine was built on Adobe's
    <a href="https://en.wikipedia.org/wiki/Display_PostScript" target="_blank" rel="noopener noreferrer">Display PostScript</a>,
    and <a href="https://en.wikipedia.org/wiki/PDF#History" target="_blank" rel="noopener noreferrer">PDF itself</a>
    grew out of PostScript. When Apple acquired NeXT in 1997, that technology became
    <a href="https://en.wikipedia.org/wiki/Quartz_(graphics_layer)" target="_blank" rel="noopener noreferrer">Quartz</a>,
    the macOS graphics layer that renders PDF natively. A PDF accessibility tool in
    a NeXTSTEP-inspired interface is a small nod to that lineage.</p>
    <p>Source: <a href="https://github.com/khawkins98/PDF-A-go-actionable" target="_blank" rel="noopener noreferrer">github.com/khawkins98/PDF-A-go-actionable</a> (MIT)</p>
    <p><a href="https://github.com/khawkins98/PDF-A-go-actionable/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a></p>
  `;

  const win = new WinBox({
    title: 'About',
    mount: content,
    root,
    x: 'center',
    y: 'center',
    width: 420,
    height: 580,
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
