/**
 * Event bus for inter-panel communication.
 *
 * The global `state` singleton handles app-level events.
 * Use `createSessionBus()` to create scoped buses for per-analysis sessions
 * (isolates selectFinding events between multiple open results windows).
 *
 * Events:
 * - 'progress' — audit progress update { phase, percent }
 * - 'result' — audit complete { findings, meta }
 * - 'error' — audit error { message }
 * - 'selectFinding' — user selected a finding { findingId }
 */

export class EventBus {
  constructor() {
    this._listeners = new Map();
    this._results = null;
    this._selectedFinding = null;
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const fns = this._listeners.get(event);
    if (fns) {
      const idx = fns.indexOf(fn);
      if (idx !== -1) fns.splice(idx, 1);
    }
  }

  emit(event, data) {
    // Store state for late subscribers
    if (event === 'result') this._results = data;
    if (event === 'selectFinding') this._selectedFinding = data;

    const fns = this._listeners.get(event);
    if (fns) {
      for (const fn of fns) {
        fn(data);
      }
    }
  }

  getResults() {
    return this._results;
  }

  getSelectedFinding() {
    return this._selectedFinding;
  }

  reset() {
    this._results = null;
    this._selectedFinding = null;
  }

  destroy() {
    this._listeners.clear();
    this._results = null;
    this._selectedFinding = null;
  }
}

/** App-level singleton bus. */
export const state = new EventBus();

/** Create a scoped event bus for an analysis session. */
export function createSessionBus() {
  return new EventBus();
}
