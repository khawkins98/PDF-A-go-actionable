// @vitest-environment happy-dom
/**
 * Tests for the structure tree explorer panel.
 *
 * Covers:
 * - Heading and filter input rendering
 * - Tagging status display
 * - Structure summary with element types
 * - Heading hierarchy section
 * - Placeholder for full tree
 * - Search/filter functionality
 */
import { describe, it, expect } from 'vitest';
import { renderTreeExplorer } from './tree-explorer.js';

function makeData(findings) {
  return { findings };
}

describe('renderTreeExplorer', () => {
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

    // Element types should be rendered as code tags
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

    // Simulate typing "h1"
    input.value = 'h1';
    input.dispatchEvent(new Event('input'));

    const visibleItems = [...items].filter(li => li.style.display !== 'none');
    expect(visibleItems.length).toBe(1);
    expect(visibleItems[0].textContent).toBe('H1');
  });

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

    // Label should reference its own input
    const label1 = el1.querySelector('label');
    const label2 = el2.querySelector('label');
    expect(label1.htmlFor).toBe(input1.id);
    expect(label2.htmlFor).toBe(input2.id);
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

    // Filter first
    input.value = 'h1';
    input.dispatchEvent(new Event('input'));

    // Clear filter
    input.value = '';
    input.dispatchEvent(new Event('input'));

    const items = el.querySelectorAll('li[data-type]');
    const visibleItems = [...items].filter(li => li.style.display !== 'none');
    expect(visibleItems.length).toBe(3);
  });
});
