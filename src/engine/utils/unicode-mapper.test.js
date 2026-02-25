/**
 * Tests for unicode-mapper.js — CMap parsing, encoding resolution, and character mapping.
 *
 * Covers:
 * - parseCMapText: beginbfchar, beginbfrange, multi-char, surrogate pairs
 * - charCodesToUnicode: simple fonts (WinAnsi, MacRoman, Differences), Type0/Identity-H
 * - isIdentityHFont: Identity-H detection
 * - Edge cases: missing ToUnicode, empty buffers, unknown encodings
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import { parseCMapText, charCodesToUnicode, isIdentityHFont } from './unicode-mapper.js';

// ======================================================================
// parseCMapText — unit tests for CMap parsing
// ======================================================================

describe('parseCMapText', () => {
  it('should parse beginbfchar single mappings', () => {
    const cmap = `
      1 begincodespacerange
      <0000> <FFFF>
      endcodespacerange
      2 beginbfchar
      <0041> <0041>
      <0042> <0042>
      endbfchar
    `;
    const map = parseCMapText(cmap);
    expect(map.get(0x41)).toBe(0x41); // A
    expect(map.get(0x42)).toBe(0x42); // B
  });

  it('should parse beginbfrange mappings', () => {
    const cmap = `
      1 beginbfrange
      <0041> <0043> <0041>
      endbfrange
    `;
    const map = parseCMapText(cmap);
    expect(map.get(0x41)).toBe(0x41); // A
    expect(map.get(0x42)).toBe(0x42); // B
    expect(map.get(0x43)).toBe(0x43); // C
  });

  it('should parse beginbfrange with array destinations', () => {
    const cmap = `
      1 beginbfrange
      <0001> <0003> [<0041> <0042> <0043>]
      endbfrange
    `;
    const map = parseCMapText(cmap);
    expect(map.get(1)).toBe(0x41); // A
    expect(map.get(2)).toBe(0x42); // B
    expect(map.get(3)).toBe(0x43); // C
  });

  it('should handle multi-char unicode values (e.g. ligatures)', () => {
    const cmap = `
      1 beginbfchar
      <FB01> <00660069>
      endbfchar
    `;
    const map = parseCMapText(cmap);
    // fi ligature -> [f, i]
    const result = map.get(0xFB01);
    expect(result).toEqual([0x66, 0x69]);
  });

  it('should handle surrogate pairs for supplementary plane characters', () => {
    // U+1F600 GRINNING FACE = D83D DE00 in UTF-16
    const cmap = `
      1 beginbfchar
      <0001> <D83DDE00>
      endbfchar
    `;
    const map = parseCMapText(cmap);
    expect(map.get(1)).toBe(0x1F600);
  });

  it('should handle multiple beginbfchar sections', () => {
    const cmap = `
      1 beginbfchar
      <0001> <0041>
      endbfchar
      1 beginbfchar
      <0002> <0042>
      endbfchar
    `;
    const map = parseCMapText(cmap);
    expect(map.get(1)).toBe(0x41);
    expect(map.get(2)).toBe(0x42);
  });

  it('should handle mixed bfchar and bfrange sections', () => {
    const cmap = `
      1 beginbfchar
      <0001> <0041>
      endbfchar
      1 beginbfrange
      <0010> <0012> <0061>
      endbfrange
    `;
    const map = parseCMapText(cmap);
    expect(map.get(1)).toBe(0x41);   // A from bfchar
    expect(map.get(0x10)).toBe(0x61); // a from bfrange
    expect(map.get(0x11)).toBe(0x62); // b
    expect(map.get(0x12)).toBe(0x63); // c
  });

  it('should return an empty map for text with no CMap sections', () => {
    const map = parseCMapText('some random text');
    expect(map.size).toBe(0);
  });

  it('should handle case-insensitive hex values', () => {
    const cmap = `
      1 beginbfchar
      <00aB> <00cD>
      endbfchar
    `;
    const map = parseCMapText(cmap);
    expect(map.get(0xAB)).toBe(0xCD);
  });
});

// ======================================================================
// charCodesToUnicode — integration tests with pdf-lib font dicts
// ======================================================================

describe('charCodesToUnicode', () => {
  /**
   * Helper to create a minimal font dict in a fresh PDF context.
   * Returns { fontDict, context }.
   */
  async function createFontContext(setup) {
    const doc = await PDFDocument.create();
    const context = doc.context;
    const fontDict = context.obj({});
    fontDict.set(PDFName.of('Type'), PDFName.of('Font'));
    await setup(fontDict, context, doc);
    return { fontDict, context };
  }

  describe('simple fonts', () => {
    it('should map ASCII chars with default encoding (WinAnsi fallback)', async () => {
      const { fontDict, context } = await createFontContext(async (dict) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('TrueType'));
        // No Encoding set — defaults to WinAnsi
      });

      const buffers = [new Uint8Array([0x41, 0x42, 0x43])]; // A, B, C
      const codepoints = charCodesToUnicode(fontDict, buffers, context);

      expect(codepoints.has(0x41)).toBe(true); // A
      expect(codepoints.has(0x42)).toBe(true); // B
      expect(codepoints.has(0x43)).toBe(true); // C
    });

    it('should use WinAnsiEncoding when specified', async () => {
      const { fontDict, context } = await createFontContext(async (dict) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('Type1'));
        dict.set(PDFName.of('Encoding'), PDFName.of('WinAnsiEncoding'));
      });

      const buffers = [new Uint8Array([0x41])]; // A
      const codepoints = charCodesToUnicode(fontDict, buffers, context);

      expect(codepoints.has(0x41)).toBe(true);
    });

    it('should use MacRomanEncoding when specified', async () => {
      const { fontDict, context } = await createFontContext(async (dict) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('Type1'));
        dict.set(PDFName.of('Encoding'), PDFName.of('MacRomanEncoding'));
      });

      const buffers = [new Uint8Array([0x41])]; // A
      const codepoints = charCodesToUnicode(fontDict, buffers, context);

      expect(codepoints.has(0x41)).toBe(true);
    });

    it('should return empty set for out-of-range char codes with no mapping', async () => {
      const { fontDict, context } = await createFontContext(async (dict) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('TrueType'));
      });

      // Char code 0x01 is not in ASCII range and has no glyph name in WinAnsi
      const buffers = [new Uint8Array([0x01])];
      const codepoints = charCodesToUnicode(fontDict, buffers, context);

      // 0x01 is outside the 0x20-0x7E ASCII fallback range
      expect(codepoints.has(0x01)).toBe(false);
    });

    it('should handle empty buffers', async () => {
      const { fontDict, context } = await createFontContext(async (dict) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('TrueType'));
      });

      const codepoints = charCodesToUnicode(fontDict, [], context);
      expect(codepoints.size).toBe(0);
    });
  });

  describe('Type0 fonts', () => {
    it('should return empty set when no ToUnicode CMap exists', async () => {
      const { fontDict, context } = await createFontContext(async (dict, ctx) => {
        dict.set(PDFName.of('Subtype'), PDFName.of('Type0'));
        dict.set(PDFName.of('Encoding'), PDFName.of('Identity-H'));

        const cidFont = ctx.obj({});
        cidFont.set(PDFName.of('Type'), PDFName.of('Font'));
        cidFont.set(PDFName.of('Subtype'), PDFName.of('CIDFontType2'));
        const cidRef = ctx.register(cidFont);
        dict.set(PDFName.of('DescendantFonts'), ctx.obj([cidRef]));
      });

      const buffers = [new Uint8Array([0x00, 0x41])]; // CID 65
      const codepoints = charCodesToUnicode(fontDict, buffers, context);

      expect(codepoints.size).toBe(0);
    });
  });
});

// ======================================================================
// isIdentityHFont
// ======================================================================

describe('isIdentityHFont', () => {
  async function createType0Font(setup) {
    const doc = await PDFDocument.create();
    const context = doc.context;
    const fontDict = context.obj({});
    fontDict.set(PDFName.of('Type'), PDFName.of('Font'));
    fontDict.set(PDFName.of('Subtype'), PDFName.of('Type0'));
    await setup(fontDict, context);
    return { fontDict, context };
  }

  it('should return true for Identity-H encoding with Identity CIDToGIDMap', async () => {
    const { fontDict, context } = await createType0Font(async (dict, ctx) => {
      dict.set(PDFName.of('Encoding'), PDFName.of('Identity-H'));

      const cidFont = ctx.obj({});
      cidFont.set(PDFName.of('CIDToGIDMap'), PDFName.of('Identity'));
      const cidRef = ctx.register(cidFont);
      dict.set(PDFName.of('DescendantFonts'), ctx.obj([cidRef]));
    });

    expect(isIdentityHFont(fontDict, context)).toBe(true);
  });

  it('should return true for Identity-H with no CIDToGIDMap (assumed Identity)', async () => {
    const { fontDict, context } = await createType0Font(async (dict, ctx) => {
      dict.set(PDFName.of('Encoding'), PDFName.of('Identity-H'));

      const cidFont = ctx.obj({});
      const cidRef = ctx.register(cidFont);
      dict.set(PDFName.of('DescendantFonts'), ctx.obj([cidRef]));
    });

    expect(isIdentityHFont(fontDict, context)).toBe(true);
  });

  it('should return false for non-Identity-H encoding', async () => {
    const { fontDict, context } = await createType0Font(async (dict, ctx) => {
      dict.set(PDFName.of('Encoding'), PDFName.of('UniJIS-UCS2-H'));

      const cidFont = ctx.obj({});
      const cidRef = ctx.register(cidFont);
      dict.set(PDFName.of('DescendantFonts'), ctx.obj([cidRef]));
    });

    expect(isIdentityHFont(fontDict, context)).toBe(false);
  });

  it('should return false when no Encoding is set', async () => {
    const { fontDict, context } = await createType0Font(async (dict, ctx) => {
      const cidFont = ctx.obj({});
      const cidRef = ctx.register(cidFont);
      dict.set(PDFName.of('DescendantFonts'), ctx.obj([cidRef]));
    });

    expect(isIdentityHFont(fontDict, context)).toBe(false);
  });

  it('should return false when no DescendantFonts', async () => {
    const { fontDict, context } = await createType0Font(async (dict) => {
      dict.set(PDFName.of('Encoding'), PDFName.of('Identity-H'));
    });

    expect(isIdentityHFont(fontDict, context)).toBe(false);
  });
});
