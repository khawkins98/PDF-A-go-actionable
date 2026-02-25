// @vitest-environment happy-dom
/**
 * Tests for the font inventory panel.
 *
 * Covers:
 * - Heading rendering
 * - Empty state when no font finding
 * - Table rendering with font rows
 * - Status badge display
 * - Font detail parsing (ToUnicode and embedding)
 * - Remediation section
 * - Two-finding merge (font-tounicode + font-embedding)
 */
import { describe, it, expect } from 'vitest';
import { renderFontTable } from './font-table.js';

function makeData(findings) {
  return { findings };
}

function makeToUnicodeFinding(overrides) {
  return {
    id: 'font-tounicode',
    category: 'fonts',
    title: 'Font Unicode Mapping',
    status: 'pass',
    summary: 'All 2 font(s) have ToUnicode CMaps.',
    details: [
      { label: 'Arial', value: 'Has ToUnicode' },
      { label: 'TimesNewRoman', value: 'Has ToUnicode' },
    ],
    remediation: null,
    ...overrides,
  };
}

function makeEmbeddingFinding(overrides) {
  return {
    id: 'font-embedding',
    category: 'fonts',
    title: 'Font Embedding',
    status: 'pass',
    summary: 'All 2 font(s) with descriptors are embedded.',
    details: [],
    remediation: null,
    ...overrides,
  };
}

describe('renderFontTable', () => {
  it('should render a heading', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([]));

    const heading = el.querySelector('h2');
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('Font Inventory');
  });

  it('should show empty message when no font finding exists', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([]));

    expect(el.textContent).toContain('No font audit data available');
  });

  it('should render status badges for both findings', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeToUnicodeFinding(), makeEmbeddingFinding()]));

    const badges = el.querySelectorAll('.status-badge--pass');
    // Both findings have pass status
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('should render summary text for both findings', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({ summary: 'All fonts have ToUnicode.' }),
      makeEmbeddingFinding({ summary: 'All fonts embedded.' }),
    ]));

    expect(el.textContent).toContain('All fonts have ToUnicode.');
    expect(el.textContent).toContain('All fonts embedded.');
  });

  it('should render a table with correct headers', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeToUnicodeFinding(), makeEmbeddingFinding()]));

    const ths = el.querySelectorAll('th');
    const headers = [...ths].map(th => th.textContent);
    expect(headers).toContain('Font Name');
    expect(headers).toContain('ToUnicode');
    expect(headers).toContain('Embedded');
  });

  it('should render font rows from details', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeToUnicodeFinding(), makeEmbeddingFinding()]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // First row: Arial
    const cells = rows[0].querySelectorAll('td');
    expect(cells[0].textContent).toBe('Arial');
    // ToUnicode should show Yes badge
    expect(cells[1].querySelector('.status-badge--pass').textContent).toBe('Yes');
  });

  it('should show warning badge for fonts missing ToUnicode', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({
        status: 'warning',
        details: [
          { label: 'BrokenFont', value: 'Missing ToUnicode' },
        ],
      }),
      makeEmbeddingFinding(),
    ]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);

    const toUnicodeBadge = rows[0].querySelectorAll('td')[1].querySelector('.status-badge--warning');
    expect(toUnicodeBadge).toBeDefined();
    expect(toUnicodeBadge.textContent).toBe('No');
  });

  it('should show warning badge for not-embedded fonts', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({
        details: [
          { label: 'Arial', value: 'Has ToUnicode' },
        ],
      }),
      makeEmbeddingFinding({
        status: 'warning',
        details: [
          { label: 'Arial', value: 'Not embedded' },
        ],
      }),
    ]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);

    const embeddedBadge = rows[0].querySelectorAll('td')[2].querySelector('.status-badge--warning');
    expect(embeddedBadge).toBeDefined();
    expect(embeddedBadge.textContent).toBe('No');
  });

  it('should skip "Embedding summary" detail entries', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({
        details: [
          { label: 'Arial', value: 'Has ToUnicode' },
        ],
      }),
      makeEmbeddingFinding({
        details: [
          { label: 'Embedding summary', value: '1 embedded, 1 not embedded' },
        ],
      }),
    ]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('td').textContent).toBe('Arial');
  });

  it('should render remediation section when present on toUnicode finding', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({
        status: 'warning',
        remediation: 'Re-export with embedded fonts.',
      }),
      makeEmbeddingFinding(),
    ]));

    expect(el.textContent).toContain('Remediation');
    expect(el.textContent).toContain('Re-export with embedded fonts.');
  });

  it('should render remediation section when present on embedding finding', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding(),
      makeEmbeddingFinding({
        status: 'warning',
        remediation: 'Embed all fonts in the PDF.',
      }),
    ]));

    expect(el.textContent).toContain('Remediation');
    expect(el.textContent).toContain('Embed all fonts in the PDF.');
  });

  it('should not render remediation when both findings have null remediation', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({ remediation: null }),
      makeEmbeddingFinding({ remediation: null }),
    ]));

    expect(el.textContent).not.toContain('Remediation');
  });

  it('should have accessible table with caption and scope attributes', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeToUnicodeFinding(), makeEmbeddingFinding()]));

    const caption = el.querySelector('caption');
    expect(caption).toBeDefined();
    expect(caption.textContent).toContain('font(s) found');

    const ths = el.querySelectorAll('th');
    for (const th of ths) {
      expect(th.scope).toBe('col');
    }
  });

  it('should show message when both findings have empty details', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({ details: [] }),
      makeEmbeddingFinding({ details: [] }),
    ]));

    expect(el.textContent).toContain('No font details available');
  });

  it('should render N/A status badge for not-applicable', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeToUnicodeFinding({ status: 'not-applicable' }),
      makeEmbeddingFinding({ status: 'not-applicable' }),
    ]));

    const badges = el.querySelectorAll('.status-badge--not-applicable');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe('N/A');
  });

  it('should work with only font-tounicode finding present', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeToUnicodeFinding()]));

    // Should not crash, should render table
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('should work with only font-embedding finding present', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([
      makeEmbeddingFinding({
        details: [
          { label: 'Arial', value: 'Not embedded' },
        ],
      }),
    ]));

    // Should not crash, should render table
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
  });
});
