/**
 * Tests for extractUsedCharCodes from content-stream-parser.js.
 *
 * Each test builds a minimal PDF with pdf-lib, writes raw content stream
 * operators as bytes, saves and reloads the document (to serialize properly),
 * then asserts the map returned by extractUsedCharCodes.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFRef } from 'pdf-lib';
import { extractUsedCharCodes } from './content-stream-parser.js';

/**
 * Helper: create a content stream from raw operator text and register it.
 * Returns the PDFRef for the stream.
 */
function makeContentStream(doc, text) {
  const bytes = new TextEncoder().encode(text);
  const dict = doc.context.obj({ Length: bytes.length });
  const stream = PDFRawStream.of(dict, bytes);
  return doc.context.register(stream);
}

/**
 * Helper: create a Type1 font dict, register it, and return { fontRef, fontDict }.
 */
function createFont(doc, baseFontName) {
  const fontDict = doc.context.obj({
    Type: 'Font',
    Subtype: PDFName.of('Type1'),
    BaseFont: PDFName.of(baseFontName),
  });
  const fontRef = doc.context.register(fontDict);
  return { fontRef, fontDict };
}

/**
 * Helper: attach a Resources/Font dict to a page node with the given font map.
 * fontMap is { name: PDFRef }, e.g. { F1: fontRef }
 */
function setPageResources(doc, page, fontMap, extraResources) {
  const fontResources = doc.context.obj({});
  for (const [name, ref] of Object.entries(fontMap)) {
    fontResources.set(PDFName.of(name), ref);
  }
  const resources = doc.context.obj({});
  resources.set(PDFName.of('Font'), fontResources);
  if (extraResources) {
    for (const [key, val] of Object.entries(extraResources)) {
      resources.set(PDFName.of(key), val);
    }
  }
  page.node.set(PDFName.of('Resources'), resources);
}

describe('extractUsedCharCodes', () => {
  it('should return an empty map for a page with no content stream', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should extract char codes from Tf + Tj operators', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef } = createFont(doc, 'Helvetica');
    setPageResources(doc, page, { F1: fontRef });

    // Content stream: /F1 12 Tf (Hello) Tj
    const streamRef = makeContentStream(doc, '/F1 12 Tf (Hello) Tj');
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result.size).toBe(1);

    const [, entry] = [...result.entries()][0];
    expect(entry.fontDict).toBeInstanceOf(PDFDict);
    expect(entry.charCodes.length).toBe(1);

    // "Hello" = [72, 101, 108, 108, 111]
    const codes = entry.charCodes[0];
    expect(codes[0]).toBe(72);  // H
    expect(codes[1]).toBe(101); // e
    expect(codes[2]).toBe(108); // l
    expect(codes[3]).toBe(108); // l
    expect(codes[4]).toBe(111); // o
  });

  it('should extract char codes from TJ operator (array of strings and numbers)', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef } = createFont(doc, 'Helvetica');
    setPageResources(doc, page, { F1: fontRef });

    // TJ with array: [(Hi) -100 (Lo)] TJ
    const streamRef = makeContentStream(doc, '/F1 12 Tf [(Hi) -100 (Lo)] TJ');
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result.size).toBe(1);

    const [, entry] = [...result.entries()][0];
    // Two string elements in the TJ array -> two charCodes entries
    expect(entry.charCodes.length).toBe(2);

    // "Hi" = [72, 105]
    expect(entry.charCodes[0][0]).toBe(72);  // H
    expect(entry.charCodes[0][1]).toBe(105); // i

    // "Lo" = [76, 111]
    expect(entry.charCodes[1][0]).toBe(76);  // L
    expect(entry.charCodes[1][1]).toBe(111); // o
  });

  it('should handle multiple fonts on the same page', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef: fontRef1 } = createFont(doc, 'Helvetica');
    const { fontRef: fontRef2 } = createFont(doc, 'Courier');
    setPageResources(doc, page, { F1: fontRef1, F2: fontRef2 });

    // Two Tf calls with different fonts, each followed by Tj
    const streamText = '/F1 12 Tf (ABC) Tj /F2 10 Tf (XYZ) Tj';
    const streamRef = makeContentStream(doc, streamText);
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result.size).toBe(2);

    // Collect all char code arrays from both entries
    const entries = [...result.values()];
    const allFirstBytes = entries.map((e) => e.charCodes[0][0]);
    // One entry should start with 'A' (65), the other with 'X' (88)
    expect(allFirstBytes).toContain(65);
    expect(allFirstBytes).toContain(88);
  });

  it('should recurse into Form XObjects via Do operator', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef } = createFont(doc, 'Helvetica');

    // Create a Form XObject with its own content stream containing text
    const formContent = '/F1 10 Tf (Form) Tj';
    const formBytes = new TextEncoder().encode(formContent);

    const formDict = doc.context.obj({
      Type: 'XObject',
      Subtype: PDFName.of('Form'),
      Length: formBytes.length,
    });
    // Add font to form's own Resources
    const formFontRes = doc.context.obj({});
    formFontRes.set(PDFName.of('F1'), fontRef);
    const formResources = doc.context.obj({});
    formResources.set(PDFName.of('Font'), formFontRes);
    formDict.set(PDFName.of('Resources'), formResources);

    const formStream = PDFRawStream.of(formDict, formBytes);
    const formRef = doc.context.register(formStream);

    // Page XObject resources referencing the form
    const xobjectRes = doc.context.obj({});
    xobjectRes.set(PDFName.of('Fm1'), formRef);

    setPageResources(doc, page, { F1: fontRef }, { XObject: xobjectRes });

    // Page content only invokes the form via Do
    const streamRef = makeContentStream(doc, '/Fm1 Do');
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result.size).toBe(1);

    const [, entry] = [...result.entries()][0];
    expect(entry.charCodes.length).toBe(1);

    // "Form" = [70, 111, 114, 109]
    expect(entry.charCodes[0][0]).toBe(70);  // F
    expect(entry.charCodes[0][1]).toBe(111); // o
    expect(entry.charCodes[0][2]).toBe(114); // r
    expect(entry.charCodes[0][3]).toBe(109); // m
  });

  it('should parse array content streams (multiple refs in Contents)', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef } = createFont(doc, 'Helvetica');
    setPageResources(doc, page, { F1: fontRef });

    // First stream sets the font
    const streamRef1 = makeContentStream(doc, '/F1 12 Tf (Part1) Tj');
    // Second stream uses the same font (Tf state carries across streams)
    const streamRef2 = makeContentStream(doc, '(Part2) Tj');

    // Set Contents as an array of two stream refs
    const contentsArray = doc.context.obj([streamRef1, streamRef2]);
    page.node.set(PDFName.of('Contents'), contentsArray);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    const result = extractUsedCharCodes(reloaded);
    expect(result.size).toBe(1);

    const [, entry] = [...result.entries()][0];
    // Should have char codes from both streams
    // "Part1" from first stream + "Part2" from second stream
    expect(entry.charCodes.length).toBe(2);

    // "Part1" starts with P = 80
    expect(entry.charCodes[0][0]).toBe(80);
    // "Part2" starts with P = 80
    expect(entry.charCodes[1][0]).toBe(80);

    // Verify they are different strings
    // "Part1" = [80,97,114,116,49], "Part2" = [80,97,114,116,50]
    expect(entry.charCodes[0][4]).toBe(49); // '1'
    expect(entry.charCodes[1][4]).toBe(50); // '2'
  });

  it('should skip gracefully when a content stream has invalid compressed data', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    const { fontRef } = createFont(doc, 'Helvetica');
    setPageResources(doc, page, { F1: fontRef });

    // Create a stream marked as FlateDecode but with garbage data
    const garbageBytes = new Uint8Array([0xFF, 0xFE, 0xAB, 0xCD, 0x00, 0x01]);
    const streamDict = doc.context.obj({
      Length: garbageBytes.length,
      Filter: PDFName.of('FlateDecode'),
    });
    const rawStream = PDFRawStream.of(streamDict, garbageBytes);
    const streamRef = doc.context.register(rawStream);
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    // Should not throw; the bad stream is skipped and result is empty (or
    // contains whatever the fallback raw bytes parse into -- no valid operators)
    const result = extractUsedCharCodes(reloaded);
    expect(result).toBeInstanceOf(Map);
    // The garbage bytes won't produce valid text operators, so map should be empty
    expect(result.size).toBe(0);
  });

  it('should handle inline font dicts with synthetic key', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    // Create an inline font dict (not registered as indirect ref)
    const inlineFontDict = doc.context.obj({
      Type: 'Font',
      Subtype: PDFName.of('Type1'),
      BaseFont: PDFName.of('TimesRoman'),
    });

    // Set up Resources/Font with the dict directly (not via ref)
    const fontResources = doc.context.obj({});
    fontResources.set(PDFName.of('F1'), inlineFontDict);
    const resources = doc.context.obj({});
    resources.set(PDFName.of('Font'), fontResources);
    page.node.set(PDFName.of('Resources'), resources);

    const streamRef = makeContentStream(doc, '/F1 12 Tf (Test) Tj');
    page.node.set(PDFName.of('Contents'), streamRef);

    // Note: save/reload will serialize the inline dict as an indirect object.
    // To properly test inline dicts, we operate on the pre-save document where
    // the font dict is genuinely inline (not behind a ref).
    // However, extractUsedCharCodes works on any PDFDocument, so we can call
    // it directly on the unsaved doc. The save/reload cycle would turn the
    // inline dict into an indirect ref, defeating the purpose of this test.
    const result = extractUsedCharCodes(doc);
    expect(result.size).toBe(1);

    // The key should be the synthetic inline key
    const key = [...result.keys()][0];
    expect(key).toBe('inline:F1');

    const entry = result.get(key);
    expect(entry.charCodes.length).toBe(1);
    // "Test" = [84, 101, 115, 116]
    expect(entry.charCodes[0][0]).toBe(84); // T
  });

  it('should not crash when a page has no Resources', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();

    // Explicitly remove Resources from the page
    page.node.delete(PDFName.of('Resources'));

    // Add a content stream that references a font (which won't be found)
    const streamRef = makeContentStream(doc, '/F1 12 Tf (Orphan) Tj');
    page.node.set(PDFName.of('Contents'), streamRef);

    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });

    // Should not throw; the font won't resolve so no char codes recorded
    const result = extractUsedCharCodes(reloaded);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
