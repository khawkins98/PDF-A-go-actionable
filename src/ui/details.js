/**
 * Details panel — shows full detail for a selected finding.
 *
 * Listens for 'selectFinding' events on the state bus and renders the
 * selected finding's title, status badge, summary, remediation text,
 * details array, WCAG/PDF/UA references, and UNDRR guidance sections.
 */

import { getUndrrItemForFinding, COMPLEMENTARY_TOOLS } from './undrr-checklist.js';

/**
 * Render the details panel into the given container element.
 *
 * Initially shows a placeholder message. Subscribes to selectFinding events
 * to render the selected finding from the data.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 * @param {import('./state.js').EventBus} bus - Scoped event bus for the session
 */
export function renderDetailsPanel(el, data, bus) {
  const { findings } = data;
  const context = { meta: data.meta || {} };

  // Build a lookup map by finding id
  const findingsMap = new Map();
  for (const f of findings) {
    findingsMap.set(f.id, f);
  }

  // Show placeholder initially
  renderPlaceholder(el);

  // Listen for finding selection
  const unsub = bus.on('selectFinding', ({ findingId }) => {
    const finding = findingsMap.get(findingId);
    if (finding) {
      renderFinding(el, finding, context);
    }
  });

  // If there's already a selected finding (late subscriber), show it
  const selected = bus.getSelectedFinding();
  if (selected) {
    const finding = findingsMap.get(selected.findingId);
    if (finding) {
      renderFinding(el, finding, context);
    }
  }

  return unsub;
}

/**
 * Render the placeholder state.
 *
 * @param {HTMLElement} el
 */
function renderPlaceholder(el) {
  el.innerHTML = '';

  const placeholder = document.createElement('div');
  placeholder.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'min-height: 200px',
    'color: var(--color-text-muted)',
    'font-style: italic',
  ].join('; ');
  placeholder.setAttribute('role', 'status');
  placeholder.textContent = 'Select a finding from the list to see details.';

  el.appendChild(placeholder);
}

/**
 * Render the full details for a finding.
 *
 * @param {HTMLElement} el
 * @param {object} finding - A Finding object
 * @param {object} [context] - Optional context with meta for guidance
 */
function renderFinding(el, finding, context = {}) {
  el.innerHTML = '';

  // Header area with status badge and title
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: var(--space-md);';

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${finding.status}`;
  badge.textContent = formatStatus(finding.status);

  const title = document.createElement('h2');
  title.style.cssText = 'margin-top: var(--space-sm); font-size: var(--font-size-xl);';
  title.textContent = finding.title;

  header.appendChild(badge);
  header.appendChild(title);
  el.appendChild(header);

  // Summary
  const summarySection = document.createElement('section');
  summarySection.setAttribute('aria-label', 'Summary');
  summarySection.style.cssText = 'margin-bottom: var(--space-md);';

  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = 'Summary';
  summaryHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-xs);';

  const summaryText = document.createElement('p');
  summaryText.textContent = finding.summary;
  summaryText.style.cssText = 'color: var(--color-text-secondary); line-height: 1.5;';

  summarySection.appendChild(summaryHeading);
  summarySection.appendChild(summaryText);
  el.appendChild(summarySection);

  // Details array
  if (finding.details && finding.details.length > 0) {
    const detailsSection = document.createElement('section');
    detailsSection.setAttribute('aria-label', 'Details');
    detailsSection.style.cssText = 'margin-bottom: var(--space-md);';

    const detailsHeading = document.createElement('h3');
    detailsHeading.textContent = 'Details';
    detailsHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    detailsSection.appendChild(detailsHeading);

    const dl = document.createElement('dl');
    dl.style.cssText = 'display: grid; grid-template-columns: auto 1fr; gap: var(--space-xs) var(--space-md);';

    for (const detail of finding.details) {
      const dt = document.createElement('dt');
      dt.textContent = detail.label;
      dt.style.cssText = 'font-weight: 600; color: var(--color-text-secondary); white-space: nowrap;';

      const dd = document.createElement('dd');
      dd.style.cssText = 'margin: 0; overflow-wrap: break-word;';

      // Detect URLs and make them clickable
      if (isUrl(detail.value)) {
        const link = document.createElement('a');
        link.href = detail.value;
        link.textContent = detail.value;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color: var(--color-primary); text-decoration: underline;';
        dd.appendChild(link);
      } else {
        dd.textContent = detail.value;
      }

      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    detailsSection.appendChild(dl);
    el.appendChild(detailsSection);
  }

  // Remediation
  if (finding.remediation) {
    const remediationSection = document.createElement('section');
    remediationSection.setAttribute('aria-label', 'Remediation');
    remediationSection.style.cssText = [
      'margin-bottom: var(--space-md)',
      'padding: var(--space-md)',
      'background: var(--color-surface-alt)',
      'border-radius: var(--radius-md)',
      'border-left: 4px solid var(--color-primary)',
    ].join('; ');

    const remediationHeading = document.createElement('h3');
    remediationHeading.textContent = 'How to Fix';
    remediationHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-xs);';

    const remediationText = document.createElement('p');
    remediationText.textContent = finding.remediation;
    remediationText.style.cssText = 'line-height: 1.5;';

    remediationSection.appendChild(remediationHeading);
    remediationSection.appendChild(remediationText);
    el.appendChild(remediationSection);
  }

  // References (WCAG / PDF/UA)
  if (finding.wcagRef || finding.pdfuaRef) {
    const refsSection = document.createElement('section');
    refsSection.setAttribute('aria-label', 'References');
    refsSection.style.cssText = 'margin-bottom: var(--space-md);';

    const refsHeading = document.createElement('h3');
    refsHeading.textContent = 'References';
    refsHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    refsSection.appendChild(refsHeading);

    const refsList = document.createElement('ul');
    refsList.style.cssText = 'list-style: none; display: flex; flex-direction: column; gap: var(--space-xs);';

    if (finding.wcagRef) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `https://www.w3.org/WAI/WCAG21/Understanding/${wcagRefToSlug(finding.wcagRef)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `WCAG 2.1 SC ${finding.wcagRef}`;
      link.style.cssText = 'color: var(--color-primary); text-decoration: underline;';
      li.appendChild(link);
      refsList.appendChild(li);
    }

    if (finding.pdfuaRef) {
      const li = document.createElement('li');
      li.style.cssText = 'color: var(--color-text-secondary);';
      li.textContent = `PDF/UA-1 clause ${finding.pdfuaRef}`;
      refsList.appendChild(li);
    }

    refsSection.appendChild(refsList);
    el.appendChild(refsSection);
  }

  // === UNDRR Guidance sections ===
  const undrrItem = getUndrrItemForFinding(finding.id);
  if (undrrItem) {
    // "Why This Matters" section
    const whySection = document.createElement('section');
    whySection.setAttribute('aria-label', 'Why This Matters');
    whySection.style.cssText = [
      'margin-bottom: var(--space-md)',
      'padding: var(--space-md)',
      'background: var(--color-surface-alt)',
      'border-radius: var(--radius-md)',
      'border-left: 4px solid var(--color-manual)',
    ].join('; ');

    const whyHeading = document.createElement('h3');
    whyHeading.textContent = 'Why This Matters';
    whyHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-xs);';
    const whyText = document.createElement('p');
    whyText.textContent = undrrItem.whyItMatters;
    whyText.style.cssText = 'line-height: 1.5; color: var(--color-text-secondary);';
    whySection.appendChild(whyHeading);
    whySection.appendChild(whyText);
    el.appendChild(whySection);

    // "Fix in Your Authoring Tool" section
    const tipsSection = document.createElement('section');
    tipsSection.setAttribute('aria-label', 'Authoring Tool Tips');
    tipsSection.style.cssText = 'margin-bottom: var(--space-md);';

    const tipsHeading = document.createElement('h3');
    tipsHeading.textContent = 'Fix in Your Authoring Tool';
    tipsHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    tipsSection.appendChild(tipsHeading);

    // Detect primary authoring tool from creator/producer metadata
    const detectedTool = detectAuthoringTool(context.meta);

    const tipEntries = [
      { key: 'general', label: 'General' },
      { key: 'word', label: 'Microsoft Word' },
      { key: 'indesign', label: 'Adobe InDesign' },
      { key: 'powerpoint', label: 'Microsoft PowerPoint' },
      { key: 'acrobat', label: 'Adobe Acrobat' },
    ];

    const tipsList = document.createElement('dl');
    tipsList.className = 'details__tips-list';
    tipsList.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-sm);';

    for (const entry of tipEntries) {
      const tip = undrrItem.authoringTips[entry.key];
      if (!tip) continue;

      const dt = document.createElement('dt');
      dt.style.cssText = 'font-weight: 600; font-size: var(--font-size-sm);';
      dt.textContent = entry.label;

      if (detectedTool === entry.key) {
        const highlight = document.createElement('span');
        highlight.className = 'details__tip-detected';
        highlight.textContent = ' (detected)';
        highlight.style.cssText = 'color: var(--color-pass); font-weight: 400; font-size: var(--font-size-sm);';
        dt.appendChild(highlight);
      }

      const dd = document.createElement('dd');
      dd.style.cssText = 'margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5;';
      dd.textContent = tip;

      tipsList.appendChild(dt);
      tipsList.appendChild(dd);
    }

    tipsSection.appendChild(tipsList);
    el.appendChild(tipsSection);

    // "Complementary Tools" section
    if (undrrItem.complementaryTools && undrrItem.complementaryTools.length > 0) {
      const toolsSection = document.createElement('section');
      toolsSection.setAttribute('aria-label', 'Complementary Tools');
      toolsSection.style.cssText = 'margin-bottom: var(--space-md);';

      const toolsHeading = document.createElement('h3');
      toolsHeading.textContent = 'Complementary Tools';
      toolsHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
      toolsSection.appendChild(toolsHeading);

      const toolsList = document.createElement('ul');
      toolsList.style.cssText = 'list-style: none; display: flex; flex-direction: column; gap: var(--space-xs);';

      for (const toolKey of undrrItem.complementaryTools) {
        const tool = COMPLEMENTARY_TOOLS[toolKey];
        if (!tool) continue;

        const li = document.createElement('li');
        li.style.cssText = 'font-size: var(--font-size-sm);';

        if (tool.url) {
          const link = document.createElement('a');
          link.href = tool.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = tool.name;
          link.style.cssText = 'color: var(--color-primary); text-decoration: underline; font-weight: 600;';
          li.appendChild(link);
        } else {
          const name = document.createElement('strong');
          name.textContent = tool.name;
          li.appendChild(name);
        }

        const desc = document.createTextNode(` -- ${tool.role} (${tool.platform})`);
        li.appendChild(desc);
        toolsList.appendChild(li);
      }

      toolsSection.appendChild(toolsList);
      el.appendChild(toolsSection);
    }
  }
}

/**
 * Detect the primary authoring tool from creator/producer metadata.
 *
 * @param {object} meta - Document metadata
 * @returns {string|null} Tool key ('word', 'indesign', 'powerpoint', 'acrobat') or null
 */
function detectAuthoringTool(meta) {
  if (!meta) return null;
  const str = `${meta.creator || ''} ${meta.producer || ''}`.toLowerCase();
  if (str.includes('powerpoint')) return 'powerpoint';
  if (str.includes('word')) return 'word';
  if (str.includes('indesign')) return 'indesign';
  if (str.includes('acrobat')) return 'acrobat';
  return null;
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
    case 'manual': return 'Manual Review';
    case 'not-applicable': return 'Not Applicable';
    default: return status;
  }
}

/**
 * Check if a string looks like a URL.
 *
 * @param {string} str
 * @returns {boolean}
 */
function isUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return /^https?:\/\//i.test(str.trim());
}

/**
 * Convert a WCAG SC number to its understanding-doc slug.
 * This is a best-effort mapping; falls back to the SC number.
 *
 * @param {string} ref - e.g., "1.3.1"
 * @returns {string}
 */
function wcagRefToSlug(ref) {
  const slugMap = {
    '1.1.1': 'non-text-content',
    '1.3.1': 'info-and-relationships',
    '1.3.2': 'meaningful-sequence',
    '2.4.2': 'page-titled',
    '2.4.3': 'focus-order',
    '2.4.4': 'link-purpose-in-context',
    '2.4.5': 'multiple-ways',
    '3.1.1': 'language-of-page',
    '3.1.2': 'language-of-parts',
  };
  return slugMap[ref] || ref;
}
