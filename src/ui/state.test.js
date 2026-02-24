/**
 * Tests for the EventBus (state.js).
 *
 * Covers:
 * - on/off subscribe/unsubscribe
 * - emit delivers to listeners
 * - result and selectFinding state storage
 * - late subscriber access via getResults/getSelectedFinding
 * - reset clears stored state
 * - unsubscribe function returned by on()
 * - no errors when emitting to no listeners
 * - EventBus class export
 * - createSessionBus factory
 * - destroy method
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { state, EventBus, createSessionBus } from './state.js';

describe('EventBus (state)', () => {
  beforeEach(() => {
    state.reset();
    // Clear all listeners by reconstructing internal state
    state._listeners = new Map();
  });

  describe('on / emit', () => {
    it('should deliver emitted events to listeners', () => {
      const received = [];
      state.on('test-event', (data) => received.push(data));

      state.emit('test-event', { value: 42 });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ value: 42 });
    });

    it('should deliver to multiple listeners on the same event', () => {
      const received1 = [];
      const received2 = [];
      state.on('test-event', (data) => received1.push(data));
      state.on('test-event', (data) => received2.push(data));

      state.emit('test-event', { value: 'hello' });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('should not deliver events to listeners on different events', () => {
      const received = [];
      state.on('event-a', (data) => received.push(data));

      state.emit('event-b', { value: 1 });

      expect(received).toHaveLength(0);
    });
  });

  describe('off', () => {
    it('should remove a listener', () => {
      const received = [];
      const fn = (data) => received.push(data);
      state.on('test-event', fn);

      state.emit('test-event', { value: 1 });
      expect(received).toHaveLength(1);

      state.off('test-event', fn);
      state.emit('test-event', { value: 2 });
      expect(received).toHaveLength(1); // no new delivery
    });

    it('should not error when removing a non-existent listener', () => {
      expect(() => state.off('no-event', () => {})).not.toThrow();
    });
  });

  describe('unsubscribe return value', () => {
    it('should return an unsubscribe function from on()', () => {
      const received = [];
      const unsubscribe = state.on('test-event', (data) => received.push(data));

      expect(typeof unsubscribe).toBe('function');

      state.emit('test-event', { value: 1 });
      expect(received).toHaveLength(1);

      unsubscribe();
      state.emit('test-event', { value: 2 });
      expect(received).toHaveLength(1); // no new delivery
    });
  });

  describe('state storage for result events', () => {
    it('should store result data on emit', () => {
      const resultData = { findings: [], meta: {} };
      state.emit('result', resultData);

      expect(state.getResults()).toBe(resultData);
    });

    it('should store selectFinding data on emit', () => {
      const findingData = { findingId: 'test-finding' };
      state.emit('selectFinding', findingData);

      expect(state.getSelectedFinding()).toBe(findingData);
    });

    it('should not store data for other event types', () => {
      state.emit('progress', { percent: 50 });

      expect(state.getResults()).toBeNull();
      expect(state.getSelectedFinding()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear stored results and selected finding', () => {
      state.emit('result', { findings: [] });
      state.emit('selectFinding', { findingId: 'test' });

      state.reset();

      expect(state.getResults()).toBeNull();
      expect(state.getSelectedFinding()).toBeNull();
    });
  });

  describe('emit with no listeners', () => {
    it('should not error when no listeners registered', () => {
      expect(() => state.emit('unknown-event', { data: 1 })).not.toThrow();
    });
  });
});

describe('EventBus class export', () => {
  it('should export EventBus as a class', () => {
    expect(EventBus).toBeDefined();
    expect(typeof EventBus).toBe('function');
  });

  it('should allow creating independent instances', () => {
    const bus1 = new EventBus();
    const bus2 = new EventBus();

    const received1 = [];
    const received2 = [];
    bus1.on('test', (d) => received1.push(d));
    bus2.on('test', (d) => received2.push(d));

    bus1.emit('test', { from: 'bus1' });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(0); // isolated
  });
});

describe('createSessionBus', () => {
  it('should return a new EventBus instance', () => {
    const bus = createSessionBus();
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('should return isolated buses each time', () => {
    const bus1 = createSessionBus();
    const bus2 = createSessionBus();
    expect(bus1).not.toBe(bus2);

    const received = [];
    bus1.on('selectFinding', (d) => received.push(d));

    bus2.emit('selectFinding', { findingId: 'x' });

    expect(received).toHaveLength(0); // bus2 events don't reach bus1
  });
});

describe('destroy', () => {
  it('should clear all listeners and stored state', () => {
    const bus = createSessionBus();

    const received = [];
    bus.on('test', (d) => received.push(d));
    bus.emit('result', { findings: [] });
    bus.emit('selectFinding', { findingId: 'x' });

    bus.destroy();

    // State cleared
    expect(bus.getResults()).toBeNull();
    expect(bus.getSelectedFinding()).toBeNull();

    // Listeners cleared — no delivery after destroy
    bus.emit('test', { value: 1 });
    expect(received).toHaveLength(0);
  });
});
