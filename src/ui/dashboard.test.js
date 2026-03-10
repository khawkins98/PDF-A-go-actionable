// @vitest-environment happy-dom
/**
 * Tests for the report dashboard view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderDashboard } from './dashboard.js';
import { META_TOOLTIPS } from '../guidance.js';

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

  it('should set role="status" on the verdict label, not the banner', () => {
    const data = makeData([finding({ status: 'pass' })]);
    renderDashboard(el, data, callbacks);

    const verdict = el.querySelector('.dashboard__verdict');
    expect(verdict.getAttribute('role')).toBeNull();

    const label = el.querySelector('.dashboard__verdict-label');
    expect(label.getAttribute('role')).toBe('status');
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
      'Requires Attention',
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

  it('should render Download Report, View Advanced Report, Preview PDF, and Upload Another PDF buttons', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const buttons = el.querySelectorAll('.dashboard__action-btn');
    const labels = [...buttons].map((b) => b.textContent);
    expect(labels).toContain('Download Report');
    expect(labels).toContain('View Advanced Report');
    expect(labels).toContain('Preview PDF');
    expect(labels).toContain('Upload Another PDF');
  });

  it('should render Download Report as the primary button', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'Download Report');
    expect(btn.classList.contains('dashboard__action-btn--primary')).toBe(true);
  });

  // --- Callback wiring ---

  it('should fire onExport with "pdf" when "Download Report" is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'Download Report');
    btn.click();
    expect(callbacks.onExport).toHaveBeenCalledWith('pdf');
  });

  it('should fire onViewFullReport when "View Advanced Report" is clicked', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const btn = [...el.querySelectorAll('.dashboard__action-btn')]
      .find((b) => b.textContent === 'View Advanced Report');
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
    // Should only have "Requires Attention" and "Passed", not Warning/Manual/N/A
    expect(labels).toEqual(['Requires Attention', 'Passed']);
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
    // File name, "Requires Attention", "Passed"
    expect(h3s.length).toBe(3);
    expect(h3s[0].textContent).toBe('test.pdf');
  });

  it('should show document title below filename when title is set', () => {
    const data = makeData([finding({ status: 'pass', title: 'Lang' })]);
    renderDashboard(el, data, callbacks);

    const docTitle = el.querySelector('.dashboard__doc-title');
    expect(docTitle).not.toBeNull();
    expect(docTitle.textContent).toBe('My Document');
  });

  it('should not show document title when title is missing', () => {
    const data = makeData([finding({ status: 'pass', title: 'Lang' })]);
    data.meta.title = '';
    renderDashboard(el, data, callbacks);

    const docTitle = el.querySelector('.dashboard__doc-title');
    expect(docTitle).toBeNull();
  });

  // --- Sections use aria-label ---

  it('should have aria-label on each status group section', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Title' }),
    ]);
    renderDashboard(el, data, callbacks);

    const section = el.querySelector('.dashboard__section');
    expect(section.getAttribute('aria-label')).toBe('Requires Attention');
  });

  // --- Empty findings description ---

  it('should show "No checks were performed" when findings array is empty', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toBe('No checks were performed.');
  });

  it('should show "No automated checks" when only manual findings exist', () => {
    const data = makeData([
      finding({ id: 'f1', status: 'manual', title: 'Contrast' }),
      finding({ id: 'f2', status: 'manual', title: 'Reading Order' }),
    ]);
    renderDashboard(el, data, callbacks);

    const desc = el.querySelector('.dashboard__verdict-desc');
    expect(desc.textContent).toBe(
      'No automated checks were performed. 2 items flagged for manual review.',
    );
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

  // --- Creator-specific hints ---

  it('should show creator hint banner for InDesign PDFs', () => {
    const data = makeData([], { creator: 'Adobe InDesign 2025', producer: 'Adobe PDF Library 17.0' });
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__creator-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toContain('Created with Adobe InDesign');
    expect(hint.textContent).toContain('reading order');
    expect(hint.getAttribute('role')).toBe('note');
  });

  it('should show creator hint banner for Word PDFs', () => {
    const data = makeData([], { creator: 'Microsoft Word 365' });
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__creator-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toContain('Created with Microsoft Word');
  });

  it('should show creator hint banner for PowerPoint PDFs', () => {
    const data = makeData([], { producer: 'Microsoft PowerPoint 2021' });
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__creator-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toContain('Created with Microsoft PowerPoint');
  });

  it('should not show creator hint for unknown tools', () => {
    const data = makeData([], { creator: 'PptxGenJS', producer: 'some-lib' });
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__creator-hint');
    expect(hint).toBeNull();
  });

  it('should not show creator hint when no creator/producer metadata', () => {
    const data = makeData([], {});
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__creator-hint');
    expect(hint).toBeNull();
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

  // --- Accessibility: aria-hidden on decorative badges ---

  it('should set aria-hidden on status badges in finding rows and compact cards', () => {
    const data = makeData([
      finding({ status: 'fail', title: 'Title Missing' }),
      finding({ status: 'manual', title: 'Contrast' }),
    ]);
    renderDashboard(el, data, callbacks);

    const badges = el.querySelectorAll('.status-badge');
    for (const badge of badges) {
      expect(badge.getAttribute('aria-hidden')).toBe('true');
    }
  });

  // --- Metadata tooltips ---

  it('should add data-tooltip and title attributes to metadata dt elements', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const titleDt = dts.find((d) => d.textContent === 'Title');
    expect(titleDt.getAttribute('data-tooltip')).toBe(META_TOOLTIPS['Title']);
    expect(titleDt.getAttribute('title')).toBe(META_TOOLTIPS['Title']);
  });

  it('should add tabindex="0" and has-tooltip class for keyboard access', () => {
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const langDt = dts.find((d) => d.textContent === 'Language');
    expect(langDt.getAttribute('tabindex')).toBe('0');
    expect(langDt.classList.contains('has-tooltip')).toBe(true);
  });

  it('should have tooltips on all standard metadata labels', () => {
    const data = makeData([], { creator: 'Adobe InDesign', producer: 'Adobe PDF Library' });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    for (const dt of dts) {
      const label = dt.textContent;
      if (META_TOOLTIPS[label]) {
        expect(dt.hasAttribute('data-tooltip'), `${label} should have data-tooltip`).toBe(true);
      }
    }
  });

  it('should not add tooltip attributes when label is not in META_TOOLTIPS', () => {
    // All current labels are in META_TOOLTIPS, so this verifies the guard works
    // by checking that no dt has a tooltip without a matching META_TOOLTIPS key
    const data = makeData([]);
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    for (const dt of dts) {
      if (dt.hasAttribute('data-tooltip')) {
        expect(META_TOOLTIPS[dt.textContent]).toBeDefined();
      }
    }
  });

  // --- displayDocTitle warning ---

  it('should show Viewer Shows Title without warning style when false', () => {
    const data = makeData([], { displayDocTitle: false });
    renderDashboard(el, data, callbacks);

    const grid = el.querySelector('.dashboard__meta-grid');
    const dts = [...grid.querySelectorAll('dt')];
    const dt = dts.find((d) => d.textContent === 'Viewer Shows Title');
    const dd = dt.nextElementSibling;
    expect(dd.textContent).toBe('No');
    expect(dd.classList.contains('dashboard__meta-warn')).toBe(false);
  });

  // --- Remediation hints on fail/warning rows ---

  it('should show remediation hint on fail finding rows', () => {
    const data = makeData([
      finding({
        status: 'fail',
        title: 'Missing Title',
        summary: 'No title set.',
        remediation: 'Set the document title in your authoring tool. Use something descriptive.',
      }),
    ]);
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__finding-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toBe('Set the document title in your authoring tool.');
  });

  it('should show remediation hint on warning finding rows', () => {
    const data = makeData([
      finding({
        status: 'warning',
        title: 'Font Issue',
        summary: 'Some fonts lack ToUnicode.',
        remediation: 'Embed all fonts when exporting. In Word: use standard fonts.',
      }),
    ]);
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__finding-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toBe('Embed all fonts when exporting.');
  });

  it('should not show remediation hint when finding has no remediation', () => {
    const data = makeData([
      finding({
        status: 'fail',
        title: 'Missing Title',
        summary: 'No title set.',
        remediation: null,
      }),
    ]);
    renderDashboard(el, data, callbacks);

    const hint = el.querySelector('.dashboard__finding-hint');
    expect(hint).toBeNull();
  });
});
