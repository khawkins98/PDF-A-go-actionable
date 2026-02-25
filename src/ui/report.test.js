// @vitest-environment happy-dom
/**
 * Tests for the summary report panel renderer.
 *
 * Covers:
 * - Status count calculation (pass/fail/warning/manual/not-applicable)
 * - Overall status determination (fail > warning > pass)
 * - Document metadata rendering
 * - Heading structure
 */
import { describe, it, expect } from 'vitest';
import { renderSummaryPanel } from './report.js';
import { createSessionBus } from './state.js';

function createData(findings, meta = {}) {
  return {
    findings,
    meta: {
      pageCount: 5,
      fileSize: 102400,
      fileName: 'test.pdf',
      title: 'Test Document',
      lang: 'en-US',
      isPdfA: false,
      isPdfUA: false,
      isTagged: true,
      hasStructTree: true,
      displayDocTitle: true,
      ...meta,
    },
  };
}

describe('renderSummaryPanel', () => {
  it('should render into the provided element', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'test', status: 'pass', title: 'Test', summary: 'OK' },
    ]);

    renderSummaryPanel(el, data);

    expect(el.children.length).toBeGreaterThan(0);
  });

  it('should clear previous content before rendering', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>old content</p>';
    const data = createData([]);

    renderSummaryPanel(el, data);

    expect(el.querySelector('p')?.textContent).not.toBe('old content');
  });

  it('should render an h2 heading', () => {
    const el = document.createElement('div');
    const data = createData([]);

    renderSummaryPanel(el, data);

    const heading = el.querySelector('h2');
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain('Summary');
  });

  it('should show correct status counts', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
      { id: 'b', status: 'pass', title: 'B', summary: 'OK' },
      { id: 'c', status: 'fail', title: 'C', summary: 'Bad' },
      { id: 'd', status: 'warning', title: 'D', summary: 'Hmm' },
      { id: 'e', status: 'manual', title: 'E', summary: 'Check' },
    ]);

    renderSummaryPanel(el, data);

    const text = el.textContent;
    expect(text).toContain('2 Pass');
    expect(text).toContain('1 Fail');
    expect(text).toContain('1 Warning');
    expect(text).toContain('1 Manual Review');
  });

  it('should show "Issues Found" badge when there are failures', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'fail', title: 'A', summary: 'Bad' },
    ]);

    renderSummaryPanel(el, data);

    const badge = el.querySelector('.status-badge--fail');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Issues Found');
  });

  it('should show "All Checks Passed" badge when all pass', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
      { id: 'b', status: 'pass', title: 'B', summary: 'OK' },
    ]);

    renderSummaryPanel(el, data);

    const badge = el.querySelector('.status-badge--pass');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('All Checks Passed');
  });

  it('should render document metadata', () => {
    const el = document.createElement('div');
    const data = createData([], {
      title: 'My Report',
      lang: 'fr-FR',
      pageCount: 42,
      isTagged: true,
    });

    renderSummaryPanel(el, data);

    const text = el.textContent;
    expect(text).toContain('My Report');
    expect(text).toContain('fr-FR');
    expect(text).toContain('42');
    expect(text).toContain('Yes'); // isTagged
  });

  it('should show "Not set" for missing title and language', () => {
    const el = document.createElement('div');
    const data = createData([], {
      title: undefined,
      lang: undefined,
    });

    renderSummaryPanel(el, data);

    const text = el.textContent;
    // Should appear twice: once for title, once for language
    const matches = text.match(/Not set/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should have accessible status badge aria-labels', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
    ]);

    renderSummaryPanel(el, data);

    const badges = el.querySelectorAll('[aria-label]');
    expect(badges.length).toBeGreaterThan(0);
    const ariaLabels = [...badges].map((b) => b.getAttribute('aria-label'));
    expect(ariaLabels.some((l) => l.includes('Filter'))).toBe(true);
  });

  it('should render status badges as toggle buttons', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
    ]);

    renderSummaryPanel(el, data);

    const filterBtns = el.querySelectorAll('.status-filter');
    expect(filterBtns.length).toBe(5);
    for (const btn of filterBtns) {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('should toggle aria-pressed and inactive class on click', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
      { id: 'b', status: 'fail', title: 'B', summary: 'Bad' },
    ]);

    renderSummaryPanel(el, data);

    const passBtn = el.querySelector('[data-status="pass"]');
    passBtn.click();

    expect(passBtn.getAttribute('aria-pressed')).toBe('false');
    expect(passBtn.classList.contains('status-filter--inactive')).toBe(true);

    // Click again to re-enable
    passBtn.click();
    expect(passBtn.getAttribute('aria-pressed')).toBe('true');
    expect(passBtn.classList.contains('status-filter--inactive')).toBe(false);
  });

  it('should emit filterStatus event on bus when badge clicked', () => {
    const el = document.createElement('div');
    const bus = createSessionBus();
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
      { id: 'b', status: 'fail', title: 'B', summary: 'Bad' },
    ]);

    renderSummaryPanel(el, data, bus);

    const received = [];
    bus.on('filterStatus', (d) => received.push(d));

    const failBtn = el.querySelector('[data-status="fail"]');
    failBtn.click();

    expect(received).toHaveLength(1);
    expect(received[0].active.has('pass')).toBe(true);
    expect(received[0].active.has('fail')).toBe(false);
  });

  it('should work without a bus (backwards compatibility)', () => {
    const el = document.createElement('div');
    const data = createData([
      { id: 'a', status: 'pass', title: 'A', summary: 'OK' },
    ]);

    // Should not throw
    renderSummaryPanel(el, data);

    const passBtn = el.querySelector('[data-status="pass"]');
    passBtn.click(); // Should not throw without bus
    expect(passBtn.getAttribute('aria-pressed')).toBe('false');
  });
});
