/**
 * Tests for shared assertion helpers.
 */
import { describe, it, expect } from 'vitest';
import { findFindingById, expectFindingStatus } from './assertions.js';

const SAMPLE_FINDINGS = [
  { id: 'document-title', status: 'pass', title: 'Title' },
  { id: 'document-lang', status: 'fail', title: 'Language' },
  { id: 'image-alt-text', status: 'warning', title: 'Alt Text' },
];

describe('findFindingById', () => {
  it('should return the matching finding', () => {
    const found = findFindingById(SAMPLE_FINDINGS, 'document-lang');
    expect(found.id).toBe('document-lang');
    expect(found.status).toBe('fail');
  });

  it('should throw a descriptive error when finding not found', () => {
    expect(() => findFindingById(SAMPLE_FINDINGS, 'nonexistent'))
      .toThrow('Finding "nonexistent" not found');
  });

  it('should include available IDs in the error message', () => {
    expect(() => findFindingById(SAMPLE_FINDINGS, 'nonexistent'))
      .toThrow('document-title, document-lang, image-alt-text');
  });
});

describe('expectFindingStatus', () => {
  it('should pass when status matches', () => {
    expectFindingStatus(SAMPLE_FINDINGS, 'document-title', 'pass', expect);
  });

  it('should fail when status does not match', () => {
    expect(() => expectFindingStatus(SAMPLE_FINDINGS, 'document-title', 'fail', expect))
      .toThrow();
  });

  it('should throw when finding ID not found', () => {
    expect(() => expectFindingStatus(SAMPLE_FINDINGS, 'nope', 'pass', expect))
      .toThrow('Finding "nope" not found');
  });
});
