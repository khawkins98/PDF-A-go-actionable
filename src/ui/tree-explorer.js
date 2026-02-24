/**
 * Structure tree explorer panel.
 *
 * Displays the document's structure tree information derived from the
 * audit findings. Since the UI panels receive audit result data (not the
 * raw pdfDoc), the actual tree is not available for interactive rendering.
 * Instead, this panel shows the structure-summary finding details and a
 * placeholder message for full tree exploration.
 *
 * Includes a search/filter input at the top for filtering displayed
 * structure information.
 */

/**
 * Render the structure tree explorer panel.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 */
export function renderTreeExplorer(el, data) {
  const { findings } = data;

  el.innerHTML = '';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Structure Tree';
  heading.style.cssText = 'margin-bottom: var(--space-md); font-size: var(--font-size-xl);';
  el.appendChild(heading);

  // Search/filter input
  const filterContainer = document.createElement('div');
  filterContainer.style.cssText = 'margin-bottom: var(--space-md);';

  const filterLabel = document.createElement('label');
  filterLabel.textContent = 'Filter elements:';
  filterLabel.htmlFor = 'tree-filter-input';
  filterLabel.style.cssText = 'display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-xs);';

  const filterInput = document.createElement('input');
  filterInput.type = 'search';
  filterInput.id = 'tree-filter-input';
  filterInput.placeholder = 'Search element types, alt text...';
  filterInput.setAttribute('aria-label', 'Filter structure tree elements');
  filterInput.style.cssText = [
    'width: 100%',
    'padding: var(--space-sm) var(--space-md)',
    'border: 1px solid var(--color-border)',
    'border-radius: var(--radius-md)',
    'font: inherit',
    'font-size: var(--font-size-base)',
    'background: var(--color-surface)',
    'color: var(--color-text)',
  ].join('; ');

  filterContainer.appendChild(filterLabel);
  filterContainer.appendChild(filterInput);
  el.appendChild(filterContainer);

  // Find the structure-summary finding
  const structureSummary = findings.find(f => f.id === 'structure-summary');
  // Find the heading-hierarchy finding for heading details
  const headingHierarchy = findings.find(f => f.id === 'heading-hierarchy');
  // Find tagged-pdf and structure-tree findings
  const taggedPdf = findings.find(f => f.id === 'tagged-pdf');
  const structureTree = findings.find(f => f.id === 'structure-tree');

  // Container for the tree content (used for filtering)
  const contentContainer = document.createElement('div');
  contentContainer.setAttribute('role', 'region');
  contentContainer.setAttribute('aria-label', 'Structure tree information');

  // Tag status
  if (taggedPdf || structureTree) {
    const statusSection = document.createElement('section');
    statusSection.setAttribute('aria-label', 'Tagging status');
    statusSection.style.cssText = 'margin-bottom: var(--space-md);';

    const statusHeading = document.createElement('h3');
    statusHeading.textContent = 'Tagging Status';
    statusHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    statusSection.appendChild(statusHeading);

    if (taggedPdf) {
      const item = createStatusItem(taggedPdf.title, taggedPdf.status, taggedPdf.summary);
      statusSection.appendChild(item);
    }
    if (structureTree) {
      const item = createStatusItem(structureTree.title, structureTree.status, structureTree.summary);
      statusSection.appendChild(item);
    }

    contentContainer.appendChild(statusSection);
  }

  // Structure summary
  if (structureSummary && structureSummary.details && structureSummary.details.length > 0) {
    const summarySection = document.createElement('section');
    summarySection.setAttribute('aria-label', 'Structure summary');
    summarySection.style.cssText = 'margin-bottom: var(--space-md);';

    const summaryHeading = document.createElement('h3');
    summaryHeading.textContent = 'Structure Summary';
    summaryHeading.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    summarySection.appendChild(summaryHeading);

    const summaryText = document.createElement('p');
    summaryText.textContent = structureSummary.summary;
    summaryText.style.cssText = 'color: var(--color-text-secondary); margin-bottom: var(--space-sm);';
    summarySection.appendChild(summaryText);

    // Show element types as a nested details/summary tree
    const typesDetail = structureSummary.details.find(d => d.label === 'Element types');
    if (typesDetail) {
      const typesSection = document.createElement('details');
      typesSection.open = true;

      const typesSummary = document.createElement('summary');
      typesSummary.textContent = 'Element Types Found';
      typesSummary.style.cssText = 'cursor: pointer; font-weight: 600; margin-bottom: var(--space-sm); padding: var(--space-xs) 0;';
      typesSection.appendChild(typesSummary);

      const typesList = document.createElement('ul');
      typesList.style.cssText = 'list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-xs); padding-left: var(--space-md);';
      typesList.setAttribute('role', 'list');

      const types = typesDetail.value.split(', ');
      for (const typeName of types) {
        const li = document.createElement('li');
        li.setAttribute('data-type', typeName.toLowerCase());

        const tag = document.createElement('code');
        tag.textContent = typeName;
        tag.style.cssText = [
          'display: inline-block',
          'padding: 2px var(--space-sm)',
          'background: var(--color-surface-alt)',
          'border: 1px solid var(--color-border-light)',
          'border-radius: var(--radius-sm)',
          'font-family: var(--font-mono)',
          'font-size: var(--font-size-sm)',
        ].join('; ');

        li.appendChild(tag);
        typesList.appendChild(li);
      }

      typesSection.appendChild(typesList);
      summarySection.appendChild(typesSection);
    }

    // Show other details
    const otherDetails = structureSummary.details.filter(d => d.label !== 'Element types');
    if (otherDetails.length > 0) {
      const dl = document.createElement('dl');
      dl.style.cssText = 'display: grid; grid-template-columns: auto 1fr; gap: var(--space-xs) var(--space-md); margin-top: var(--space-sm);';

      for (const detail of otherDetails) {
        const dt = document.createElement('dt');
        dt.textContent = detail.label;
        dt.style.cssText = 'font-weight: 600; color: var(--color-text-secondary);';

        const dd = document.createElement('dd');
        dd.textContent = detail.value;
        dd.style.cssText = 'margin: 0;';

        dl.appendChild(dt);
        dl.appendChild(dd);
      }

      summarySection.appendChild(dl);
    }

    contentContainer.appendChild(summarySection);
  }

  // Heading hierarchy
  if (headingHierarchy && headingHierarchy.details && headingHierarchy.details.length > 0) {
    const headingSection = document.createElement('section');
    headingSection.setAttribute('aria-label', 'Heading hierarchy');
    headingSection.style.cssText = 'margin-bottom: var(--space-md);';

    const headingTitle = document.createElement('h3');
    headingTitle.textContent = 'Heading Hierarchy';
    headingTitle.style.cssText = 'font-size: var(--font-size-lg); margin-bottom: var(--space-sm);';
    headingSection.appendChild(headingTitle);

    const headingBadge = document.createElement('span');
    headingBadge.className = `status-badge status-badge--${headingHierarchy.status}`;
    headingBadge.textContent = headingHierarchy.status === 'pass' ? 'Pass' : headingHierarchy.status === 'fail' ? 'Fail' : headingHierarchy.status === 'warning' ? 'Warning' : headingHierarchy.status;
    headingSection.appendChild(headingBadge);

    const headingDetail = document.createElement('details');
    headingDetail.open = headingHierarchy.status === 'fail';
    headingDetail.style.cssText = 'margin-top: var(--space-sm);';

    const headingDetailSummary = document.createElement('summary');
    headingDetailSummary.textContent = headingHierarchy.summary;
    headingDetailSummary.style.cssText = 'cursor: pointer; color: var(--color-text-secondary); padding: var(--space-xs) 0;';
    headingDetail.appendChild(headingDetailSummary);

    const headingList = document.createElement('ol');
    headingList.style.cssText = 'padding-left: var(--space-lg); margin-top: var(--space-sm);';

    for (const d of headingHierarchy.details) {
      const li = document.createElement('li');
      li.setAttribute('data-type', d.value.toLowerCase());
      li.style.cssText = 'margin-bottom: var(--space-xs); font-size: var(--font-size-sm);';

      const label = document.createElement('strong');
      label.textContent = `${d.label}: `;

      const value = document.createElement('span');
      value.textContent = d.value;
      value.style.cssText = 'color: var(--color-text-secondary);';

      li.appendChild(label);
      li.appendChild(value);
      headingList.appendChild(li);
    }

    headingDetail.appendChild(headingList);
    headingSection.appendChild(headingDetail);
    contentContainer.appendChild(headingSection);
  }

  // Placeholder for full interactive tree
  const placeholderSection = document.createElement('section');
  placeholderSection.style.cssText = [
    'margin-top: var(--space-lg)',
    'padding: var(--space-md)',
    'background: var(--color-surface-alt)',
    'border-radius: var(--radius-md)',
    'border: 1px dashed var(--color-border)',
    'text-align: center',
  ].join('; ');

  const placeholderIcon = document.createElement('div');
  placeholderIcon.textContent = '[ Tree View ]';
  placeholderIcon.style.cssText = 'font-family: var(--font-mono); color: var(--color-text-muted); margin-bottom: var(--space-sm);';

  const placeholderText = document.createElement('p');
  placeholderText.textContent = 'Full interactive structure tree requires the loaded PDF context. The summary above shows element types and hierarchy from the audit analysis.';
  placeholderText.style.cssText = 'color: var(--color-text-muted); font-size: var(--font-size-sm);';

  placeholderSection.appendChild(placeholderIcon);
  placeholderSection.appendChild(placeholderText);
  contentContainer.appendChild(placeholderSection);

  el.appendChild(contentContainer);

  // Wire up search/filter
  filterInput.addEventListener('input', () => {
    const query = filterInput.value.trim().toLowerCase();
    filterContent(contentContainer, query);
  });
}

/**
 * Create a status item display element.
 *
 * @param {string} title
 * @param {string} status
 * @param {string} summary
 * @returns {HTMLElement}
 */
function createStatusItem(title, status, summary) {
  const item = document.createElement('div');
  item.style.cssText = 'display: flex; align-items: flex-start; gap: var(--space-sm); margin-bottom: var(--space-sm);';

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${status}`;
  badge.textContent = status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : 'Warn';
  badge.style.cssText = 'flex-shrink: 0;';

  const text = document.createElement('span');
  text.textContent = `${title}: ${summary}`;
  text.style.cssText = 'font-size: var(--font-size-sm); color: var(--color-text-secondary);';

  item.appendChild(badge);
  item.appendChild(text);
  return item;
}

/**
 * Filter visible content based on a search query.
 * Hides list items and detail rows that do not match.
 *
 * @param {HTMLElement} container
 * @param {string} query - Lowercase search term
 */
function filterContent(container, query) {
  // Filter type tags in the element types list
  const typeItems = container.querySelectorAll('li[data-type]');
  for (const item of typeItems) {
    if (!query) {
      item.style.display = '';
    } else {
      const match = item.getAttribute('data-type').includes(query) ||
                    item.textContent.toLowerCase().includes(query);
      item.style.display = match ? '' : 'none';
    }
  }

  // Filter details list items (heading hierarchy, etc.)
  const detailItems = container.querySelectorAll('ol li');
  for (const item of detailItems) {
    if (!query) {
      item.style.display = '';
    } else {
      const match = item.textContent.toLowerCase().includes(query);
      item.style.display = match ? '' : 'none';
    }
  }
}
