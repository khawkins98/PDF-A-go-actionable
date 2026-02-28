// @vitest-environment happy-dom
/**
 * Tests for the report dashboard view.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderDashboard } from './dashboard.js';

/** Minimal Finding factory. */
function finding(overrides) {
  return {
    id: 'f-1',
    category: 'metadata',
    title: 'Test Check',
    status: 'pass',
    summary: 'Everything looks good.',
    ...overrides,
  };
}

/** Standard callbacks stub. */
function makeCallbacks() {
  return {
    onViewFullReport: vi.fn(),
    onPreviewPdf: vi.fn(),
    onExport: vi.fn(),
    onUploadAnother: vi.fn(),
  };
}

/** Build a data object with the given findings and optional meta overrides. */
function makeData(findings = [], metaOverrides = {}) {
  return {
    findings,
    meta: {
      fileName: 'test.pdf',
      pageCount: 5,
      fileSize: 1_500_000,
      title: 'My Document',
      lang: 'en-US',
      isTagged: true,
      isPdfUA: true,
      isPdfA: false,
      hasStructTree: true,
      displayDocTitle: true,
      ...metaOverrides,
    },
  };
}

describe('renderDashboard', () => {
  let el;
  let callbacks;

  beforeEach(() => {
    el = document.createElement('div');
    callbacks = makeCallbacks();
  });

  afterEach(() => {
    // Abort any document-level listeners from renderDashboard
    if (el._dashboardAbort) el._dashboardAbort.abort();
  });

  // --- Verdict banner ---

  it('should show "PDF Accessibility Report" title in the verdict', () => {
    const data = makeData([finding({ status: 'pass' })]);
    renderDashboard(el, data, callbacks);

    const title = el.querySelector('.dashboard__verdict-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('PDF Accessibility Report');
  });

  it('should show PASS verdict when no fails or warnings', () => {
    const data = makeData([finding({ status: 'pass' })]);
    renderDashboard(el, data, callbacks);

    const verdict = el.querySelector('.dashboard__verdict');
    const label = el.querySelector('.dashboard__verdict-label');
    expect(verdict.classList.contains('dashboard__verdict--pass')).toBe(true);
    expect(label.textContent).toBe('PASS');
  });

  it('should show FAIL verdict when there are fail findings', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Missing Title' }),
      finding({ status: 'pass', title: 'Language' }),
    ]);
    renderDashboard(el, data, callbacks);

    const verdict = el.querySelector('.dashboard__verdict');
    const label = el.querySelector('.dashboard__verdict-label');
    expect(verdict.classList.contains('dashboard__verdict--fail')).toBe(true);
    expect(label.textContent).toBe('FAIL');
  });

  it('should show PASS WITH WARNINGS verdict when warnings but no fails', () => {
    const data = makeData([
      finding({ status: 'warning', title: 'Font Embedding' }),
      finding({ status: 'pass', title: 'Language' }),
    ]);
    renderDashboard(el, data, callbacks);

    const verdict = el.querySelector('.dashboard__verdict');
    const label = el.querySelector('.dashboard__verdict-label');
    expect(verdict.classList.contains('dashboard__verdict--warning')).toBe(true);
    expect(label.textContent).toBe('PASS WITH WARNINGS');
  });

  it('should set role="status" on the verdict banner', () => {
    const data = makeData([finding({ status: 'pass' })]);
    renderDashboard(el, data, callbacks);

    const verdict = el.querySelector('.dashboard__verdict');
    expect(verdict.getAttribute('role')).toBe('status');
  });

  it('should include pass count in the PASS verdict description', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'pass', title: 'A' }),
      finding({ id: 'f2', status: 'pass', title: 'B' }),
    ]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toContain('2 automated checks passed');
  });

  it('should mention manual review count in PASS verdict when manual items exist', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'pass', title: 'Lang' }),
      finding({ id: 'f2', status: 'manual', title: 'Contrast' }),
      finding({ id: 'f3', status: 'manual', title: 'Reading Order' }),
    ]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toContain('2 items flagged for manual review');
  });

  it('should include fail and pass counts in FAIL verdict description', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'fail', title: 'Title' }),
      finding({ id: 'f2', status: 'fail', title: 'Alt Text' }),
      finding({ id: 'f3', status: 'pass', title: 'Language' }),
    ]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toContain('2 accessibility issues');
    expect(desc.textContent).toContain('1 check passed');
  });

  // --- Status group ordering ---

  it('should render groups in order: fail, warning, manual, pass, not-applicable', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'pass', title: 'Lang' }),
      finding({ id: 'f2', status: 'fail', title: 'Title' }),
      finding({ id: 'f3', status: 'warning', title: 'Font' }),
      finding({ id: 'f4', status: 'manual', title: 'Contrast' }),
      finding({ id: 'f5', status: 'not-applicable', title: 'Forms' }),
    ]);
    renderDashboard(el, data, callbacks);

    const sections = el.querySelectorAll('.dashboard__section');
    const labels = [...sections].map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Needs Attention',
      'Warnings',
      'Manual Review',
      'Passed',
      'Not Applicable',
    ]);
  });

  // --- Fail findings show title and summary ---

  it('should render fail findings with title and summary in full rows', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Missing Title', summary: 'No title set.' }),
    ]);
    renderDashboard(el, data, callbacks);

    const row = el.querySelector('.dashboard__finding-row');
    expect(row).not.toBeNull();
    expect(row.querySelector('.dashboard__finding-title').textContent).toBe('Missing Title');
    expect(row.querySelector('.dashboard__finding-summary').textContent).toBe('No title set.');
  });

  // --- Pass findings show only title as chips ---

  it('should render pass findings as chips with title only', () => {
    const data = makeData([
      finding({ status: 'pass', title: 'Document Language' }),
    ]);
    renderDashboard(el, data, callbacks);

    const chip = el.querySelector('.dashboard__chip--pass');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Document Language');
  });

  // --- N/A findings as chips ---

  it('should render not-applicable findings as chips', () => {
    const data = makeData([
      finding({ status: 'not-applicable', title: 'Form Fields' }),
    ]);
    renderDashboard(el, data, callbacks);

    const chip = el.querySelector('.dashboard__chip--not-applicable');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Form Fields');
  });

  // --- Manual review as compact cards ---

  it('should render manual findings as compact cards', () => {
    const data = makeData([
      finding({ status: 'manual', title: 'Color Contrast', summary: 'Verify contrast.' }),
    ]);
    renderDashboard(el, data, callbacks);

    const card = el.querySelector('.dashboard__finding-compact');
    expect(card).not.toBeNull();
    expect(card.querySelector('.dashboard__finding-title').textContent).toBe('Color Contrast');
    expect(card.querySelector('.dashboard__finding-summary').textContent).toBe('Verify contrast.');
  });

  // --- Metadata grid ---

  it('should render document properties in the header for at-a-glance visibility', () => {
    const data = makeData([], {
      title: 'Annual Report',
      lang: 'en-US',
      pageCount: 12,
      fileSize: 1_400_000,
      isTagged: true,
      isPdfUA: true,
    });
    renderDashboard(el, data, callbacks);

    const header = el.querySelector('.dashboard__header');
    const grid = header.querySelector('.dashboard__meta-grid');
    expect(grid).not.toBeNull();

    const dts = grid.querySelectorAll('dt');
    const labels = [...dts].map((dt) => dt.textContent);
    expect(labels).toContain('Title');
    expect(labels).toContain('Language');
    expect(labels).toContain('Pages');
    expect(labels).toContain('File Size');
    expect(labels).toContain('Tagged');
  });

  it('should show "Not set" with warning style for missing title in metadata', () => {
    const data = makeData([], { title: null });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const titleDt = dts.find((dt) => dt.textContent === 'Title');
    const titleDd = titleDt.nextElementSibling;
    expect(titleDd.textContent).toBe('Not set');
    expect(titleDd.classList.contains('dashboard__meta-warn')).toBe(true);
  });

  it('should show warning style for missing author, subject, and keywords', () => {
    const data = makeData([], { author: null, subject: null, keywords: null });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    for (const label of ['Author', 'Subject', 'Keywords']) {
      const dt = dts.find((d) => d.textContent === label);
      expect(dt, `${label} should be present`).not.toBeUndefined();
      const dd = dt.nextElementSibling;
      expect(dd.textContent).toBe('Not set');
      expect(dd.classList.contains('dashboard__meta-warn')).toBe(true);
    }
  });

  it('should not show warning style when author/subject/keywords are set', () => {
    const data = makeData([], {
      author: 'Jane Doe',
      subject: 'Annual Report',
      keywords: 'accessibility, pdf',
    });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    for (const label of ['Author', 'Subject', 'Keywords']) {
      const dt = dts.find((d) => d.textContent === label);
      const dd = dt.nextElementSibling;
      expect(dd.classList.contains('dashboard__meta-warn')).toBe(false);
    }
  });

  // --- Action buttons ---

  it('should render View Full Report, Preview PDF, Download Report, and Upload Another PDF buttons', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const buttons = el.querySelectorAll('.dashboard__action-btn');
    const labels = [...buttons].map((b) => b.textContent);
    expect(labels).toContain('View Full Report');
    expect(labels).toContain('Preview PDF');
    expect(labels).toContain('Upload Another PDF');
    // The download button has a down arrow
    expect(labels.some((l) => l.startsWith('Download Report'))).toBe(true);
  });

  // --- Callback wiring ---

  it('should fire onViewFullReport when "View Full Report" is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'View Full Report');
    btn.click();
    expect(callbacks.onViewFullReport).toHaveBeenCalledOnce();
  });

  it('should fire onPreviewPdf when "Preview PDF" is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'Preview PDF');
    btn.click();
    expect(callbacks.onPreviewPdf).toHaveBeenCalledOnce();
  });

  it('should fire onUploadAnother when "Upload Another PDF" is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'Upload Another PDF');
    btn.click();
    expect(callbacks.onUploadAnother).toHaveBeenCalledOnce();
  });

  // --- Export dropdown ---

  it('should toggle export menu on button click', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    const menu = el.querySelector('.dashboard__export-menu');
    expect(menu.hidden).toBe(true);

    exportBtn.click();
    expect(menu.hidden).toBe(false);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('true');

    exportBtn.click();
    expect(menu.hidden).toBe(true);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should fire onExport with format when export menu item is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    exportBtn.click();

    const items = el.querySelectorAll('.dashboard__export-item');
    expect(items.length).toBe(3);

    items[0].click(); // JSON
    expect(callbacks.onExport).toHaveBeenCalledWith('json');

    items[1].click(); // CSV
    expect(callbacks.onExport).toHaveBeenCalledWith('csv');

    items[2].click(); // PDF
    expect(callbacks.onExport).toHaveBeenCalledWith('pdf');
  });

  // --- Empty findings ---

  it('should render gracefully with empty findings array (pass verdict, no sections)', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const label = el.querySelector('.dashboard__verdict-label');
    expect(label.textContent).toBe('PASS');

    const sections = el.querySelectorAll('.dashboard__section');
    expect(sections.length).toBe(0);
  });

  // --- Sections with 0 items hidden ---

  it('should not render sections with 0 findings', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Title Missing' }),
      finding({ status: 'pass', title: 'Language OK' }),
    ]);
    renderDashboard(el, data, callbacks);

    const sections = el.querySelectorAll('.dashboard__section');
    const labels = [...sections].map((s) => s.getAttribute('aria-label'));
    // Should only have "Needs Attention" and "Passed", not Warning/Manual/N/A
    expect(labels).toEqual(['Needs Attention', 'Passed']);
  });

  // --- File facts line ---

  it('should display file facts (pages, size, tagged, language)', () => {
    const data = makeData([], {
      pageCount: 12,
      fileSize: 1_400_000,
      isTagged: true,
      lang: 'en-US',
    });
    renderDashboard(el, data, callbacks);

    const facts = el.querySelector('.dashboard__file-facts');
    expect(facts).not.toBeNull();
    expect(facts.textContent).toContain('12 pages');
    expect(facts.textContent).toContain('MB');
    expect(facts.textContent).toContain('Tagged');
    expect(facts.textContent).toContain('en-US');
  });

  // --- Accessibility: heading hierarchy ---

  it('should use h2 for report title and h3 for file name and status group sections', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Title' }),
      finding({ status: 'pass', title: 'Lang' }),
    ]);
    renderDashboard(el, data, callbacks);

    const h2s = el.querySelectorAll('h2');
    expect(h2s.length).toBe(1);
    expect(h2s[0].textContent).toBe('PDF Accessibility Report');

    const h3s = el.querySelectorAll('h3');
    // File name, "Needs Attention", "Passed"
    expect(h3s.length).toBe(3);
    expect(h3s[0].textContent).toBe('test.pdf');
  });

  // --- Sections use aria-label ---

  it('should have aria-label on each status group section', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Title' }),
    ]);
    renderDashboard(el, data, callbacks);

    const section = el.querySelector('.dashboard__section');
    expect(section.getAttribute('aria-label')).toBe('Needs Attention');
  });

  // --- Empty findings description ---

  it('should show "No checks were performed" when findings array is empty', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toBe('No checks were performed.');
  });

  // --- Warning verdict description ---

  it('should include warning count and pass count in PASS WITH WARNINGS description', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'warning', title: 'Font' }),
      finding({ id: 'f2', status: 'warning', title: 'Reading' }),
      finding({ id: 'f3', status: 'pass', title: 'Lang' }),
    ]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toContain('2 warnings need review');
    expect(desc.textContent).toContain('1 check passed');
  });

  // --- Export menu closes on item click ---

  it('should close export menu when a menu item is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    const menu = el.querySelector('.dashboard__export-menu');
    exportBtn.click();
    expect(menu.hidden).toBe(false);

    const items = el.querySelectorAll('.dashboard__export-item');
    items[0].click();
    expect(menu.hidden).toBe(true);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
  });

  // --- Export menu keyboard navigation ---

  it('should close export menu on Escape and return focus to trigger button', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    const menu = el.querySelector('.dashboard__export-menu');
    exportBtn.click();
    expect(menu.hidden).toBe(false);

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('should navigate export menu items with ArrowDown and ArrowUp', () => {
    // Attach to document so focus() works
    document.body.appendChild(el);
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    exportBtn.click();

    const items = el.querySelectorAll('.dashboard__export-item');
    // First item should have focus after opening
    expect(document.activeElement).toBe(items[0]);

    // ArrowDown moves to next item
    el.querySelector('.dashboard__export-menu').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement).toBe(items[1]);

    // ArrowUp moves back
    el.querySelector('.dashboard__export-menu').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    expect(document.activeElement).toBe(items[0]);

    document.body.removeChild(el);
  });

  it('should set tabindex="-1" on export menu items', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const items = el.querySelectorAll('.dashboard__export-item');
    for (const item of items) {
      expect(item.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('should set aria-controls on export trigger button', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const exportBtn = el.querySelector('[aria-haspopup="true"]');
    const menu = el.querySelector('.dashboard__export-menu');
    expect(exportBtn.getAttribute('aria-controls')).toBe(menu.id);
  });

  // --- Creator/producer conditional rendering ---

  it('should show Creator and Producer in metadata when present', () => {
    const data = makeData([], { creator: 'Adobe InDesign', producer: 'Adobe PDF Library' });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const labels = dts.map((d) => d.textContent);
    expect(labels).toContain('Creator');
    expect(labels).toContain('Producer');
  });

  it('should not show Creator and Producer in metadata when absent', () => {
    const data = makeData([], { creator: undefined, producer: undefined });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const labels = dts.map((d) => d.textContent);
    expect(labels).not.toContain('Creator');
    expect(labels).not.toContain('Producer');
  });

  // --- File facts edge cases ---

  it('should show singular "page" for single-page documents', () => {
    const data = makeData([], { pageCount: 1 });
    renderDashboard(el, data, callbacks);

    const facts = el.querySelector('.dashboard__file-facts');
    expect(facts.textContent).toContain('1 page');
    expect(facts.textContent).not.toContain('1 pages');
  });

  it('should omit Tagged and PDF/UA from file facts when false', () => {
    const data = makeData([], { isTagged: false, isPdfUA: false, lang: null });
    renderDashboard(el, data, callbacks);

    const facts = el.querySelector('.dashboard__file-facts');
    expect(facts.textContent).not.toContain('Tagged');
    expect(facts.textContent).not.toContain('PDF/UA');
  });

  // --- className preserves existing classes ---

  it('should preserve existing classes on the container element', () => {
    el.className = 'results-main';
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    expect(el.classList.contains('results-main')).toBe(true);
    expect(el.classList.contains('dashboard')).toBe(true);
  });

  // --- Re-render cleans up previous listeners ---

  it('should abort previous document listeners when re-rendered', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const firstAbort = el._dashboardAbort;
    const abortSpy = vi.spyOn(firstAbort, 'abort');

    renderDashboard(el, data, callbacks);
    expect(abortSpy).toHaveBeenCalledOnce();
  });

  // --- displayDocTitle warning ---

  it('should show warning style for displayDocTitle when false', () => {
    const data = makeData([], { displayDocTitle: false });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const dt = dts.find((d) => d.textContent === 'Display Doc Title');
    const dd = dt.nextElementSibling;
    expect(dd.textContent).toBe('No');
    expect(dd.classList.contains('dashboard__meta-warn')).toBe(true);
  });
});
