/**
 * Font inventory panel — tabular view of all fonts in the document.
 *
 * Pulls data from the 'font-tounicode' finding in the audit results
 * and renders it as an accessible HTML table with color-coded rows.
 */

/**
 * Render the font inventory table panel.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 */
export function renderFontTable(el, data) {
  const { findings } = data;

  el.innerHTML = '';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Font Inventory';
  heading.style.cssText = 'margin-bottom: var(--space-md); font-size: var(--font-size-xl);';
  el.appendChild(heading);

  // Find the font-tounicode finding
  const fontFinding = findings.find(f => f.id === 'font-tounicode');

  if (!fontFinding) {
    const empty = document.createElement('p');
    empty.textContent = 'No font audit data available.';
    empty.style.cssText = 'color: var(--color-text-muted);';
    el.appendChild(empty);
    return;
  }

  // Status badge for the overall finding
  const overallStatus = document.createElement('div');
  overallStatus.style.cssText = 'margin-bottom: var(--space-md);';

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${fontFinding.status}`;
  badge.textContent = formatStatus(fontFinding.status);
  overallStatus.appendChild(badge);

  const summaryText = document.createElement('p');
  summaryText.textContent = fontFinding.summary;
  summaryText.style.cssText = 'color: var(--color-text-secondary); margin-top: var(--space-xs);';
  overallStatus.appendChild(summaryText);

  el.appendChild(overallStatus);

  if (!fontFinding.details || fontFinding.details.length === 0) {
    const noData = document.createElement('p');
    noData.textContent = 'No font details available.';
    noData.style.cssText = 'color: var(--color-text-muted);';
    el.appendChild(noData);
    return;
  }

  // Parse font details into structured rows
  const fontRows = parseFontDetails(fontFinding.details);

  if (fontRows.length === 0) {
    const noFonts = document.createElement('p');
    noFonts.textContent = 'No individual font entries found.';
    noFonts.style.cssText = 'color: var(--color-text-muted);';
    el.appendChild(noFonts);
    return;
  }

  // Build the table
  const tableWrapper = document.createElement('div');
  tableWrapper.style.cssText = 'overflow-x: auto;';
  tableWrapper.setAttribute('role', 'region');
  tableWrapper.setAttribute('aria-label', 'Font inventory table');
  tableWrapper.tabIndex = 0;

  const table = document.createElement('table');
  table.style.cssText = [
    'width: 100%',
    'border-collapse: collapse',
    'font-size: var(--font-size-sm)',
  ].join('; ');

  // Caption
  const caption = document.createElement('caption');
  caption.textContent = `${fontRows.length} font(s) found in document`;
  caption.className = 'visually-hidden';
  table.appendChild(caption);

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const headers = ['Font Name', 'ToUnicode', 'Embedded'];
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    th.scope = 'col';
    th.style.cssText = [
      'text-align: left',
      'padding: var(--space-sm) var(--space-md)',
      'border-bottom: 2px solid var(--color-border)',
      'font-weight: 600',
      'color: var(--color-text-secondary)',
      'white-space: nowrap',
    ].join('; ');
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const row of fontRows) {
    const tr = document.createElement('tr');

    // Row color based on status
    if (!row.hasToUnicode) {
      tr.style.cssText = 'background: var(--color-warning-bg);';
    } else if (row.notEmbedded) {
      tr.style.cssText = 'background: var(--color-warning-bg);';
    }

    // Font name
    const tdName = document.createElement('td');
    tdName.textContent = row.name;
    tdName.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light); font-family: var(--font-mono); font-size: var(--font-size-sm);';
    tr.appendChild(tdName);

    // ToUnicode status
    const tdToUnicode = document.createElement('td');
    tdToUnicode.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light);';
    const toUnicodeBadge = document.createElement('span');
    toUnicodeBadge.className = `status-badge status-badge--${row.hasToUnicode ? 'pass' : 'warning'}`;
    toUnicodeBadge.textContent = row.hasToUnicode ? 'Yes' : 'No';
    tdToUnicode.appendChild(toUnicodeBadge);
    tr.appendChild(tdToUnicode);

    // Embedded status
    const tdEmbedded = document.createElement('td');
    tdEmbedded.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light);';
    const embeddedBadge = document.createElement('span');
    embeddedBadge.className = `status-badge status-badge--${row.notEmbedded ? 'warning' : 'pass'}`;
    embeddedBadge.textContent = row.notEmbedded ? 'No' : 'Yes';
    tdEmbedded.appendChild(embeddedBadge);
    tr.appendChild(tdEmbedded);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  tableWrapper.appendChild(table);
  el.appendChild(tableWrapper);

  // Remediation if applicable
  if (fontFinding.remediation) {
    const remediation = document.createElement('div');
    remediation.style.cssText = [
      'margin-top: var(--space-md)',
      'padding: var(--space-md)',
      'background: var(--color-surface-alt)',
      'border-radius: var(--radius-md)',
      'border-left: 4px solid var(--color-warning)',
    ].join('; ');

    const remediationHeading = document.createElement('h3');
    remediationHeading.textContent = 'Remediation';
    remediationHeading.style.cssText = 'font-size: var(--font-size-base); font-weight: 600; margin-bottom: var(--space-xs);';

    const remediationText = document.createElement('p');
    remediationText.textContent = fontFinding.remediation;
    remediationText.style.cssText = 'font-size: var(--font-size-sm); line-height: 1.5;';

    remediation.appendChild(remediationHeading);
    remediation.appendChild(remediationText);
    el.appendChild(remediation);
  }
}

/**
 * Parse the font finding details array into structured font row objects.
 *
 * The font finding details contain entries like:
 * - { label: "FontName", value: "Has ToUnicode" | "Missing ToUnicode" }
 * - { label: "FontName", value: "Not embedded" }
 * - { label: "Embedding summary", value: "..." }
 *
 * We merge these into per-font rows.
 *
 * @param {object[]} details
 * @returns {Array<{ name: string, hasToUnicode: boolean, notEmbedded: boolean }>}
 */
function parseFontDetails(details) {
  const fontMap = new Map();

  for (const d of details) {
    // Skip summary entries
    if (d.label === 'Embedding summary') continue;

    const name = d.label;
    if (!fontMap.has(name)) {
      fontMap.set(name, { name, hasToUnicode: true, notEmbedded: false });
    }

    const entry = fontMap.get(name);

    if (d.value === 'Missing ToUnicode') {
      entry.hasToUnicode = false;
    } else if (d.value === 'Has ToUnicode') {
      entry.hasToUnicode = true;
    } else if (d.value === 'Not embedded') {
      entry.notEmbedded = true;
    }
  }

  return [...fontMap.values()];
}

/**
 * Format a status string for display.
 *
 * @param {string} status
 * @returns {string}
 */
function formatStatus(status) {
  switch (status) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'warning': return 'Warning';
    case 'not-applicable': return 'N/A';
    default: return status;
  }
}
