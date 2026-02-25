// @vitest-environment happy-dom
/**
 * Tests for the findings list panel renderer.
 *
 * Covers:
 * - Category grouping
 * - Status-based sorting within groups (fail > warning > manual > pass)
 * - Card rendering with title, summary, and status badge
 * - Empty state
 * - Click dispatching selectFinding event on scoped bus
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderFindingsPanel } from './findings-list.js';
import { createSessionBus } from './state.js';

let bus;

beforeEach(() => {
  bus = createSessionBus();
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

    renderFindingsPanel(el, data, bus);

    expect(el.children.length).toBeGreaterThan(0);
  });

  it('should show empty message when no findings', () => {
    const el = document.createElement('div');
    renderFindingsPanel(el, { findings: [] }, bus);

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

    renderFindingsPanel(el, data, bus);

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

    renderFindingsPanel(el, data, bus);

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

    renderFindingsPanel(el, data, bus);

    const card = el.querySelector('.finding-card');
    expect(card.textContent).toContain('Check Title');
    expect(card.textContent).toContain('Check summary text.');
  });

  it('should render status badges', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ id: 'a', status: 'fail' })],
    };

    renderFindingsPanel(el, data, bus);

    const badge = el.querySelector('.status-badge--fail');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('Fail');
  });

  it('should emit selectFinding on scoped bus on card click', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ id: 'my-finding' })],
    };

    renderFindingsPanel(el, data, bus);

    const received = [];
    bus.on('selectFinding', (d) => received.push(d));

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

    renderFindingsPanel(el, data, bus);

    const card = el.querySelector('.finding-card');
    expect(card.tagName).toBe('BUTTON');
    expect(card.type).toBe('button');
  });

  it('should have aria-labels on finding cards', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ title: 'Doc Title', status: 'pass' })],
    };

    renderFindingsPanel(el, data, bus);

    const card = el.querySelector('.finding-card');
    expect(card.getAttribute('aria-label')).toContain('Doc Title');
    expect(card.getAttribute('aria-label')).toContain('pass');
  });

  it('should filter findings when filterStatus event is emitted', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', status: 'pass', title: 'Pass Item' }),
        makeFinding({ id: 'b', status: 'fail', title: 'Fail Item' }),
        makeFinding({ id: 'c', status: 'warning', title: 'Warn Item' }),
      ],
    };

    renderFindingsPanel(el, data, bus);

    // All three visible initially
    expect(el.querySelectorAll('.finding-card').length).toBe(3);

    // Filter to only fail
    bus.emit('filterStatus', { active: new Set(['fail']) });

    const cards = el.querySelectorAll('.finding-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Fail Item');
  });

  it('should show empty message when all statuses are filtered out', () => {
    const el = document.createElement('div');
    const data = {
      findings: [makeFinding({ id: 'a', status: 'pass' })],
    };

    renderFindingsPanel(el, data, bus);
    bus.emit('filterStatus', { active: new Set() });

    expect(el.textContent).toContain('No findings match');
    expect(el.querySelectorAll('.finding-card').length).toBe(0);
  });

  it('should restore selection after filter re-render', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', status: 'fail', title: 'Fail Item' }),
        makeFinding({ id: 'b', status: 'pass', title: 'Pass Item' }),
      ],
    };

    renderFindingsPanel(el, data, bus);

    // Select the fail item
    el.querySelector('.finding-card').click();

    // Re-render with filter that includes the selected item
    bus.emit('filterStatus', { active: new Set(['fail', 'pass']) });

    const selected = el.querySelector('.finding-card--selected');
    expect(selected).not.toBeNull();
    expect(selected.textContent).toContain('Fail Item');
  });

  it('should show all findings again when filter includes all statuses', () => {
    const el = document.createElement('div');
    const data = {
      findings: [
        makeFinding({ id: 'a', status: 'pass', title: 'Pass Item' }),
        makeFinding({ id: 'b', status: 'fail', title: 'Fail Item' }),
      ],
    };

    renderFindingsPanel(el, data, bus);

    // Filter to only pass
    bus.emit('filterStatus', { active: new Set(['pass']) });
    expect(el.querySelectorAll('.finding-card').length).toBe(1);

    // Re-enable all
    bus.emit('filterStatus', { active: new Set(['pass', 'fail', 'warning', 'manual', 'not-applicable']) });
    expect(el.querySelectorAll('.finding-card').length).toBe(2);
  });
});
