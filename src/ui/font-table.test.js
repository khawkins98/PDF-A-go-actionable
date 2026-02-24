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
 */
import { describe, it, expect } from 'vitest';
import { renderFontTable } from './font-table.js';

function makeData(findings) {
  return { findings };
}

function makeFontFinding(overrides) {
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

  it('should render overall status badge', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding()]));

    const badge = el.querySelector('.status-badge--pass');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Pass');
  });

  it('should render summary text', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({ summary: 'All fonts look good.' })]));

    expect(el.textContent).toContain('All fonts look good.');
  });

  it('should render a table with correct headers', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding()]));

    const ths = el.querySelectorAll('th');
    const headers = [...ths].map(th => th.textContent);
    expect(headers).toContain('Font Name');
    expect(headers).toContain('ToUnicode');
    expect(headers).toContain('Embedded');
  });

  it('should render font rows from details', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding()]));

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
    renderFontTable(el, makeData([makeFontFinding({
      status: 'warning',
      details: [
        { label: 'BrokenFont', value: 'Missing ToUnicode' },
      ],
    })]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);

    const toUnicodeBadge = rows[0].querySelectorAll('td')[1].querySelector('.status-badge--warning');
    expect(toUnicodeBadge).toBeDefined();
    expect(toUnicodeBadge.textContent).toBe('No');
  });

  it('should show warning badge for not-embedded fonts', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({
      details: [
        { label: 'Arial', value: 'Has ToUnicode' },
        { label: 'Arial', value: 'Not embedded' },
      ],
    })]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);

    const embeddedBadge = rows[0].querySelectorAll('td')[2].querySelector('.status-badge--warning');
    expect(embeddedBadge).toBeDefined();
    expect(embeddedBadge.textContent).toBe('No');
  });

  it('should skip "Embedding summary" detail entries', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({
      details: [
        { label: 'Embedding summary', value: '1 embedded, 1 not embedded' },
        { label: 'Arial', value: 'Has ToUnicode' },
      ],
    })]));

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('td').textContent).toBe('Arial');
  });

  it('should render remediation section when present', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({
      status: 'warning',
      remediation: 'Re-export with embedded fonts.',
    })]));

    expect(el.textContent).toContain('Remediation');
    expect(el.textContent).toContain('Re-export with embedded fonts.');
  });

  it('should not render remediation when null', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({ remediation: null })]));

    expect(el.textContent).not.toContain('Remediation');
  });

  it('should have accessible table with caption and scope attributes', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding()]));

    const caption = el.querySelector('caption');
    expect(caption).toBeDefined();
    expect(caption.textContent).toContain('font(s) found');

    const ths = el.querySelectorAll('th');
    for (const th of ths) {
      expect(th.scope).toBe('col');
    }
  });

  it('should show message when finding has empty details', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({ details: [] })]));

    expect(el.textContent).toContain('No font details available');
  });

  it('should render warning status badge for not-applicable', () => {
    const el = document.createElement('div');
    renderFontTable(el, makeData([makeFontFinding({ status: 'not-applicable' })]));

    const badge = el.querySelector('.status-badge--not-applicable');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('N/A');
  });
});
