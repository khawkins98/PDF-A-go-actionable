// @vitest-environment happy-dom
/**
 * Tests for the details panel renderer.
 *
 * Covers:
 * - Placeholder state when no finding is selected
 * - Rendering a selected finding (title, status, summary, remediation, refs)
 * - Late subscriber — shows already-selected finding on init
 * - Details array rendering
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDetailsPanel } from './details.js';
import { state } from './state.js';

beforeEach(() => {
  state.reset();
  state._listeners = new Map();
});

function makeFinding(overrides) {
  return {
    id: 'test-finding',
    category: 'metadata',
    title: 'Document Title',
    status: 'fail',
    summary: 'The document title is missing.',
    remediation: 'Set a title in your PDF authoring tool.',
    wcagRef: '2.4.2',
    pdfuaRef: '7.1',
    details: [],
    ...overrides,
  };
}

describe('renderDetailsPanel', () => {
  it('should show placeholder when no finding is selected', () => {
    const el = document.createElement('div');
    const data = { findings: [makeFinding()] };

    renderDetailsPanel(el, data);

    expect(el.textContent).toContain('Select a finding');
  });

  it('should render finding details when selectFinding is emitted', () => {
    const el = document.createElement('div');
    const finding = makeFinding({ id: 'doc-title', title: 'Document Title' });
    const data = { findings: [finding] };

    renderDetailsPanel(el, data);

    // Simulate finding selection
    state.emit('selectFinding', { findingId: 'doc-title' });

    expect(el.textContent).toContain('Document Title');
    expect(el.textContent).toContain('The document title is missing.');
  });

  it('should render the status badge', () => {
    const el = document.createElement('div');
    const data = { findings: [makeFinding({ id: 'f1', status: 'fail' })] };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    const badge = el.querySelector('.status-badge--fail');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Fail');
  });

  it('should render remediation section when present', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'f1', remediation: 'Fix by doing X.' }),
      ],
    };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    expect(el.textContent).toContain('How to Fix');
    expect(el.textContent).toContain('Fix by doing X.');
  });

  it('should not render remediation section when absent', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'f1', remediation: null }),
      ],
    };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    expect(el.textContent).not.toContain('How to Fix');
  });

  it('should render WCAG and PDF/UA references', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'f1', wcagRef: '1.3.1', pdfuaRef: '7.4.2' }),
      ],
    };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    expect(el.textContent).toContain('WCAG 2.1 SC 1.3.1');
    expect(el.textContent).toContain('PDF/UA-1 clause 7.4.2');
  });

  it('should render details array as definition list', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({
          id: 'f1',
          details: [
            { label: 'Element', value: 'Figure 1' },
            { label: 'Issue', value: 'Missing alt text' },
          ],
        }),
      ],
    };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    const dts = el.querySelectorAll('dt');
    const dds = el.querySelectorAll('dd');
    expect(dts.length).toBe(2);
    expect(dds.length).toBe(2);
    expect(dts[0].textContent).toBe('Element');
    expect(dds[0].textContent).toBe('Figure 1');
  });

  it('should handle late subscriber — show already-selected finding on init', () => {
    const el = document.createElement('div');
    const data = { findings: [makeFinding({ id: 'f1', title: 'Late Finding' })] };

    // Emit selectFinding BEFORE rendering the panel
    state.emit('selectFinding', { findingId: 'f1' });

    renderDetailsPanel(el, data);

    // Should show the finding immediately, not the placeholder
    expect(el.textContent).toContain('Late Finding');
    expect(el.textContent).not.toContain('Select a finding');
  });

  it('should replace content when a new finding is selected', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'f1', title: 'First Finding' }),
        makeFinding({ id: 'f2', title: 'Second Finding' }),
      ],
    };

    renderDetailsPanel(el, data);

    state.emit('selectFinding', { findingId: 'f1' });
    expect(el.textContent).toContain('First Finding');

    state.emit('selectFinding', { findingId: 'f2' });
    expect(el.textContent).toContain('Second Finding');
    expect(el.textContent).not.toContain('First Finding');
  });

  it('should use semantic sections with aria-labels', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'f1', remediation: 'Fix it', details: [{ label: 'X', value: 'Y' }] }),
      ],
    };

    renderDetailsPanel(el, data);
    state.emit('selectFinding', { findingId: 'f1' });

    const sections = el.querySelectorAll('section[aria-label]');
    const labels = [...sections].map((s) => s.getAttribute('aria-label'));
    expect(labels).toContain('Summary');
    expect(labels).toContain('Remediation');
    expect(labels).toContain('Details');
  });
});
