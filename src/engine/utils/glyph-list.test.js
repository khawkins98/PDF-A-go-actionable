import { describe, it, expect } from 'vitest';
import { ADOBE_GLYPH_LIST, WIN_ANSI_ENCODING, MAC_ROMAN_ENCODING } from './glyph-list.js';

describe('glyph-list', () => {
  describe('ADOBE_GLYPH_LIST — common glyph names resolve correctly', () => {
    it('resolves basic Latin letters', () => {
      expect(ADOBE_GLYPH_LIST.get('A')).toBe(0x0041);
      expect(ADOBE_GLYPH_LIST.get('z')).toBe(0x007A);
    });

    it('resolves digits', () => {
      expect(ADOBE_GLYPH_LIST.get('zero')).toBe(0x0030);
      expect(ADOBE_GLYPH_LIST.get('nine')).toBe(0x0039);
    });

    it('resolves punctuation and symbols', () => {
      expect(ADOBE_GLYPH_LIST.get('space')).toBe(0x0020);
      expect(ADOBE_GLYPH_LIST.get('period')).toBe(0x002E);
      expect(ADOBE_GLYPH_LIST.get('ampersand')).toBe(0x0026);
      expect(ADOBE_GLYPH_LIST.get('bullet')).toBe(0x2022);
      expect(ADOBE_GLYPH_LIST.get('Euro')).toBe(0x20AC);
      expect(ADOBE_GLYPH_LIST.get('copyright')).toBe(0x00A9);
    });

    it('resolves accented characters', () => {
      expect(ADOBE_GLYPH_LIST.get('eacute')).toBe(0x00E9);
      expect(ADOBE_GLYPH_LIST.get('Adieresis')).toBe(0x00C4);
      expect(ADOBE_GLYPH_LIST.get('ntilde')).toBe(0x00F1);
      expect(ADOBE_GLYPH_LIST.get('ccedilla')).toBe(0x00E7);
    });

    it('resolves ligatures', () => {
      expect(ADOBE_GLYPH_LIST.get('fi')).toBe(0xFB01);
      expect(ADOBE_GLYPH_LIST.get('fl')).toBe(0xFB02);
      expect(ADOBE_GLYPH_LIST.get('ff')).toBe(0xFB00);
      expect(ADOBE_GLYPH_LIST.get('ffi')).toBe(0xFB03);
      expect(ADOBE_GLYPH_LIST.get('ffl')).toBe(0xFB04);
    });

    it('resolves typographic quotes and dashes', () => {
      expect(ADOBE_GLYPH_LIST.get('quotedblleft')).toBe(0x201C);
      expect(ADOBE_GLYPH_LIST.get('quotedblright')).toBe(0x201D);
      expect(ADOBE_GLYPH_LIST.get('emdash')).toBe(0x2014);
      expect(ADOBE_GLYPH_LIST.get('endash')).toBe(0x2013);
    });

    it('resolves math symbols', () => {
      expect(ADOBE_GLYPH_LIST.get('radical')).toBe(0x221A);
      expect(ADOBE_GLYPH_LIST.get('infinity')).toBe(0x221E);
      expect(ADOBE_GLYPH_LIST.get('notequal')).toBe(0x2260);
    });

    it('resolves .notdef to replacement character', () => {
      expect(ADOBE_GLYPH_LIST.get('.notdef')).toBe(0xFFFD);
    });
  });

  describe('ADOBE_GLYPH_LIST — missing glyph name returns undefined', () => {
    it('returns undefined for unknown glyph names', () => {
      expect(ADOBE_GLYPH_LIST.get('nonexistentglyph')).toBeUndefined();
      expect(ADOBE_GLYPH_LIST.get('')).toBeUndefined();
      expect(ADOBE_GLYPH_LIST.get('Comic')).toBeUndefined();
    });
  });

  describe('WIN_ANSI_ENCODING', () => {
    it('has 256 entries', () => {
      expect(WIN_ANSI_ENCODING).toHaveLength(256);
    });

    it('maps ASCII range correctly', () => {
      expect(WIN_ANSI_ENCODING[0x20]).toBe('space');
      expect(WIN_ANSI_ENCODING[0x41]).toBe('A');
      expect(WIN_ANSI_ENCODING[0x7A]).toBe('z');
    });

    it('maps Windows-1252 extras', () => {
      expect(WIN_ANSI_ENCODING[0x80]).toBe('Euro');
      expect(WIN_ANSI_ENCODING[0x93]).toBe('quotedblleft');
    });
  });

  describe('MAC_ROMAN_ENCODING', () => {
    it('has 256 entries', () => {
      expect(MAC_ROMAN_ENCODING).toHaveLength(256);
    });

    it('maps ASCII range correctly', () => {
      expect(MAC_ROMAN_ENCODING[0x20]).toBe('space');
      expect(MAC_ROMAN_ENCODING[0x41]).toBe('A');
    });

    it('maps Mac Roman high bytes', () => {
      expect(MAC_ROMAN_ENCODING[0x80]).toBe('Adieresis');
      expect(MAC_ROMAN_ENCODING[0x81]).toBe('Aring');
    });
  });
});
