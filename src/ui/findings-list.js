/**
 * Findings list panel — grouped, sorted, clickable finding cards.
 *
 * Groups findings by category and sorts within each group:
 * fail > warning > manual > pass > not-applicable.
 * Clicking a finding dispatches a 'selectFinding' event on the state bus.
 */

/** Sort priority for finding statuses (lower = higher priority). */
const STATUS_ORDER = {
  fail: 0,
  warning: 1,
  manual: 2,
  pass: 3,
  'not-applicable': 4,
};

/** Human-readable category labels. */
const CATEGORY_LABELS = {
  metadata: 'Metadata',
  structure: 'Structure',
  images: 'Images',
  tables: 'Tables',
  lists: 'Lists',
  fonts: 'Fonts',
  forms: 'Forms',
  links: 'Links',
  'reading-order': 'Reading Order',
  document: 'Document',
};

/**
 * Render the findings list panel into the given container element.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 * @param {import('./state.js').EventBus} bus - Scoped event bus for the session
 */
export function renderFindingsPanel(el, data, bus) {
  const { findings } = data;

  el.innerHTML = '';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Findings';
  heading.style.cssText = 'margin-bottom: var(--space-md); font-size: var(--font-size-xl);';
  el.appendChild(heading);

  if (!findings || findings.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No findings to display.';
    empty.style.cssText = 'color: var(--color-text-muted);';
    el.appendChild(empty);
    return;
  }

  // Group findings by category
  const groups = new Map();
  for (const finding of findings) {
    const cat = finding.category || 'other';
    if (!groups.has(cat)) {
      groups.set(cat, []);
    }
    groups.get(cat).push(finding);
  }

  // Sort within each group by status priority
  for (const [, group] of groups) {
    group.sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 5;
      const orderB = STATUS_ORDER[b.status] ?? 5;
      return orderA - orderB;
    });
  }

  // Preserve a meaningful category order
  const categoryOrder = [
    'document', 'metadata', 'structure', 'images', 'tables',
    'lists', 'fonts', 'forms', 'links', 'reading-order',
  ];
  const sortedCategories = [...groups.keys()].sort((a, b) => {
    const idxA = categoryOrder.indexOf(a);
    const idxB = categoryOrder.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  // Track selected finding for visual highlight
  let selectedCard = null;

  for (const category of sortedCategories) {
    const group = groups.get(category);
    const groupEl = document.createElement('section');
    groupEl.setAttribute('aria-label', `${CATEGORY_LABELS[category] || category} findings`);
    groupEl.style.cssText = 'margin-bottom: var(--space-lg);';

    const groupHeading = document.createElement('h3');
    groupHeading.textContent = CATEGORY_LABELS[category] || category;
    groupHeading.style.cssText = 'margin-bottom: var(--space-sm); font-size: var(--font-size-lg); color: var(--color-text-secondary); text-transform: capitalize;';
    groupEl.appendChild(groupHeading);

    const list = document.createElement('ul');
    list.style.cssText = 'list-style: none; display: flex; flex-direction: column; gap: var(--space-xs);';
    list.setAttribute('role', 'list');

    for (const finding of group) {
      const li = document.createElement('li');

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'finding-card';
      card.setAttribute('aria-label', `${finding.title}: ${finding.status}`);
      card.style.cssText = [
        'display: flex',
        'align-items: flex-start',
        'gap: var(--space-sm)',
        'width: 100%',
        'text-align: left',
        'font: inherit',
      ].join('; ');

      card.addEventListener('click', () => {
        if (selectedCard) selectedCard.classList.remove('finding-card--selected');
        card.classList.add('finding-card--selected');
        selectedCard = card;
        bus.emit('selectFinding', { findingId: finding.id });
      });

      // Status badge
      const badge = document.createElement('span');
      badge.className = `status-badge status-badge--${finding.status}`;
      badge.textContent = formatStatus(finding.status);
      badge.style.cssText = 'flex-shrink: 0; margin-top: 2px;';

      // Content area
      const content = document.createElement('div');
      content.style.cssText = 'min-width: 0;';

      const title = document.createElement('strong');
      title.textContent = finding.title;
      title.style.cssText = 'display: block; font-size: var(--font-size-base); line-height: 1.3;';

      const summary = document.createElement('span');
      summary.textContent = finding.summary;
      summary.className = 'finding-card__summary';
      summary.style.cssText = 'display: block; font-size: var(--font-size-sm); line-height: 1.4; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;';

      content.appendChild(title);
      content.appendChild(summary);
      card.appendChild(badge);
      card.appendChild(content);
      li.appendChild(card);
      list.appendChild(li);
    }

    groupEl.appendChild(list);
    el.appendChild(groupEl);
  }
}

/**
 * Format a status string for display in a badge.
 *
 * @param {string} status
 * @returns {string}
 */
function formatStatus(status) {
  switch (status) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'warning': return 'Warn';
    case 'manual': return 'Manual';
    case 'not-applicable': return 'N/A';
    default: return status;
  }
}
