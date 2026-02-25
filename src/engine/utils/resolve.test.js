/**
 * Tests for the PDFRef resolution helper.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFRef } from 'pdf-lib';
import { resolve } from './resolve.js';

describe('resolve', () => {
  it('should resolve a PDFRef to the looked-up object', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({ Foo: 'Bar' });
    const ref = doc.context.register(dict);

    const result = resolve(ref, doc.context);
    expect(result).toBe(dict);
  });

  it('should pass through non-PDFRef values unchanged', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({ Foo: 'Bar' });
    const name = PDFName.of('Test');

    expect(resolve(dict, doc.context)).toBe(dict);
    expect(resolve(name, doc.context)).toBe(name);
    expect(resolve('hello', doc.context)).toBe('hello');
    expect(resolve(42, doc.context)).toBe(42);
  });

  it('should return undefined for a ref that does not exist in context', async () => {
    const doc = await PDFDocument.create();
    // Create a ref but don't register any object for it
    const orphanRef = PDFRef.of(9999);

    const result = resolve(orphanRef, doc.context);
    expect(result).toBeUndefined();
  });

  it('should return null when given null', async () => {
    const doc = await PDFDocument.create();
    expect(resolve(null, doc.context)).toBeNull();
  });

  it('should return undefined when given undefined', async () => {
    const doc = await PDFDocument.create();
    expect(resolve(undefined, doc.context)).toBeUndefined();
  });
});
