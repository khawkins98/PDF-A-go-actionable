/**
 * Summary panel — renders overall audit results.
 *
 * Shows pass/fail/warning/manual/not-applicable counts, document metadata,
 * and traffic-light status indicators.
 */

/**
 * Render the summary panel into the given container element.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 * @param {object} data.meta - Document metadata
 * @param {import('./state.js').EventBus} [bus] - Optional scoped event bus for filter events
 */
export function renderSummaryPanel(el, data, bus) {
  const { findings, meta } = data;

  // Count statuses
  const counts = { pass: 0, fail: 0, warning: 0, manual: 0, 'not-applicable': 0 };
  for (const f of findings) {
    if (f.status in counts) {
      counts[f.status]++;
    }
  }

  const totalChecked = counts.pass + counts.fail + counts.warning;
  const overallStatus = counts.fail > 0 ? 'fail' : counts.warning > 0 ? 'warning' : 'pass';

  el.innerHTML = '';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Accessibility Summary';
  heading.style.cssText = 'margin-bottom: var(--space-md); font-size: var(--font-size-2xl);';
  el.appendChild(heading);

  // Overall status badge
  const overallSection = document.createElement('div');
  overallSection.style.cssText = 'margin-bottom: var(--space-lg); padding: var(--space-md); background: var(--color-surface-alt); border-radius: var(--radius-md);';

  const overallBadge = document.createElement('span');
  overallBadge.className = `status-badge status-badge--${overallStatus}`;
  overallBadge.textContent = overallStatus === 'pass' ? 'All Checks Passed' : overallStatus === 'fail' ? 'Issues Found' : 'Warnings';
  overallSection.appendChild(overallBadge);

  const overallText = document.createElement('p');
  overallText.style.cssText = 'margin-top: var(--space-sm); color: var(--color-text-secondary);';
  overallText.textContent = `${counts.pass} passed, ${counts.fail} failed, ${counts.warning} warning(s), ${counts.manual} manual review, ${counts['not-applicable']} not applicable.`;
  overallSection.appendChild(overallText);

  el.appendChild(overallSection);

  // Status counts as a list
  const countsHeading = document.createElement('h3');
  countsHeading.textContent = 'Check Results';
  countsHeading.style.cssText = 'margin-bottom: var(--space-sm); font-size: var(--font-size-lg);';
  el.appendChild(countsHeading);

  const countsList = document.createElement('ul');
  countsList.style.cssText = 'list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-lg);';
  countsList.setAttribute('role', 'list');

  const statusLabels = [
    { key: 'pass', label: 'Pass' },
    { key: 'fail', label: 'Fail' },
    { key: 'warning', label: 'Warning' },
    { key: 'manual', label: 'Manual Review' },
    { key: 'not-applicable', label: 'N/A' },
  ];

  /** Active filter set — all statuses start active. */
  const activeFilters = new Set(statusLabels.map((s) => s.key));

  for (const { key, label } of statusLabels) {
    const li = document.createElement('li');
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = `status-badge status-badge--${key} status-filter`;
    badge.textContent = `${counts[key]} ${label}`;
    badge.dataset.status = key;
    badge.setAttribute('aria-label', `Filter ${label}: ${counts[key]} checks`);
    badge.setAttribute('aria-pressed', 'true');

    badge.addEventListener('click', () => {
      if (activeFilters.has(key)) {
        activeFilters.delete(key);
        badge.classList.add('status-filter--inactive');
        badge.setAttribute('aria-pressed', 'false');
      } else {
        activeFilters.add(key);
        badge.classList.remove('status-filter--inactive');
        badge.setAttribute('aria-pressed', 'true');
      }
      if (bus) {
        bus.emit('filterStatus', { active: new Set(activeFilters) });
      }
    });

    li.appendChild(badge);
    countsList.appendChild(li);
  }

  el.appendChild(countsList);

  // Document metadata
  const metaHeading = document.createElement('h3');
  metaHeading.textContent = 'Document Information';
  metaHeading.style.cssText = 'margin-bottom: var(--space-sm); font-size: var(--font-size-lg);';
  el.appendChild(metaHeading);

  const metaTable = document.createElement('dl');
  metaTable.style.cssText = 'display: grid; grid-template-columns: auto 1fr; gap: var(--space-xs) var(--space-md); margin-bottom: var(--space-md);';

  const metaItems = [
    { label: 'Title', value: meta.title || 'Not set' },
    { label: 'Language', value: meta.lang || 'Not set' },
    { label: 'Pages', value: meta.pageCount != null ? String(meta.pageCount) : 'Unknown' },
    { label: 'File Size', value: formatFileSize(meta.fileSize) },
    { label: 'File Name', value: meta.fileName || 'Unknown' },
    { label: 'PDF/A', value: meta.isPdfA ? `Yes (${meta.pdfALevel || 'level unknown'})` : 'No' },
    { label: 'PDF/UA', value: meta.isPdfUA ? 'Yes' : 'No' },
    { label: 'Tagged', value: meta.isTagged ? (meta.hasSuspects ? 'Yes (suspects)' : 'Yes') : 'No' },
    { label: 'Structure Tree', value: meta.hasStructTree ? 'Yes' : 'No' },
    { label: 'Display Doc Title', value: meta.displayDocTitle ? 'Yes' : 'No' },
  ];

  for (const item of metaItems) {
    const dt = document.createElement('dt');
    dt.textContent = item.label;
    dt.style.cssText = 'font-weight: 600; color: var(--color-text-secondary); white-space: nowrap;';

    const dd = document.createElement('dd');
    dd.textContent = item.value;
    dd.style.cssText = 'margin: 0; overflow-wrap: break-word;';

    metaTable.appendChild(dt);
    metaTable.appendChild(dd);
  }

  el.appendChild(metaTable);
}

/**
 * Format bytes into a human-readable file size string.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
