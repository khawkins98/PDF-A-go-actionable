/**
 * Report Dashboard — high-level report card view.
 *
 * Shows an at-a-glance summary of audit results grouped by status,
 * with action buttons to drill into the full detailed report.
 * This is the initial view shown in the results window.
 */

import { formatFileSize } from './report.js';
import { STATUS_GROUPS } from './constants.js';

/**
 * Render the report dashboard into a container element.
 *
 * @param {HTMLElement} el - Container to render into
 * @param {object} data - Audit result { findings, meta, structureTree }
 * @param {object} callbacks
 * @param {function} callbacks.onViewFullReport - Switch to the detailed findings view
 * @param {function} callbacks.onPreviewPdf - Open the PDF preview floating panel
 * @param {function(string)} callbacks.onExport - Export in given format ('json'|'csv'|'pdf')
 * @param {function} callbacks.onUploadAnother - Open file picker for another PDF
 */
export function renderDashboard(el, data, callbacks) {
  const { findings, meta } = data;

  // Abort any previous document-level listeners from a prior render
  if (el._dashboardAbort) el._dashboardAbort.abort();
  const abort = new AbortController();
  el._dashboardAbort = abort;

  // Group findings by status
  const groups = {};
  for (const g of STATUS_GROUPS) groups[g.key] = [];
  for (const f of findings) {
    if (groups[f.status]) groups[f.status].push(f);
  }

  // Overall verdict — three tiers
  const failCount = groups.fail.length;
  const warnCount = groups.warning.length;
  const manualCount = groups.manual.length;
  const passCount = groups.pass.length;
  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';

  el.innerHTML = '';
  el.classList.add('dashboard');

  // === Verdict banner ===
  const verdict = document.createElement('div');
  verdict.className = `dashboard__verdict dashboard__verdict--${overallStatus}`;
  verdict.setAttribute('role', 'status');

  const verdictTitle = document.createElement('h2');
  verdictTitle.className = 'dashboard__verdict-title';
  verdictTitle.textContent = 'PDF Accessibility Report';
  verdict.appendChild(verdictTitle);

  const verdictLabel = document.createElement('div');
  verdictLabel.className = 'dashboard__verdict-label';

  const verdictDesc = document.createElement('p');
  verdictDesc.className = 'dashboard__verdict-desc';

  if (overallStatus === 'pass') {
    verdictLabel.textContent = 'PASS';
    if (passCount === 0 && manualCount === 0) {
      verdictDesc.textContent = 'No checks were performed.';
    } else if (manualCount > 0) {
      verdictDesc.textContent = `All ${passCount} automated checks passed. ${manualCount} item${manualCount !== 1 ? 's' : ''} flagged for manual review.`;
    } else {
      verdictDesc.textContent = `All ${passCount} automated checks passed.`;
    }
  } else if (overallStatus === 'warning') {
    verdictLabel.textContent = 'PASS WITH WARNINGS';
    verdictDesc.textContent = `No failures, but ${warnCount} warning${warnCount !== 1 ? 's' : ''} need review. ${passCount} check${passCount !== 1 ? 's' : ''} passed.`;
  } else {
    verdictLabel.textContent = 'FAIL';
    verdictDesc.textContent = `${failCount} accessibility issue${failCount !== 1 ? 's' : ''} must be fixed. ${passCount} check${passCount !== 1 ? 's' : ''} passed.`;
  }

  verdict.appendChild(verdictLabel);
  verdict.appendChild(verdictDesc);
  el.appendChild(verdict);

  // === Header section ===
  const header = document.createElement('div');
  header.className = 'dashboard__header';

  // File info
  const fileInfo = document.createElement('div');
  fileInfo.className = 'dashboard__file-info';

  const fileName = document.createElement('h3');
  fileName.className = 'dashboard__file-name';
  fileName.textContent = meta.fileName || 'Unknown file';
  fileInfo.appendChild(fileName);

  const fileFacts = buildFileFacts(meta);
  fileInfo.appendChild(fileFacts);

  header.appendChild(fileInfo);

  // Document Properties — inline in the header for at-a-glance visibility
  const metaGrid = document.createElement('dl');
  metaGrid.className = 'dashboard__meta-grid';

  const metaItems = [
    // Accessibility-critical fields (always shown, warn when empty)
    { label: 'Title', value: meta.title, warn: !meta.title },
    { label: 'Author', value: meta.author, warn: !meta.author },
    { label: 'Subject', value: meta.subject, warn: !meta.subject },
    { label: 'Keywords', value: meta.keywords, warn: !meta.keywords },
    { label: 'Language', value: meta.lang, warn: !meta.lang },
    { label: 'Pages', value: meta.pageCount != null ? String(meta.pageCount) : 'Unknown' },
    { label: 'File Size', value: formatFileSize(meta.fileSize) },
    { label: 'Tagged', value: meta.isTagged ? 'Yes' : 'No', warn: !meta.isTagged },
    { label: 'PDF/UA', value: meta.isPdfUA ? 'Yes' : 'No' },
    { label: 'PDF/A', value: meta.isPdfA ? `Yes (${meta.pdfALevel || 'level unknown'})` : 'No' },
    { label: 'Display Doc Title', value: meta.displayDocTitle ? 'Yes' : 'No', warn: !meta.displayDocTitle },
    { label: 'Structure Tree', value: meta.hasStructTree ? 'Yes' : 'No' },
  ];

  // Tool metadata (only shown when present)
  if (meta.creator) metaItems.push({ label: 'Creator', value: meta.creator });
  if (meta.producer) metaItems.push({ label: 'Producer', value: meta.producer });

  for (const item of metaItems) {
    const dt = document.createElement('dt');
    dt.textContent = item.label;
    const dd = document.createElement('dd');
    dd.textContent = item.value || 'Not set';
    if (item.warn) {
      dd.className = 'dashboard__meta-warn';
    }
    metaGrid.appendChild(dt);
    metaGrid.appendChild(dd);
  }

  header.appendChild(metaGrid);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'dashboard__actions';

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'toolbar-btn dashboard__action-btn';
  viewBtn.textContent = 'View Full Report';
  viewBtn.addEventListener('click', () => callbacks.onViewFullReport());
  actions.appendChild(viewBtn);

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'toolbar-btn dashboard__action-btn';
  previewBtn.textContent = 'Preview PDF';
  previewBtn.addEventListener('click', () => callbacks.onPreviewPdf());
  actions.appendChild(previewBtn);

  // Export dropdown button
  const exportWrap = document.createElement('div');
  exportWrap.className = 'dashboard__export-wrap';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'toolbar-btn dashboard__action-btn';
  exportBtn.setAttribute('aria-haspopup', 'true');
  exportBtn.setAttribute('aria-expanded', 'false');
  exportBtn.textContent = 'Download Report \u25BE';

  const menuId = `export-menu-${Date.now()}`;
  exportBtn.setAttribute('aria-controls', menuId);

  const exportMenu = document.createElement('div');
  exportMenu.className = 'dashboard__export-menu';
  exportMenu.id = menuId;
  exportMenu.setAttribute('role', 'menu');
  exportMenu.hidden = true;

  const menuItems = [];
  for (const [format, label] of [['json', 'JSON'], ['csv', 'CSV'], ['pdf', 'PDF']]) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'dashboard__export-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '-1');
    item.textContent = `Export as ${label}`;
    item.addEventListener('click', () => {
      closeExportMenu();
      callbacks.onExport(format);
    });
    exportMenu.appendChild(item);
    menuItems.push(item);
  }

  function openExportMenu() {
    exportMenu.hidden = false;
    exportBtn.setAttribute('aria-expanded', 'true');
    if (menuItems.length > 0) menuItems[0].focus();
  }

  function closeExportMenu() {
    exportMenu.hidden = true;
    exportBtn.setAttribute('aria-expanded', 'false');
  }

  exportBtn.addEventListener('click', () => {
    if (exportMenu.hidden) {
      openExportMenu();
    } else {
      closeExportMenu();
    }
  });

  // Keyboard navigation for export menu (ARIA menu pattern)
  exportBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (exportMenu.hidden) {
        e.preventDefault();
        openExportMenu();
      }
    }
  });

  exportMenu.addEventListener('keydown', (e) => {
    const items = menuItems;
    const idx = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0].focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1].focus();
        break;
      case 'Escape':
        e.preventDefault();
        closeExportMenu();
        exportBtn.focus();
        break;
      case 'Tab':
        closeExportMenu();
        break;
    }
  });

  // Close export menu when clicking outside (uses AbortController for cleanup)
  document.addEventListener('click', (e) => {
    if (!exportWrap.contains(e.target) && !exportMenu.hidden) {
      closeExportMenu();
    }
  }, { signal: abort.signal });

  exportWrap.appendChild(exportBtn);
  exportWrap.appendChild(exportMenu);
  actions.appendChild(exportWrap);

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'toolbar-btn dashboard__action-btn';
  uploadBtn.textContent = 'Upload Another PDF';
  uploadBtn.addEventListener('click', () => callbacks.onUploadAnother());
  actions.appendChild(uploadBtn);

  header.appendChild(actions);
  el.appendChild(header);

  // === Status group sections ===
  for (const group of STATUS_GROUPS) {
    const items = groups[group.key];
    if (items.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'dashboard__section';
    section.setAttribute('aria-label', group.heading);

    const heading = document.createElement('h3');
    heading.className = 'dashboard__section-heading';
    heading.innerHTML = `${escapeHtml(group.heading)} &middot; <span>${items.length} check${items.length !== 1 ? 's' : ''}</span>`;
    section.appendChild(heading);

    const content = document.createElement('div');
    content.className = `dashboard__section-content dashboard__section-content--${group.density}`;

    if (group.density === 'full') {
      // Full-width rows for fail and warning findings
      for (const f of items) {
        const row = document.createElement('div');
        row.className = 'dashboard__finding-row';

        const badge = document.createElement('span');
        badge.className = `status-badge status-badge--${f.status}`;
        badge.textContent = group.icon;
        row.appendChild(badge);

        const info = document.createElement('div');
        info.className = 'dashboard__finding-info';

        const title = document.createElement('strong');
        title.className = 'dashboard__finding-title';
        title.textContent = f.title;
        info.appendChild(title);

        const summary = document.createElement('p');
        summary.className = 'dashboard__finding-summary';
        summary.textContent = f.summary;
        info.appendChild(summary);

        row.appendChild(info);
        content.appendChild(row);
      }
    } else if (group.density === 'compact') {
      // Compact cards for manual review
      for (const f of items) {
        const card = document.createElement('div');
        card.className = 'dashboard__finding-compact';

        const badge = document.createElement('span');
        badge.className = `status-badge status-badge--${f.status}`;
        badge.textContent = group.icon;
        card.appendChild(badge);

        const title = document.createElement('strong');
        title.className = 'dashboard__finding-title';
        title.textContent = f.title;
        card.appendChild(title);

        const summary = document.createElement('p');
        summary.className = 'dashboard__finding-summary';
        summary.textContent = f.summary;
        card.appendChild(summary);

        content.appendChild(card);
      }
    } else {
      // Chip list for pass and not-applicable
      for (const f of items) {
        const chip = document.createElement('span');
        chip.className = `dashboard__chip dashboard__chip--${group.key}`;
        chip.textContent = `${group.icon} ${f.title}`;
        content.appendChild(chip);
      }
    }

    section.appendChild(content);
    el.appendChild(section);
  }

}

/**
 * Build the file facts line (pages, size, tagged, language).
 */
function buildFileFacts(meta) {
  const parts = [];
  if (meta.pageCount != null) parts.push(`${meta.pageCount} page${meta.pageCount !== 1 ? 's' : ''}`);
  if (meta.fileSize) parts.push(formatFileSize(meta.fileSize));
  if (meta.isTagged) parts.push('Tagged');
  if (meta.isPdfUA) parts.push('PDF/UA');
  if (meta.lang) parts.push(meta.lang);

  const p = document.createElement('p');
  p.className = 'dashboard__file-facts';
  p.textContent = parts.join(' \u00B7 ');
  return p;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
