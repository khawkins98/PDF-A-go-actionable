/**
 * Tests for the guidance module.
 *
 * Covers:
 * - guidanceTemplates structure validation
 * - getGuidance for valid/invalid categories
 * - externalResources structure
 * - getExternalResources accessor
 */
import { describe, it, expect } from 'vitest';
import {
  guidanceTemplates,
  externalResources,
  getGuidance,
  getExternalResources,
} from './guidance.js';

const EXPECTED_CATEGORIES = [
  'metadata',
  'structure',
  'images',
  'tables',
  'lists',
  'fonts',
  'forms',
  'links',
  'reading-order',
];

describe('guidanceTemplates', () => {
  it('should have entries for all expected categories', () => {
    for (const cat of EXPECTED_CATEGORIES) {
      expect(guidanceTemplates[cat]).toBeDefined();
    }
  });

  it('should have title, description, and steps for each category', () => {
    for (const cat of EXPECTED_CATEGORIES) {
      const t = guidanceTemplates[cat];
      expect(typeof t.title).toBe('string');
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(Array.isArray(t.steps)).toBe(true);
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty strings in steps arrays', () => {
    for (const cat of EXPECTED_CATEGORIES) {
      for (const step of guidanceTemplates[cat].steps) {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getGuidance', () => {
  it('should return guidance for a valid category', () => {
    const result = getGuidance('metadata');
    expect(result).toBeDefined();
    expect(result.title).toBe('Document Metadata');
  });

  it('should return null for an invalid category', () => {
    expect(getGuidance('nonexistent')).toBeNull();
  });

  it('should return the same object as guidanceTemplates entry', () => {
    expect(getGuidance('structure')).toBe(guidanceTemplates.structure);
  });
});

describe('externalResources', () => {
  it('should have tools array', () => {
    expect(Array.isArray(externalResources.tools)).toBe(true);
    expect(externalResources.tools.length).toBeGreaterThan(0);
  });

  it('should have wcagResources array', () => {
    expect(Array.isArray(externalResources.wcagResources)).toBe(true);
    expect(externalResources.wcagResources.length).toBeGreaterThan(0);
  });

  it('should have name and description for each tool', () => {
    for (const tool of externalResources.tools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.platform).toBe('string');
    }
  });

  it('should have name and url for each WCAG resource', () => {
    for (const res of externalResources.wcagResources) {
      expect(typeof res.name).toBe('string');
      expect(typeof res.url).toBe('string');
      expect(typeof res.description).toBe('string');
    }
  });
});

describe('getExternalResources', () => {
  it('should return the externalResources object', () => {
    expect(getExternalResources()).toBe(externalResources);
  });
});
