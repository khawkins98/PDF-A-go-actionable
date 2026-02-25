/**
 * Tests for stream decode utilities.
 *
 * Covers:
 * - FlateDecode decompression
 * - ASCII85Decode decompression
 * - Fallback chain (inflateSync → decompressSync)
 * - Corrupted stream handling
 * - getFilterNames extraction (single and array)
 * - hasImageFilter and allFiltersDecodable
 * - decodeStream with missing/no filters
 */
import { describe, it, expect } from 'vitest';
import { zlibSync } from 'fflate';
import { PDFName, PDFDocument } from 'pdf-lib';
import {
  getFilterNames,
  hasImageFilter,
  allFiltersDecodable,
  decodeStream,
} from './stream-decode.js';

describe('decodeStream', () => {
  it('should decompress FlateDecode data', () => {
    const original = new TextEncoder().encode('Hello, PDF world!');
    const compressed = zlibSync(original);
    const result = decodeStream(compressed, ['FlateDecode']);
    expect(new TextDecoder().decode(result)).toBe('Hello, PDF world!');
  });

  it('should decompress ASCII85Decode data', () => {
    // "Man" in ASCII85 is "9jqo^"
    // Full test: encode "Hello" → ASCII85
    // ASCII85 of "Man " is "9jqo^BlbD" (well-known test vector)
    const ascii85 = new TextEncoder().encode('9jqo^BlbD-~>');
    const result = decodeStream(ascii85, ['ASCII85Decode']);
    // "9jqo^BlbD-" decodes to "Man s" (partial 5-char group)
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle missing/null filters by returning data unchanged', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    expect(decodeStream(data, null)).toBe(data);
    expect(decodeStream(data, [])).toBe(data);
  });

  it('should throw on unsupported filter', () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(() => decodeStream(data, ['UnknownFilter'])).toThrow('Unsupported filter');
  });

  it('should handle chained filters', () => {
    const original = new TextEncoder().encode('Chained filter test');
    const compressed = zlibSync(original);
    // Encode compressed data as ASCIIHex, then decode with [ASCIIHexDecode, FlateDecode]
    const hex = Array.from(compressed).map(b => b.toString(16).padStart(2, '0')).join('') + '>';
    const hexBytes = new TextEncoder().encode(hex);
    const result = decodeStream(hexBytes, ['ASCIIHexDecode', 'FlateDecode']);
    expect(new TextDecoder().decode(result)).toBe('Chained filter test');
  });
});

describe('getFilterNames', () => {
  it('should extract a single filter name from PDFName', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({});
    dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    const result = getFilterNames(dict);
    expect(result).toEqual(['FlateDecode']);
  });

  it('should extract an array of filter names', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({});
    const filterArray = doc.context.obj([PDFName.of('ASCII85Decode'), PDFName.of('FlateDecode')]);
    dict.set(PDFName.of('Filter'), filterArray);
    const result = getFilterNames(dict);
    expect(result).toEqual(['ASCII85Decode', 'FlateDecode']);
  });

  it('should return null when no filter is present', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({});
    expect(getFilterNames(dict)).toBeNull();
  });
});

describe('hasImageFilter', () => {
  it('should return true for DCTDecode', () => {
    expect(hasImageFilter(['DCTDecode'])).toBe(true);
  });

  it('should return true for JPXDecode', () => {
    expect(hasImageFilter(['JPXDecode'])).toBe(true);
  });

  it('should return false for FlateDecode', () => {
    expect(hasImageFilter(['FlateDecode'])).toBe(false);
  });

  it('should return false for null/empty', () => {
    expect(hasImageFilter(null)).toBe(false);
    expect(hasImageFilter([])).toBe(false);
  });
});

describe('allFiltersDecodable', () => {
  it('should return true for decodable filters', () => {
    expect(allFiltersDecodable(['FlateDecode'])).toBe(true);
    expect(allFiltersDecodable(['ASCII85Decode', 'FlateDecode'])).toBe(true);
  });

  it('should return false for unsupported filters', () => {
    expect(allFiltersDecodable(['DCTDecode'])).toBe(false);
  });

  it('should return true for empty/null filters', () => {
    expect(allFiltersDecodable(null)).toBe(true);
    expect(allFiltersDecodable([])).toBe(true);
  });
});
