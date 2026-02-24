/**
 * Image inventory panel — tabular view of all images/figures in the document.
 *
 * Pulls data from the 'image-alt-text' finding in the audit results
 * and renders it as an accessible HTML table with color-coded rows.
 */

/**
 * Render the image inventory table panel.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 */
export function renderImageTable(el, data) {
  const { findings } = data;

  el.innerHTML = '';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Image Inventory';
  heading.style.cssText = 'margin-bottom: var(--space-md); font-size: var(--font-size-xl);';
  el.appendChild(heading);

  // Find the image-alt-text finding
  const imageFinding = findings.find(f => f.id === 'image-alt-text');
  // Also get the decorative-images finding for additional context
  const decorativeFinding = findings.find(f => f.id === 'decorative-images');

  if (!imageFinding) {
    const empty = document.createElement('p');
    empty.textContent = 'No image audit data available.';
    empty.style.cssText = 'color: var(--color-text-muted);';
    el.appendChild(empty);
    return;
  }

  // Status badge for the overall finding
  const overallStatus = document.createElement('div');
  overallStatus.style.cssText = 'margin-bottom: var(--space-md);';

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${imageFinding.status}`;
  badge.textContent = formatStatus(imageFinding.status);
  overallStatus.appendChild(badge);

  const summaryText = document.createElement('p');
  summaryText.textContent = imageFinding.summary;
  summaryText.style.cssText = 'color: var(--color-text-secondary); margin-top: var(--space-xs);';
  overallStatus.appendChild(summaryText);

  el.appendChild(overallStatus);

  // Decorative images info
  if (decorativeFinding) {
    const decoSection = document.createElement('div');
    decoSection.style.cssText = 'margin-bottom: var(--space-md); display: flex; align-items: flex-start; gap: var(--space-sm);';

    const decoBadge = document.createElement('span');
    decoBadge.className = `status-badge status-badge--${decorativeFinding.status}`;
    decoBadge.textContent = formatStatus(decorativeFinding.status);
    decoBadge.style.cssText = 'flex-shrink: 0;';
    decoSection.appendChild(decoBadge);

    const decoText = document.createElement('span');
    decoText.textContent = decorativeFinding.summary;
    decoText.style.cssText = 'font-size: var(--font-size-sm); color: var(--color-text-secondary);';
    decoSection.appendChild(decoText);

    el.appendChild(decoSection);
  }

  if (!imageFinding.details || imageFinding.details.length === 0) {
    // No detail rows to render as a table
    if (imageFinding.status === 'not-applicable') {
      const noData = document.createElement('p');
      noData.textContent = 'No images found in the document.';
      noData.style.cssText = 'color: var(--color-text-muted);';
      el.appendChild(noData);
    }
    return;
  }

  // Parse image details into structured rows
  const imageRows = parseImageDetails(imageFinding);

  if (imageRows.length === 0) {
    return;
  }

  // Build the table
  const tableWrapper = document.createElement('div');
  tableWrapper.style.cssText = 'overflow-x: auto;';
  tableWrapper.setAttribute('role', 'region');
  tableWrapper.setAttribute('aria-label', 'Image inventory table');
  tableWrapper.tabIndex = 0;

  const table = document.createElement('table');
  table.style.cssText = [
    'width: 100%',
    'border-collapse: collapse',
    'font-size: var(--font-size-sm)',
  ].join('; ');

  // Caption
  const caption = document.createElement('caption');
  caption.textContent = `${imageRows.length} figure element(s) found`;
  caption.className = 'visually-hidden';
  table.appendChild(caption);

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const headers = ['Figure #', 'Has Alt Text', 'Alt Text'];
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
  for (const row of imageRows) {
    const tr = document.createElement('tr');

    // Row color based on alt text status
    if (!row.hasAltText) {
      tr.style.cssText = 'background: var(--color-fail-bg);';
    }

    // Figure number
    const tdNum = document.createElement('td');
    tdNum.textContent = row.label;
    tdNum.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light); font-weight: 600;';
    tr.appendChild(tdNum);

    // Has Alt Text status
    const tdHasAlt = document.createElement('td');
    tdHasAlt.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light);';
    const altBadge = document.createElement('span');
    altBadge.className = `status-badge status-badge--${row.hasAltText ? 'pass' : 'fail'}`;
    altBadge.textContent = row.hasAltText ? 'Yes' : 'No';
    tdHasAlt.appendChild(altBadge);
    tr.appendChild(tdHasAlt);

    // Alt text value
    const tdAltText = document.createElement('td');
    tdAltText.style.cssText = 'padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--color-border-light); max-width: 300px; overflow-wrap: break-word;';
    if (row.hasAltText) {
      tdAltText.textContent = row.altText;
    } else {
      const missingText = document.createElement('span');
      missingText.textContent = row.altText || 'No alt text';
      missingText.style.cssText = 'color: var(--color-fail); font-style: italic;';
      tdAltText.appendChild(missingText);
    }
    tr.appendChild(tdAltText);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  tableWrapper.appendChild(table);
  el.appendChild(tableWrapper);

  // Remediation if applicable
  if (imageFinding.remediation) {
    const remediation = document.createElement('div');
    remediation.style.cssText = [
      'margin-top: var(--space-md)',
      'padding: var(--space-md)',
      'background: var(--color-surface-alt)',
      'border-radius: var(--radius-md)',
      'border-left: 4px solid var(--color-fail)',
    ].join('; ');

    const remediationHeading = document.createElement('h3');
    remediationHeading.textContent = 'Remediation';
    remediationHeading.style.cssText = 'font-size: var(--font-size-base); font-weight: 600; margin-bottom: var(--space-xs);';

    const remediationText = document.createElement('p');
    remediationText.textContent = imageFinding.remediation;
    remediationText.style.cssText = 'font-size: var(--font-size-sm); line-height: 1.5;';

    remediation.appendChild(remediationHeading);
    remediation.appendChild(remediationText);
    el.appendChild(remediation);
  }
}

/**
 * Parse image finding details into structured row objects.
 *
 * The image-alt-text finding details look like:
 * - Pass case: { label: "Figure 1", value: "Alt text content" }
 * - Fail case: { label: "Figure without alt", value: "No /Alt attribute" | "Custom type ..." }
 * - Warning (no struct tree): { label: "Image XObjects", value: "3" }
 *
 * @param {object} finding
 * @returns {Array<{ label: string, hasAltText: boolean, altText: string }>}
 */
function parseImageDetails(finding) {
  const rows = [];

  if (finding.status === 'pass') {
    // Pass case: each detail is a figure with alt text
    for (const d of finding.details) {
      rows.push({
        label: d.label,
        hasAltText: true,
        altText: d.value,
      });
    }
  } else if (finding.status === 'fail') {
    // Fail case: details are figures WITHOUT alt text
    for (let i = 0; i < finding.details.length; i++) {
      const d = finding.details[i];
      rows.push({
        label: `Figure ${i + 1}`,
        hasAltText: false,
        altText: d.value,
      });
    }
  } else if (finding.status === 'warning') {
    // Warning case (e.g., no structure tree): may just be counts
    for (const d of finding.details) {
      // Skip numeric count details
      if (/^\d+$/.test(d.value)) continue;
      rows.push({
        label: d.label,
        hasAltText: false,
        altText: d.value,
      });
    }
  }

  return rows;
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
