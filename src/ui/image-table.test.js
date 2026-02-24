// @vitest-environment happy-dom
/**
 * Tests for the image inventory panel.
 *
 * Covers:
 * - Heading rendering
 * - Empty state when no image finding
 * - Table rendering for pass case (figures with alt text)
 * - Table rendering for fail case (figures without alt text)
 * - Warning case handling
 * - Not-applicable case
 * - Decorative images section
 * - Remediation section
 */
import { describe, it, expect } from 'vitest';
import { renderImageTable } from './image-table.js';

function makeData(findings) {
  return { findings };
}

function makeImageFinding(overrides) {
  return {
    id: 'image-alt-text',
    category: 'images',
    title: 'Image Alt Text',
    status: 'pass',
    summary: 'All 2 figure(s) have alt text.',
    details: [
      { label: 'Figure 1', value: 'A chart showing revenue growth' },
      { label: 'Figure 2', value: 'Company logo' },
    ],
    remediation: null,
    ...overrides,
  };
}

describe('renderImageTable', () => {
  it('should render a heading', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([]));

    const heading = el.querySelector('h2');
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('Image Inventory');
  });

  it('should show empty message when no image finding exists', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([]));

    expect(el.textContent).toContain('No image audit data available');
  });

  it('should render overall status badge', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding()]));

    const badge = el.querySelector('.status-badge--pass');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Pass');
  });

  it('should render summary text', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({ summary: 'All images have alt text.' })]));

    expect(el.textContent).toContain('All images have alt text.');
  });

  it('should render table with correct headers', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding()]));

    const ths = el.querySelectorAll('th');
    const headers = [...ths].map(th => th.textContent);
    expect(headers).toContain('Figure #');
    expect(headers).toContain('Has Alt Text');
    expect(headers).toContain('Alt Text');
  });

  it('should render pass case with figures and alt text', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding()]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // First row
    const cells = rows[0].querySelectorAll('td');
    expect(cells[0].textContent).toBe('Figure 1');
    expect(cells[1].querySelector('.status-badge--pass').textContent).toBe('Yes');
    expect(cells[2].textContent).toBe('A chart showing revenue growth');
  });

  it('should render fail case with missing alt text', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({
      status: 'fail',
      summary: '2 figure(s) missing alt text.',
      details: [
        { label: 'Figure without alt', value: 'No /Alt attribute' },
        { label: 'Figure without alt', value: 'No /Alt attribute' },
      ],
      remediation: 'Add alt text to all figures.',
    })]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // Fail rows should have fail badges
    const failBadge = rows[0].querySelectorAll('td')[1].querySelector('.status-badge--fail');
    expect(failBadge).toBeDefined();
    expect(failBadge.textContent).toBe('No');

    // Labels should be "Figure 1", "Figure 2" (auto-numbered)
    expect(rows[0].querySelector('td').textContent).toBe('Figure 1');
    expect(rows[1].querySelector('td').textContent).toBe('Figure 2');
  });

  it('should skip numeric count details in warning case', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({
      status: 'warning',
      details: [
        { label: 'Image XObjects', value: '3' },
        { label: 'Note', value: 'No structure tree to check alt text' },
      ],
    })]));

    const rows = el.querySelectorAll('tbody tr');
    // Should skip the "3" entry, only show "Note"
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('td').textContent).toBe('Note');
  });

  it('should show not-applicable message when no images', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({
      status: 'not-applicable',
      summary: 'No figures found.',
      details: [],
    })]));

    expect(el.textContent).toContain('No images found');
  });

  it('should render decorative images section when present', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([
      makeImageFinding(),
      {
        id: 'decorative-images',
        category: 'images',
        title: 'Decorative Images',
        status: 'pass',
        summary: 'No decorative images found in structure.',
        details: [],
      },
    ]));

    expect(el.textContent).toContain('No decorative images found');
  });

  it('should render remediation section when present', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({
      status: 'fail',
      remediation: 'Add alt text to every Figure element.',
    })]));

    expect(el.textContent).toContain('Remediation');
    expect(el.textContent).toContain('Add alt text to every Figure element.');
  });

  it('should not render remediation when null', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding({ remediation: null })]));

    expect(el.textContent).not.toContain('Remediation');
  });

  it('should have accessible table with caption', () => {
    const el = document.createElement('div');
    renderImageTable(el, makeData([makeImageFinding()]));

    const caption = el.querySelector('caption');
    expect(caption).toBeDefined();
    expect(caption.textContent).toContain('figure element(s) found');

    const ths = el.querySelectorAll('th');
    for (const th of ths) {
      expect(th.scope).toBe('col');
    }
  });
});
