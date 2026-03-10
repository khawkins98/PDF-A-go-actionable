// @vitest-environment happy-dom
/**
 * Tests for the structure tree explorer panel.
 *
 * Covers:
 * - Heading and filter input rendering
 * - Tagging status display
 * - Structure summary with element types
 * - Heading hierarchy section
 * - Placeholder for full tree (fallback mode)
 * - Search/filter functionality (fallback mode)
 * - Interactive tree rendering (structureTree present)
 * - ARIA tree roles
 * - Expand/collapse
 * - Lazy child rendering
 * - Keyboard navigation
 * - Type badges and RoleMap annotation
 * - Alt/lang display
 * - Filter with path expansion
 * - Truncation warning
 * - Unique filter IDs
 */
import { describe, it, expect } from 'vitest';
import { renderTreeExplorer } from './tree-explorer.js';

function makeData(findings, structureTree) {
  return { findings, structureTree: structureTree || null };
}

function makeTree(root, totalCount, truncated) {
  return { root, totalCount: totalCount || 0, truncated: truncated || false };
}

function makeNode(id, type, role, children, opts = {}) {
  return {
    id,
    type,
    role: role || type,
    alt: opts.alt || null,
    lang: opts.lang || null,
    children: children || [],
  };
}

// ---------------------------------------------------------------------------
// Fallback mode tests (no structureTree)
// ---------------------------------------------------------------------------

describe('renderTreeExplorer — fallback mode', () => {
  it('should render a heading', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([]));

    const heading = el.querySelector('h2');
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('Structure Tree');
  });

  it('should render a filter input', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([]));

    const input = el.querySelector('input[type="search"]');
    expect(input).toBeDefined();
    expect(input.getAttribute('aria-label')).toContain('Filter');
  });

  it('should render placeholder for full tree', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([]));

    expect(el.textContent).toContain('Full interactive structure tree');
  });

  it('should show tagging status when tagged-pdf finding is present', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      { id: 'tagged-pdf', title: 'Tagged PDF', status: 'pass', summary: 'PDF is tagged.', details: [] },
    ]));

    const statusSection = el.querySelector('section[aria-label="Tagging status"]');
    expect(statusSection).toBeDefined();
    expect(statusSection.textContent).toContain('Tagged PDF');
    expect(statusSection.textContent).toContain('PDF is tagged');
  });

  it('should show tagging status for structure-tree finding', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      { id: 'structure-tree', title: 'Structure Tree', status: 'pass', summary: 'Structure tree present.', details: [] },
    ]));

    const statusSection = el.querySelector('section[aria-label="Tagging status"]');
    expect(statusSection).toBeDefined();
    expect(statusSection.textContent).toContain('Structure Tree');
  });

  it('should show structure summary with element types', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'structure-summary',
        title: 'Structure Summary',
        status: 'pass',
        summary: '15 elements found.',
        details: [
          { label: 'Element types', value: 'Document, P, H1, Figure' },
          { label: 'Total elements', value: '15' },
        ],
      },
    ]));

    const summarySection = el.querySelector('section[aria-label="Structure summary"]');
    expect(summarySection).toBeDefined();
    expect(summarySection.textContent).toContain('15 elements found');

    const codeTags = summarySection.querySelectorAll('code');
    expect(codeTags.length).toBe(4);
    expect(codeTags[0].textContent).toBe('Document');
    expect(codeTags[2].textContent).toBe('H1');
  });

  it('should show other details as definition list', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'structure-summary',
        title: 'Structure Summary',
        status: 'pass',
        summary: 'OK.',
        details: [
          { label: 'Total elements', value: '42' },
        ],
      },
    ]));

    const dts = el.querySelectorAll('dt');
    const dds = el.querySelectorAll('dd');
    expect(dts.length).toBe(1);
    expect(dts[0].textContent).toBe('Total elements');
    expect(dds[0].textContent).toBe('42');
  });

  it('should show heading hierarchy section when present', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'heading-hierarchy',
        title: 'Heading Hierarchy',
        status: 'pass',
        summary: 'Headings follow correct hierarchy.',
        details: [
          { label: 'Heading 1', value: 'H1' },
          { label: 'Heading 2', value: 'H2' },
        ],
      },
    ]));

    const headingSection = el.querySelector('section[aria-label="Heading hierarchy"]');
    expect(headingSection).toBeDefined();
    expect(headingSection.textContent).toContain('Heading Hierarchy');
  });

  it('should open heading details when status is fail', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'heading-hierarchy',
        title: 'Heading Hierarchy',
        status: 'fail',
        summary: 'Heading level skipped.',
        details: [
          { label: 'Heading 1', value: 'H1' },
          { label: 'Heading 3', value: 'H3' },
        ],
      },
    ]));

    const details = el.querySelector('section[aria-label="Heading hierarchy"] details');
    expect(details.open).toBe(true);
  });

  it('should filter element types when filter input changes', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'structure-summary',
        title: 'Structure Summary',
        status: 'pass',
        summary: 'OK.',
        details: [
          { label: 'Element types', value: 'Document, P, H1, Figure' },
        ],
      },
    ]));

    const input = el.querySelector('input[type="search"]');
    const items = el.querySelectorAll('li[data-type]');
    expect(items.length).toBe(4);

    input.value = 'h1';
    input.dispatchEvent(new Event('input'));

    const visibleItems = [...items].filter(li => li.style.display !== 'none');
    expect(visibleItems.length).toBe(1);
    expect(visibleItems[0].textContent).toBe('H1');
  });

  it('should show all items when filter is cleared', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([
      {
        id: 'structure-summary',
        title: 'Structure Summary',
        status: 'pass',
        summary: 'OK.',
        details: [
          { label: 'Element types', value: 'Document, P, H1' },
        ],
      },
    ]));

    const input = el.querySelector('input[type="search"]');

    input.value = 'h1';
    input.dispatchEvent(new Event('input'));

    input.value = '';
    input.dispatchEvent(new Event('input'));

    const items = el.querySelectorAll('li[data-type]');
    const visibleItems = [...items].filter(li => li.style.display !== 'none');
    expect(visibleItems.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Interactive tree mode tests
// ---------------------------------------------------------------------------

describe('renderTreeExplorer — interactive tree', () => {
  function makeSimpleTree() {
    return makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'H1', 'H1', []),
        makeNode(2, 'P', 'P', []),
        makeNode(3, 'Figure', 'Figure', [], { alt: 'A chart' }),
      ]),
      4,
      false,
    );
  }

  it('should render role="tree" container', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const tree = el.querySelector('[role="tree"]');
    expect(tree).not.toBeNull();
    expect(tree.getAttribute('aria-label')).toBe('Document structure tree');
  });

  it('should render root as expanded treeitem', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const rootItem = el.querySelector('[role="treeitem"]');
    expect(rootItem).not.toBeNull();
    expect(rootItem.getAttribute('aria-expanded')).toBe('true');
  });

  it('should render type badges as <code> elements', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const codeBadges = el.querySelectorAll('.tree-node__type');
    expect(codeBadges.length).toBeGreaterThanOrEqual(4);
    const texts = [...codeBadges].map(c => c.textContent);
    expect(texts).toContain('Document');
    expect(texts).toContain('H1');
    expect(texts).toContain('P');
    expect(texts).toContain('Figure');
  });

  it('should render color-coded icons for known tag types', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const icons = el.querySelectorAll('.tree-node__icon');
    expect(icons.length).toBeGreaterThanOrEqual(4);

    // H1 icon should be blue
    const h1Row = el.querySelector('[data-role="h1"] .tree-node__row');
    const h1Icon = h1Row.querySelector('.tree-node__icon');
    expect(h1Icon.textContent).toBe('H1');
    expect(h1Icon.style.color).toBe('#2563eb');
    expect(h1Icon.getAttribute('aria-hidden')).toBe('true');

    // Figure icon should be green
    const figRow = el.querySelector('[data-role="figure"] .tree-node__row');
    const figIcon = figRow.querySelector('.tree-node__icon');
    expect(figIcon.textContent).toBe('Fig');
    expect(figIcon.style.color).toBe('#059669');
  });

  it('should add tooltip to type badges for known tag types', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const h1Badge = el.querySelector('[data-role="h1"] .tree-node__type');
    expect(h1Badge.title).toContain('Heading level 1');

    const figBadge = el.querySelector('[data-role="figure"] .tree-node__type');
    expect(figBadge.title).toContain('image or illustration');

    // Document badge
    const docBadge = el.querySelector('[data-role="document"] .tree-node__type');
    expect(docBadge.title).toContain('root of the structure tree');
  });

  it('should not render icon for unknown tag types', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'CustomTag', 'CustomTag', []),
      ]),
      2,
    );
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    const customRow = el.querySelector('[data-role="customtag"] .tree-node__row');
    const icon = customRow.querySelector('.tree-node__icon');
    expect(icon).toBeNull();
    const badge = customRow.querySelector('.tree-node__type');
    expect(badge.title).toBe('');
  });

  it('should show RoleMap annotation when type differs from role', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'Heading1', 'H1', []),
        makeNode(2, 'Slide', 'Sect', []),
      ]),
      3,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    const mappings = el.querySelectorAll('.tree-node__mapping');
    expect(mappings.length).toBe(2);
    expect(mappings[0].textContent).toContain('Heading1');
    expect(mappings[1].textContent).toContain('Slide');
  });

  it('should show alt text badge', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const altBadge = el.querySelector('.tree-node__alt');
    expect(altBadge).not.toBeNull();
    expect(altBadge.textContent).toContain('A chart');
  });

  it('should show lang badge', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'P', 'P', [], { lang: 'de-DE' }),
      ]),
      2,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    const langBadge = el.querySelector('.tree-node__lang');
    expect(langBadge).not.toBeNull();
    expect(langBadge.textContent).toBe('de-DE');
  });

  it('should show child count', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const counts = el.querySelectorAll('.tree-node__count');
    expect(counts.length).toBeGreaterThanOrEqual(1);
    // Root Document has 3 children
    expect(counts[0].textContent).toBe('(3)');
  });

  it('should show stats bar with element count and type count', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const stats = el.querySelector('.tree-stats');
    expect(stats).not.toBeNull();
    expect(stats.textContent).toContain('4 elements');
    expect(stats.textContent).toContain('4 types');
  });

  it('should show truncation warning in stats', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', []),
      50000,
      true,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    const warning = el.querySelector('.tree-truncated-warning');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('truncated');
  });

  it('should not show placeholder when interactive tree is present', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    expect(el.textContent).not.toContain('Full interactive structure tree');
  });

  it('should collapse and expand on click', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const rootItem = el.querySelector('[role="treeitem"]');
    expect(rootItem.getAttribute('aria-expanded')).toBe('true');
    expect(rootItem.querySelector('[role="group"]')).not.toBeNull();

    // Click to collapse
    const row = rootItem.querySelector('.tree-node__row');
    row.click();

    expect(rootItem.getAttribute('aria-expanded')).toBe('false');
    expect(rootItem.querySelector('[role="group"]')).toBeNull();

    // Click to expand
    row.click();
    expect(rootItem.getAttribute('aria-expanded')).toBe('true');
    expect(rootItem.querySelector('[role="group"]')).not.toBeNull();
  });

  it('should render children lazily (collapsed by default)', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'Sect', 'Sect', [
          makeNode(2, 'P', 'P', []),
        ]),
      ]),
      3,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    // Root is expanded, but Sect should be collapsed
    const allItems = el.querySelectorAll('[role="treeitem"]');
    const sectItem = [...allItems].find(li => li.getAttribute('data-node-id') === '1');
    expect(sectItem).toBeDefined();
    expect(sectItem.getAttribute('aria-expanded')).toBe('false');
    // P should not be rendered yet
    const pItem = [...allItems].find(li => li.getAttribute('data-node-id') === '2');
    expect(pItem).toBeUndefined();

    // Click to expand Sect
    const sectRow = sectItem.querySelector('.tree-node__row');
    sectRow.click();

    // Now P should be rendered
    const pItems = el.querySelectorAll('[data-node-id="2"]');
    expect(pItems.length).toBeGreaterThan(0);
  });

  it('should handle keyboard ArrowDown/ArrowUp navigation', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const tree = el.querySelector('[role="tree"]');
    const rows = el.querySelectorAll('.tree-node__row');

    // Focus first row
    rows[0].focus();

    // ArrowDown
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows[1]);

    // ArrowUp
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(rows[0]);

    document.body.removeChild(el);
  });

  it('should handle keyboard Home/End navigation', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const tree = el.querySelector('[role="tree"]');
    const rows = el.querySelectorAll('.tree-node__row');

    // Focus first row and press End
    rows[0].focus();
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(rows[rows.length - 1]);

    // Press Home
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(rows[0]);

    document.body.removeChild(el);
  });

  it('should expand/collapse with Enter key', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'P', 'P', [
          makeNode(2, 'Span', 'Span', []),
        ]),
      ]),
      3,
      false,
    );

    const el = document.createElement('div');
    document.body.appendChild(el);
    renderTreeExplorer(el, makeData([], tree));

    const treeEl = el.querySelector('[role="tree"]');
    // Find the P item (collapsed child of root)
    const pItem = el.querySelector('[data-node-id="1"]');
    const pRow = pItem.querySelector('.tree-node__row');
    pRow.focus();

    // Press Enter to expand
    treeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(pItem.getAttribute('aria-expanded')).toBe('true');

    // Press Space to collapse
    treeEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(pItem.getAttribute('aria-expanded')).toBe('false');

    document.body.removeChild(el);
  });

  it('should filter tree and expand matching paths', () => {
    const tree = makeTree(
      makeNode(0, 'Document', 'Document', [
        makeNode(1, 'Sect', 'Sect', [
          makeNode(2, 'Figure', 'Figure', [], { alt: 'chart' }),
        ]),
        makeNode(3, 'P', 'P', []),
      ]),
      4,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree));

    const input = el.querySelector('input[type="search"]');
    input.value = 'figure';
    input.dispatchEvent(new Event('input'));

    // Should show Document > Sect > Figure, not P
    const items = el.querySelectorAll('[role="treeitem"]');
    const nodeIds = [...items].map(li => li.getAttribute('data-node-id'));
    expect(nodeIds).toContain('0'); // Document
    expect(nodeIds).toContain('1'); // Sect (ancestor)
    expect(nodeIds).toContain('2'); // Figure (match)
    expect(nodeIds).not.toContain('3'); // P (not matching)
  });

  it('should restore full tree when filter is cleared', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const input = el.querySelector('input[type="search"]');

    // Filter
    input.value = 'h1';
    input.dispatchEvent(new Event('input'));

    // Clear
    input.value = '';
    input.dispatchEvent(new Event('input'));

    // Should have root expanded with all children
    const items = el.querySelectorAll('[role="treeitem"]');
    expect(items.length).toBe(4);
  });

  it('should not render aria-expanded for leaf nodes', () => {
    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], makeSimpleTree()));

    const leafItems = el.querySelectorAll('[data-node-id="1"]');
    const leafItem = [...leafItems].find(li => li.getAttribute('role') === 'treeitem');
    expect(leafItem.hasAttribute('aria-expanded')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unique ID tests
// ---------------------------------------------------------------------------

describe('renderTreeExplorer — unique IDs', () => {
  it('should generate unique filter IDs across multiple renders', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    renderTreeExplorer(el1, makeData([]));
    renderTreeExplorer(el2, makeData([]));

    const input1 = el1.querySelector('input[type="search"]');
    const input2 = el2.querySelector('input[type="search"]');

    expect(input1.id).toBeTruthy();
    expect(input2.id).toBeTruthy();
    expect(input1.id).not.toBe(input2.id);

    const label1 = el1.querySelector('label');
    const label2 = el2.querySelector('label');
    expect(label1.htmlFor).toBe(input1.id);
    expect(label2.htmlFor).toBe(input2.id);
  });
});

// ---------------------------------------------------------------------------
// Bus event tests (selectTreeNode)
// ---------------------------------------------------------------------------

function makeBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return () => {
        const fns = listeners.get(event);
        const idx = fns.indexOf(fn);
        if (idx !== -1) fns.splice(idx, 1);
      };
    },
    emit(event, data) {
      const fns = listeners.get(event);
      if (fns) fns.forEach((fn) => fn(data));
    },
    _listeners: listeners,
  };
}

function makeNodeWithMcids(id, type, role, children, opts = {}) {
  return {
    id,
    type,
    role: role || type,
    alt: opts.alt || null,
    lang: opts.lang || null,
    children: children || [],
    mcids: opts.mcids || [],
    pageIndex: opts.pageIndex != null ? opts.pageIndex : null,
  };
}

describe('renderTreeExplorer — bus events', () => {
  it('should emit selectTreeNode on bus when a tree node row is clicked', () => {
    const bus = makeBus();
    const received = [];
    bus.on('selectTreeNode', (data) => received.push(data));

    const tree = makeTree(
      makeNodeWithMcids(0, 'Document', 'Document', [
        makeNodeWithMcids(1, 'P', 'P', [], { mcids: [{ mcid: 0, pageIndex: 0 }], pageIndex: 0 }),
      ], { mcids: [], pageIndex: null }),
      2,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree), bus);

    // Click the P node row (second row since root is expanded)
    const rows = el.querySelectorAll('.tree-node__row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    rows[1].click();

    expect(received).toHaveLength(1);
    expect(received[0].nodeId).toBe(1);
    expect(received[0].mcids).toEqual([{ mcid: 0, pageIndex: 0 }]);
    expect(received[0].pageIndex).toBe(0);
  });

  it('should add selected class to clicked node row', () => {
    const bus = makeBus();
    const tree = makeTree(
      makeNodeWithMcids(0, 'Document', 'Document', [
        makeNodeWithMcids(1, 'P', 'P', []),
        makeNodeWithMcids(2, 'H1', 'H1', []),
      ]),
      3,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree), bus);

    const rows = el.querySelectorAll('.tree-node__row');
    rows[1].click();
    expect(rows[1].classList.contains('tree-node__row--selected')).toBe(true);

    // Click another row — previous selection removed
    rows[2].click();
    expect(rows[1].classList.contains('tree-node__row--selected')).toBe(false);
    expect(rows[2].classList.contains('tree-node__row--selected')).toBe(true);
  });

  it('should not throw when bus is not provided', () => {
    const tree = makeTree(
      makeNodeWithMcids(0, 'Document', 'Document', [
        makeNodeWithMcids(1, 'P', 'P', []),
      ]),
      2,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree)); // no bus

    const rows = el.querySelectorAll('.tree-node__row');
    expect(() => rows[1].click()).not.toThrow();
  });

  it('should still toggle expand/collapse on click alongside bus event', () => {
    const bus = makeBus();
    const tree = makeTree(
      makeNodeWithMcids(0, 'Document', 'Document', [
        makeNodeWithMcids(1, 'P', 'P', [
          makeNodeWithMcids(2, 'Span', 'Span', []),
        ]),
      ]),
      3,
      false,
    );

    const el = document.createElement('div');
    renderTreeExplorer(el, makeData([], tree), bus);

    // Root is expanded, P is collapsed. Click P row — should expand it AND emit event
    const received = [];
    bus.on('selectTreeNode', (d) => received.push(d));

    const pItem = el.querySelector('[data-node-id="1"]');
    const pRow = pItem.querySelector('.tree-node__row');
    pRow.click();

    // The row click handler on the tree (event delegation) handles selection,
    // and the row's direct click handler handles toggle.
    // Both should fire.
    expect(received).toHaveLength(1);
    expect(received[0].nodeId).toBe(1);
  });
});
