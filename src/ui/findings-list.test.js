// @vitest-environment happy-dom
/**
 * Tests for the findings list panel renderer.
 *
 * Covers:
 * - Category grouping
 * - Status-based sorting within groups (fail > warning > manual > pass)
 * - Card rendering with title, summary, and status badge
 * - Empty state
 * - Click dispatching selectFinding event
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFindingsPanel } from './findings-list.js';
import { state } from './state.js';

beforeEach(() => {
  state.reset();
  state._listeners = new Map();
});

function makeFinding(overrides) {
  return {
    id: 'test-finding',
    category: 'metadata',
    title: 'Test Finding',
    status: 'pass',
    summary: 'Everything looks good.',
    ...overrides,
  };
}

describe('renderFindingsPanel', () => {
  it('should render into the provided element', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding()],
    };

    renderFindingsPanel(el, data);

    expect(el.children.length).toBeGreaterThan(0);
  });

  it('should show empty message when no findings', () => {
    const el = document.createElement('div');
    renderFindingsPanel(el, { findings: [] });

    expect(el.textContent).toContain('No findings to display');
  });

  it('should group findings by category', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', category: 'metadata', title: 'Title A' }),
        makeFinding({ id: 'b', category: 'structure', title: 'Title B' }),
        makeFinding({ id: 'c', category: 'metadata', title: 'Title C' }),
      ],
    };

    renderFindingsPanel(el, data);

    const sections = el.querySelectorAll('section');
    expect(sections.length).toBe(2); // metadata and structure
  });

  it('should sort findings within a group by status priority', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', category: 'metadata', status: 'pass', title: 'Pass Item' }),
        makeFinding({ id: 'b', category: 'metadata', status: 'fail', title: 'Fail Item' }),
        makeFinding({ id: 'c', category: 'metadata', status: 'warning', title: 'Warn Item' }),
      ],
    };

    renderFindingsPanel(el, data);

    const cards = el.querySelectorAll('.finding-card');
    const labels = [...cards].map((c) => c.querySelector('strong').textContent);

    // fail should come before warning, which comes before pass
    expect(labels.indexOf('Fail Item')).toBeLessThan(labels.indexOf('Warn Item'));
    expect(labels.indexOf('Warn Item')).toBeLessThan(labels.indexOf('Pass Item'));
  });

  it('should render finding title and summary in each card', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', title: 'Check Title', summary: 'Check summary text.' }),
      ],
    };

    renderFindingsPanel(el, data);

    const card = el.querySelector('.finding-card');
    expect(card.textContent).toContain('Check Title');
    expect(card.textContent).toContain('Check summary text.');
  });

  it('should render status badges', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ id: 'a', status: 'fail' })],
    };

    renderFindingsPanel(el, data);

    const badge = el.querySelector('.status-badge--fail');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Fail');
  });

  it('should emit selectFinding on card click', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ id: 'my-finding' })],
    };

    renderFindingsPanel(el, data);

    const received = [];
    state.on('selectFinding', (d) => received.push(d));

    const card = el.querySelector('.finding-card');
    card.click();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ findingId: 'my-finding' });
  });

  it('should use button elements for keyboard accessibility', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding()],
    };

    renderFindingsPanel(el, data);

    const card = el.querySelector('.finding-card');
    expect(card.tagName).toBe('BUTTON');
    expect(card.type).toBe('button');
  });

  it('should have aria-labels on finding cards', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ title: 'Doc Title', status: 'pass' })],
    };

    renderFindingsPanel(el, data);

    const card = el.querySelector('.finding-card');
    expect(card.getAttribute('aria-label')).toContain('Doc Title');
    expect(card.getAttribute('aria-label')).toContain('pass');
  });
});
