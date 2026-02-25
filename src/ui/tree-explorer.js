/**
 * Structure tree explorer panel.
 *
 * Two modes:
 * - Interactive ARIA tree when data.structureTree?.root exists
 * - Fallback findings-based summary view otherwise
 *
 * Interactive tree implements WAI-ARIA TreeView pattern with:
 * - role="tree" / role="treeitem" / role="group"
 * - Lazy child rendering (expand/collapse)
 * - Keyboard navigation (Arrow keys, Home, End, Enter, Space)
 * - Search/filter with path expansion
 * - Batch limit (200 children per expansion) with "Show more" button
 */

const BATCH_SIZE = 200;

/** Counter for generating unique IDs across multiple panel instances. */
let treeFilterIdCounter = 0;

/**
 * Render the structure tree explorer panel.
 *
 * @param {HTMLElement} el - The container element to render into
 * @param {object} data - Audit result data
 * @param {object[]} data.findings - Array of Finding objects
 * @param {object} [data.structureTree] - Serialized tree from buildSerializableTree
 */
export function renderTreeExplorer(el, data) {
  const { findings } = data;
  const structTree = data.structureTree;

  el.innerHTML = '';

  const filterId = `tree-filter-input-${++treeFilterIdCounter}`;

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
  filterLabel.htmlFor = filterId;
  filterLabel.style.cssText = 'display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-xs);';

  const filterInput = document.createElement('input');
  filterInput.type = 'search';
  filterInput.id = filterId;
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

  // Interactive tree mode
  if (structTree && structTree.root) {
    renderInteractiveTree(el, structTree, filterInput);
    return;
  }

  // Fallback: findings-based summary
  renderFallbackView(el, findings, filterInput);
}

// ---------------------------------------------------------------------------
// Interactive tree rendering
// ---------------------------------------------------------------------------

function renderInteractiveTree(el, structTree, filterInput) {
  const { root, totalCount, truncated } = structTree;

  // Stats bar
  const stats = document.createElement('div');
  stats.className = 'tree-stats';

  const typesSet = new Set();
  countTypes(root, typesSet);

  stats.textContent = `${totalCount} elements, ${typesSet.size} types`;
  if (truncated) {
    const warn = document.createElement('span');
    warn.className = 'tree-truncated-warning';
    warn.textContent = ' (tree truncated — document exceeds size limit)';
    stats.appendChild(warn);
  }
  el.appendChild(stats);

  // Tree container
  const treeEl = document.createElement('ul');
  treeEl.setAttribute('role', 'tree');
  treeEl.setAttribute('aria-label', 'Document structure tree');
  treeEl.className = 'tree-node';

  // Render root expanded
  const rootItem = createTreeItem(root, true);
  treeEl.appendChild(rootItem);

  el.appendChild(treeEl);

  // Keyboard navigation
  treeEl.addEventListener('keydown', (e) => handleTreeKeydown(e, treeEl));

  // Filter
  filterInput.addEventListener('input', () => {
    const query = filterInput.value.trim().toLowerCase();
    filterTree(treeEl, root, query);
  });
}

function countTypes(node, typesSet) {
  typesSet.add(node.role);
  for (const child of node.children) {
    countTypes(child, typesSet);
  }
}

/**
 * Create a treeitem element for a node.
 * @param {object} node - TreeNode
 * @param {boolean} expanded - Whether to render children immediately
 * @returns {HTMLLIElement}
 */
function createTreeItem(node, expanded) {
  const li = document.createElement('li');
  li.setAttribute('role', 'treeitem');
  li.setAttribute('data-node-id', String(node.id));
  li.dataset.type = node.type.toLowerCase();
  li.dataset.role = node.role.toLowerCase();
  if (node.alt) li.dataset.alt = node.alt.toLowerCase();

  const hasChildren = node.children.length > 0;
  li.setAttribute('aria-expanded', hasChildren ? String(expanded) : undefined);
  if (!hasChildren) li.removeAttribute('aria-expanded');

  // Row content
  const row = document.createElement('div');
  row.className = 'tree-node__row';
  row.tabIndex = -1;
  row.setAttribute('data-node-id', String(node.id));

  // Toggle icon
  const toggle = document.createElement('span');
  toggle.className = hasChildren ? 'tree-node__toggle' : 'tree-node__toggle tree-node__toggle--leaf';
  toggle.textContent = hasChildren ? (expanded ? '\u25BC' : '\u25B6') : '';
  toggle.setAttribute('aria-hidden', 'true');
  row.appendChild(toggle);

  // Type badge
  const typeBadge = document.createElement('code');
  typeBadge.className = 'tree-node__type';
  typeBadge.textContent = node.role;
  row.appendChild(typeBadge);

  // RoleMap annotation (show original if different)
  if (node.type !== node.role) {
    const mapping = document.createElement('span');
    mapping.className = 'tree-node__mapping';
    mapping.textContent = `\u2190 ${node.type}`;
    row.appendChild(mapping);
  }

  // Alt text badge
  if (node.alt) {
    const altBadge = document.createElement('span');
    altBadge.className = 'tree-node__alt';
    altBadge.textContent = `alt: "${node.alt}"`;
    altBadge.title = node.alt;
    row.appendChild(altBadge);
  }

  // Lang badge
  if (node.lang) {
    const langBadge = document.createElement('span');
    langBadge.className = 'tree-node__lang';
    langBadge.textContent = node.lang;
    row.appendChild(langBadge);
  }

  // Child count
  if (hasChildren) {
    const count = document.createElement('span');
    count.className = 'tree-node__count';
    count.textContent = `(${node.children.length})`;
    row.appendChild(count);
  }

  li.appendChild(row);

  // Click to toggle
  row.addEventListener('click', () => {
    if (hasChildren) {
      toggleNode(li, node);
    }
  });

  // Render children if expanded
  if (expanded && hasChildren) {
    renderChildren(li, node, 0);
  }

  // Store node data reference
  li._treeNode = node;

  return li;
}

/**
 * Render a batch of children into the group under li.
 */
function renderChildren(li, node, startIndex) {
  let group = li.querySelector(':scope > [role="group"]');
  if (!group) {
    group = document.createElement('ul');
    group.setAttribute('role', 'group');
    group.className = 'tree-node';
    li.appendChild(group);
  }

  // Remove existing "show more" button
  const existingMore = group.querySelector(':scope > .tree-node__more');
  if (existingMore) existingMore.remove();

  const end = Math.min(startIndex + BATCH_SIZE, node.children.length);
  for (let i = startIndex; i < end; i++) {
    const childItem = createTreeItem(node.children[i], false);
    group.appendChild(childItem);
  }

  // Add "Show more" button if needed
  if (end < node.children.length) {
    const remaining = node.children.length - end;
    const moreBtn = document.createElement('button');
    moreBtn.className = 'tree-node__more';
    moreBtn.textContent = `Show ${Math.min(remaining, BATCH_SIZE)} more of ${remaining} remaining...`;
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderChildren(li, node, end);
    });
    group.appendChild(moreBtn);
  }
}

function toggleNode(li, node) {
  const isExpanded = li.getAttribute('aria-expanded') === 'true';
  const toggle = li.querySelector(':scope > .tree-node__row .tree-node__toggle');

  if (isExpanded) {
    // Collapse: remove children
    const group = li.querySelector(':scope > [role="group"]');
    if (group) group.remove();
    li.setAttribute('aria-expanded', 'false');
    if (toggle) toggle.textContent = '\u25B6';
  } else {
    // Expand: render children
    li.setAttribute('aria-expanded', 'true');
    if (toggle) toggle.textContent = '\u25BC';
    renderChildren(li, node, 0);
  }
}

// ---------------------------------------------------------------------------
// Keyboard navigation (WAI-ARIA TreeView)
// ---------------------------------------------------------------------------

function handleTreeKeydown(e, treeEl) {
  const rows = [...treeEl.querySelectorAll('.tree-node__row')];
  const visibleRows = rows.filter(r => {
    // Check if any ancestor li is collapsed
    let parent = r.parentElement; // the li
    let container = parent.parentElement; // the ul[role=group] or ul[role=tree]
    while (container) {
      if (container.getAttribute('role') === 'group') {
        const parentLi = container.parentElement;
        if (parentLi && parentLi.getAttribute('aria-expanded') === 'false') {
          return false;
        }
      }
      if (container.getAttribute('role') === 'tree') break;
      container = container.parentElement;
    }
    return true;
  });

  const currentIndex = visibleRows.indexOf(document.activeElement);
  if (currentIndex === -1 && !['Home', 'End'].includes(e.key)) return;

  const currentRow = visibleRows[currentIndex];
  const currentLi = currentRow?.parentElement;

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault();
      if (currentIndex < visibleRows.length - 1) {
        visibleRows[currentIndex + 1].focus();
      }
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      if (currentIndex > 0) {
        visibleRows[currentIndex - 1].focus();
      }
      break;
    }
    case 'ArrowRight': {
      e.preventDefault();
      if (currentLi && currentLi.hasAttribute('aria-expanded')) {
        if (currentLi.getAttribute('aria-expanded') === 'false') {
          toggleNode(currentLi, currentLi._treeNode);
        } else {
          // Move to first child
          const group = currentLi.querySelector(':scope > [role="group"]');
          const firstChild = group?.querySelector(':scope > [role="treeitem"] > .tree-node__row');
          if (firstChild) firstChild.focus();
        }
      }
      break;
    }
    case 'ArrowLeft': {
      e.preventDefault();
      if (currentLi && currentLi.getAttribute('aria-expanded') === 'true') {
        toggleNode(currentLi, currentLi._treeNode);
      } else if (currentLi) {
        // Move to parent
        const parentGroup = currentLi.parentElement;
        if (parentGroup && parentGroup.getAttribute('role') === 'group') {
          const parentLi = parentGroup.parentElement;
          const parentRow = parentLi?.querySelector(':scope > .tree-node__row');
          if (parentRow) parentRow.focus();
        }
      }
      break;
    }
    case 'Home': {
      e.preventDefault();
      if (visibleRows.length > 0) visibleRows[0].focus();
      break;
    }
    case 'End': {
      e.preventDefault();
      if (visibleRows.length > 0) visibleRows[visibleRows.length - 1].focus();
      break;
    }
    case 'Enter':
    case ' ': {
      e.preventDefault();
      if (currentLi && currentLi.hasAttribute('aria-expanded')) {
        toggleNode(currentLi, currentLi._treeNode);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Filter / search
// ---------------------------------------------------------------------------

/**
 * Find matching node IDs in the serialized tree data.
 * Returns a Set of node IDs that match and all their ancestor IDs.
 */
function findMatchingPaths(node, query, ancestors = []) {
  const matchIds = new Set();

  const matches = node.type.toLowerCase().includes(query) ||
    node.role.toLowerCase().includes(query) ||
    (node.alt && node.alt.toLowerCase().includes(query)) ||
    (node.lang && node.lang.toLowerCase().includes(query));

  if (matches) {
    matchIds.add(node.id);
    for (const a of ancestors) matchIds.add(a);
  }

  for (const child of node.children) {
    const childMatches = findMatchingPaths(child, query, [...ancestors, node.id]);
    for (const id of childMatches) matchIds.add(id);
  }

  return matchIds;
}

function filterTree(treeEl, root, query) {
  if (!query) {
    // Clear filter — re-render with root expanded
    treeEl.innerHTML = '';
    treeEl.appendChild(createTreeItem(root, true));
    return;
  }

  const matchIds = findMatchingPaths(root, query);

  // Re-render tree with matching paths expanded
  treeEl.innerHTML = '';
  const rootItem = createFilteredTreeItem(root, matchIds);
  if (rootItem) treeEl.appendChild(rootItem);
}

function createFilteredTreeItem(node, matchIds) {
  if (!matchIds.has(node.id)) return null;

  const li = createTreeItem(node, false);

  // Check if any children match
  const matchingChildren = node.children.filter(c => matchIds.has(c.id));
  if (matchingChildren.length > 0) {
    li.setAttribute('aria-expanded', 'true');
    const toggle = li.querySelector(':scope > .tree-node__row .tree-node__toggle');
    if (toggle) toggle.textContent = '\u25BC';

    const group = document.createElement('ul');
    group.setAttribute('role', 'group');
    group.className = 'tree-node';

    for (const child of matchingChildren) {
      const childItem = createFilteredTreeItem(child, matchIds);
      if (childItem) group.appendChild(childItem);
    }
    li.appendChild(group);
  }

  return li;
}

// ---------------------------------------------------------------------------
// Fallback: findings-based summary view
// ---------------------------------------------------------------------------

function renderFallbackView(el, findings, filterInput) {
  const structureSummary = findings.find(f => f.id === 'structure-summary');
  const headingHierarchy = findings.find(f => f.id === 'heading-hierarchy');
  const taggedPdf = findings.find(f => f.id === 'tagged-pdf');
  const structureTree = findings.find(f => f.id === 'structure-tree');

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
      statusSection.appendChild(createStatusItem(taggedPdf.title, taggedPdf.status, taggedPdf.summary));
    }
    if (structureTree) {
      statusSection.appendChild(createStatusItem(structureTree.title, structureTree.status, structureTree.summary));
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

  // Placeholder
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

function filterContent(container, query) {
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
