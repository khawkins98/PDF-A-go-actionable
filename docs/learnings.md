# PDF-A-go-actionable --Learnings & Technical Notes

Technical notes from development. Updated as we go.

This project shares PDF internals knowledge with [PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim). The optimization-specific stuff (font subsetting, image recompression, stream compression, deduplication, metadata stripping) lives in [PDF-A-go-slim's learnings file](https://github.com/khawkins98/PDF-A-go-slim/blob/main/docs/learnings.md). This file covers accessibility auditing and the shared PDF internals that both projects use.

> **Provenance:** The PDF Internals, Tooling & Libraries, and Testing Patterns sections were seeded from [PDF-A-go-slim's `docs/learnings.md`](https://github.com/khawkins98/PDF-A-go-slim/blob/main/docs/learnings.md) (commit `5618536`, Feb 2026). Accessibility-specific sections (Accessibility Standards, Accessibility Auditing Patterns) are original to this project. When updating shared knowledge (pdf-lib gotchas, stream decoding, content stream parsing), consider backporting relevant changes to PDF-A-go-slim's learnings file as well.

---

## PDF Internals

### How Fonts Are Embedded

PDF fonts come in a few types, each stored differently:

- **FontFile** (Type 1) --PostScript font programs. Legacy format, rarely seen in modern PDFs.
- **FontFile2** (TrueType) --Glyph outlines as quadratic B-splines in a `glyf` table. Glyph selection by GID (integer index).
- **FontFile3** (CFF/OpenType) --Glyph outlines as cubic Bezier curves. Subtype `CIDFontType0C` for CID-keyed CFF.

**Font embedding validation:** To check if a font is embedded, look for `FontFile`, `FontFile2`, or `FontFile3` in the font's `/FontDescriptor` dict. CIDFont subtypes (`CIDFontType0`, `CIDFontType2`) and `Type3` fonts should be skipped during embedding checks--CIDFonts are referenced through their parent Type0 font, and Type3 fonts define glyphs procedurally (they don't have external font programs to embed). Standard 14 fonts (Helvetica, Courier, Times-Roman, etc.) often lack a `/FontDescriptor` entirely--this is legal per the spec and shouldn't be flagged as an error.

### Simple vs Composite Fonts

- **Simple fonts** (Type1, TrueType): Single-byte character codes (0-255), mapped to glyphs via `/Encoding` + optional `/Differences` array.
- **Composite fonts** (Type0/CIDFont): Multi-byte character codes. A CMap maps codes to CIDs, then `/CIDToGIDMap` maps CIDs to GIDs.

### Content Streams and Text Operators

PDF content streams use postfix notation. Text-showing operators:
- `Tj` --show a single string
- `TJ` --show array of strings with positioning adjustments
- `'` --newline + show string
- `"` --set spacing, newline, show string

The strings are **not Unicode** --they're character codes whose meaning depends on the active font's encoding. The `Tf` operator sets the current font.

**Edge cases in content stream parsing:**
- Content streams can be an array of stream refs (concatenated in order)
- pdf-lib represents programmatically-created content as `PDFContentStream` (not `PDFRawStream`) --must check for `getUnencodedContents()` method
- Form XObjects (`/Subtype /Form`) referenced by the `Do` operator have their own `/Resources` and content stream --must recurse into them
- Inline images (`BI`/`ID`/`EI`) must be skipped --the `ID` marker is followed by raw binary data terminated by `EI`
- Font names in content streams (e.g., `/F1` in `Tf`) must be resolved through the page's `/Resources/Font` dict to find the actual font object ref
- **Inline font dicts** (rare): some PDFs define font dictionaries inline rather than as indirect refs. The parser creates synthetic ref keys (`inline:{fontName}`) to track these without crashing.

### Marked Content and Structure Tree

PDF tagged structure links content streams to the structure tree via Marked Content IDs (MCIDs). The relevant concepts:

- **`BMC`/`BDC`/`EMC` operators** --mark content sequences in content streams. `BDC /P << /MCID 0 >>` begins a marked content sequence tied to MCID 0.
- **StructElem `/K` values** --can be integers (MCIDs referencing content on a page), dicts (with `/Type /MCR` for marked content references or `/Type /OBJR` for object references), arrays of mixed children, or refs to child StructElems.
- **`/Pg` key** --on StructElems or MCR dicts, points to the page where the marked content lives. Required to correlate MCIDs (which are page-scoped, not document-scoped) to their parent page.
- **`/Type` on StructElem is optional** --per the PDF spec, not all StructElem dicts carry `/Type /StructElem`. Filter by the presence of `/S` (structure type) instead.

### Reading Order in PDFs

Reading order is determined by the structure tree's depth-first traversal order, not by the visual position of content on the page. This matters a lot for accessibility:

- **Structure tree order** -- the intended reading sequence as declared by the authoring tool. What screen readers follow.
- **Content stream order** -- the order text operators appear in the page's content stream. Usually matches visual left-to-right, top-to-bottom, but not always (multi-column layouts, sidebars, callout boxes).
- **Visual position** -- where text renders on the page based on transformation matrices (`Tm`, `Td`, `cm`).

Automated reading order checking can flag discrepancies between these three sequences, but only a human can judge whether the structure tree order is semantically correct.

---

## Accessibility Standards

### PDF/UA (ISO 14289)

PDF/UA governs universal accessibility. The main requirements:
- All meaningful content must be tagged and in the structure tree
- All fonts must be embedded
- Document language must be declared via `/Lang` on the catalog
- Logical reading order via depth-first traversal of the structure tree
- Images and graphics require `/Alt` or `/ActualText` attributes
- `/ViewerPreferences << /DisplayDocTitle true >>` is required

### WCAG 2.1 PDF Techniques

23 PDF-specific techniques for WCAG conformance (PDF1-PDF23). The most commonly tested:
- **PDF1** --alt text via `/Alt` on structure elements
- **PDF2** --bookmarks via `/Outlines`
- **PDF6** --table headers via `/TH` elements with `/Scope`
- **PDF9** --headings via `/H1`-`/H6` structure types
- **PDF16** --document language via `/Lang`
- **PDF17** --page content fully tagged
- **PDF18** --document title via Info dict or XMP + DisplayDocTitle

### PDF/A Conformance Levels

PDF/A is an ISO standard (19005) for long-term archival. Relevant here because PDF/A level 'a' requires tagged structure:

- **PDF/A-1a** --strictest; requires tagged structure (StructTreeRoot, MarkInfo) plus Unicode mapping for all text
- **PDF/A-1b** --visual reproduction only; no tagging required
- **PDF/A-2u** --adds Unicode mapping requirement to the 'b' level
- **PDF/A-3**, **PDF/A-4** --progressive relaxation of restrictions

Within each level, conformance 'a' requires tagged structure, while 'b' only requires faithful visual reproduction. Level 'u' adds a Unicode mapping requirement.

---

## Accessibility Auditing Patterns

### Structure Tree Walking

The structure tree is rooted at `/StructTreeRoot` in the document catalog. Walking it requires:

1. Resolve `/StructTreeRoot` (may be an indirect ref)
2. Read `/K` (kids) --can be a single child, an array, or an MCID integer
3. Recursively walk children, resolving refs at each level
4. Track visited refs (via `Set` on ref tags) to prevent cycles
5. Cap depth (200) and element count (50,000) to prevent pathological documents from hanging

**Cycle detection caveat:** When `/K` is a single ref (not an array), `resolve(k, context)` returns the PDFDict directly. The walker then recurses with the dict, not the PDFRef, so `instanceof PDFRef` cycle detection doesn't trigger. Array children preserve PDFRef during iteration, so cycle detection works correctly there. The MAX_DEPTH cap provides a safety net for both cases.

The `/S` key on each StructElem gives the structure type (`/P`, `/H1`, `/Figure`, `/Table`, `/L`, etc.). The `/K` key gives children. `/Alt` provides alternative text. `/Lang` provides per-element language.

### ToUnicode CMap Coverage

Fonts without `/ToUnicode` CMaps can't be reliably extracted to text by screen readers or search. How we audit this:

- Enumerate indirect objects with `Type: Font`
- Skip Type3 fonts and CIDFont descendants (counted via their Type0 parent)
- Check for `/ToUnicode` entry
- Report fonts missing it by name

Standard fonts (Helvetica, Courier, Times-Roman, etc.) sometimes lack ToUnicode even in otherwise well-tagged PDFs.

### Image Alt Text

Two independent metrics that shouldn't be conflated:
- **Image XObjects** --count of all `Subtype: Image` streams in the document
- **Figure StructElems** --tagged structure elements with `/S /Figure`

A document can have many image XObjects but zero Figure elements (untagged PDF), or Figure elements that reference non-image content. Alt text (`/Alt`) lives on the StructElem, not the image XObject.

When no StructTreeRoot exists, alt text auditing is not applicable --the document isn't tagged at all.

**Generic alt text:** Alt text like "image", "photo", "picture", "graphic", "figure", "icon", "logo", "screenshot", "illustration", "diagram", "chart" is technically present but provides no meaningful description. Flagged as a warning (not a pass).

### Heading Hierarchy Validation

Structure types `/H1` through `/H6` should follow a logical hierarchy:
- Exactly one `/H1` per document (the document title)
- No skipped levels (H1 then H3 without H2)
- Headings should not be used for visual styling (e.g., a pull-quote tagged as H2)

Walk StructElems in document order (depth-first from StructTreeRoot), extract heading levels, flag violations.

### Table Structure Validation

Accessible tables require:
- `/Table` StructElem as the container
- `/TH` (header) cells, not just `/TD` (data) cells
- `/Scope` attribute on `/TH` elements with a valid value: `Row`, `Column`, or `Both`. Simply having a `/Scope` key with an arbitrary value is not sufficient --the value must be one of these three per the PDF spec.
- For complex tables: `/Headers` attribute linking data cells to their header cells

### List Structure Validation

Accessible lists require:
- `/L` (list) as container
- `/LI` (list item) as direct children
- Each `/LI` should contain `/Lbl` (label/bullet) and `/LBody` (list body)
- Nested lists should have `/L` inside `/LBody`

### Security Permissions

The encryption dictionary's `/P` value is a 32-bit integer with permission flags. For accessibility:
- **Bit 5 (value 16)** --content copying for accessibility. When clear (0), assistive technology may be blocked from reading the document.
- **Bit 10 (value 512)** --content extraction. Related but distinct from bit 5.

Note: PDF 2.0 deprecated the distinction between bit 5 and bit 10 --modern readers should allow accessibility regardless. But older readers and validators still check bit 5.

**Edge cases in `/P` validation:** The `/P` value can be malformed (non-numeric string, missing entirely). When parsed via `Number(val.toString())`, non-numeric values produce `NaN`. Since `NaN & 0x200 === 0` (bitwise ops convert `NaN` to `0`), malformed values fail-safe to "blocked"--which is the correct conservative behavior. A missing `/P` entry should be treated as a distinct warning ("permissions could not be read") rather than a hard fail.

### Real-World Accessibility Patterns

Observations from testing across the pdf.js corpus and real-world documents:

- Most tagged PDFs lack PDF/A and PDF/UA conformance metadata even when well-structured. These are separate authoring concerns.
- Document-level `/Lang` is often missing even in tagged PDFs. Some producers set language only at the StructElem level.
- ToUnicode coverage varies even in PDF/UA-conformant files --standard fonts sometimes lack ToUnicode CMaps.
- Figure StructElems with `/Alt` are uncommon. Even well-tagged PDFs often have figures without alt text.
- Image XObject count and Figure StructElem count are independent metrics.
- The `/Type` key on StructElem dicts is optional per the PDF spec.

### Integration Testing Against veraPDF Corpus

Running our audit engine against the veraPDF PDF/UA-1 test corpus and PDF Association technique files revealed four discrepancies between our checks and strict PDF/UA validation:

1. **Title: XMP vs Info dict fallback.** PDF/UA section 7.1 requires the title in XMP `dc:title`. Our engine falls back to the legacy `/Info` dictionary title, so a PDF with a title only in `/Info` reports pass. Strict PDF/UA validators like veraPDF would fail this. The fix: warn when title is only in `/Info` and not in XMP, since screen readers and modern viewers prefer XMP.

2. **Font check conflation.** Our `font-tounicode` finding bundles two independent concerns: ToUnicode CMap coverage and font embedding status. A PDF designed to test font embedding (all fonts embedded) can still trigger a warning because some fonts lack ToUnicode. These should be separate findings (`font-tounicode` and `font-embedding`) since they have different remediation paths.

3. **Tagging check granularity.** Our `tagged-pdf` check tests `MarkInfo/Marked` broadly. The veraPDF corpus tests more granular clauses within PDF/UA 7.1 (StructTreeRoot presence, role mapping completeness, etc.). Some veraPDF "fail" test PDFs still have `Marked=true` and pass our check.

4. **Corruption tolerance.** pdf-lib loads mildly corrupted PDFs (e.g., Cabinet of Horrors "1 byte missing") without error by tolerating truncated cross-reference tables. This means our `load-failure` finding doesn't trigger for borderline files.

### Checks Inspired by PDFcheck

[PDFcheck](https://github.com/jsnmrs/pdfcheck) by Jason Morris performs lightweight accessibility checks using regex on raw PDF text. Useful techniques adapted for pdf-lib's typed object model:

- **Document Title** --WCAG 2.x SC 2.4.2 requires a meaningful title. Check XMP `dc:title` first, fall back to Info dict `/Title`. Per PDF/UA, XMP `dc:title` is the authoritative source; an `/Info` dict-only title should produce a warning.
- **DisplayDocTitle** --PDF/UA requires `/ViewerPreferences << /DisplayDocTitle true >>`. Report true/false/null (not configured).
- **Marked status nuance** --distinguish "Marked explicitly false" from "no MarkInfo at all": `markedStatus: 'true' | 'false' | 'missing'`.

### WCAG 2.1 AA Self-Audit (The Tool Must Be Accessible)

An accessibility checker that isn't itself accessible is a credibility problem. Key findings from auditing our own UI:

**Color contrast failures on the NeXTSTEP theme.** The slate gray palette makes contrast tricky. Specific values that failed 4.5:1 minimum:
- `--color-text-muted: #666` on `--color-surface: #c8c8c8` --3.39:1. Fixed to `#505050` (4.73:1).
- `--color-not-applicable: #6b6b6b` on `--color-surface-alt: #b4b4b4` --2.65:1. Fixed to `#444` (4.69:1).
- `--color-warning: #b45309` on `--color-warning-bg: #fff3cd` --4.53:1 (borderline). Darkened to `#a24d09` (5.26:1) for safety margin.
- Unfocused WinBox title text at `rgba(255,255,255,0.6)` on `#666` --3.24:1. Bumped to `0.85` opacity (4.70:1).

**ARIA menubar requires arrow-key navigation.** Using `role="menubar"` and `role="menuitem"` without implementing the [ARIA menubar keyboard pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) is misleading to screen reader users. The pattern requires: roving tabindex (only one item in tab order), Left/Right to move between items, Up/Down within submenus, Escape to close, Home/End for first/last.

**Focus management on dialogs.** When a dialog opens, focus must move into it. When it closes, focus must return to the triggering element. Without this, keyboard users lose their place. Implementation: save `document.activeElement` before opening, set `tabindex="-1"` on content div, `.focus()` on open, restore on `onclose`.

**Live regions for state transitions.** When the progress dialog closes and an error appears on the welcome screen, screen readers don't announce this. A persistent `aria-live="assertive"` region that receives error text fixes this.

---

## Tooling & Libraries

### pdf-lib

**Strengths:** Low-level access to PDF objects via `context.enumerateIndirectObjects()`. Can directly read `PDFRawStream`, `PDFDict`, `PDFArray`, etc.

**Limitations:**
- No built-in content stream parser.
- `PDFNumber` value access is inconsistent --use `Number(val.toString())` for reliable extraction.
- **Cannot read metadata streams.** pdf-lib only reads the `/Info` dictionary for metadata. PDFs that store metadata in XMP streams (common in modern tools) return `undefined` from `getTitle()`, `getAuthor()`, etc. Read XMP directly from raw stream bytes.
- **`PDFStream` does NOT extend `PDFDict`** --it has a `.dict` property; use `obj.dict.get()` for streams. Only `PDFDict` subclasses have `.get()` directly.
- `PDFRawStream` extends `PDFDict` in pdf-lib. An `instanceof PDFDict` check matches streams too.

### fflate

Used for stream decompression when parsing content streams. Main functions:
- `inflateSync(data)` -- raw DEFLATE only (RFC 1951). Fast path for most streams.
- `decompressSync(data)` -- auto-detects format (GZIP, Zlib, raw DEFLATE). Fallback when `inflateSync` fails on pako-produced zlib streams.

### Stream Decoding

Content stream parsing requires decompressing streams first. The decoder chain in `stream-decode.js` handles multiple filters, applied sequentially (first filter decodes first, result feeds into second filter, etc.). The FlateDecode path uses a fallback chain: `inflateSync` first, then `decompressSync` if that fails. This means corrupted zlib data may not throw --`decompressSync` can auto-detect format and recover. Only truly unsupported filter names will throw.

Supported filters:
- **FlateDecode** -- zlib/DEFLATE via fflate
- **LZWDecode** -- custom decoder (PDF's variant has non-standard early code size change)
- **ASCII85Decode** -- ASCII85 text back into bytes (5 chars to 4 bytes)
- **ASCIIHexDecode** -- hex pairs to bytes
- **RunLengthDecode** -- simple RLE
- **PNG row prediction** (Predictor 10-15) -- reversed after Flate decompression

### XMP Metadata Parsing

XMP is XML embedded as a stream. Parsing conformance and title requires handling both element-style and attribute-style XMP:
- Element: `<pdfaid:part>1</pdfaid:part>`
- Attribute: `<rdf:Description pdfaid:part="1" ...>`

The `parseConformanceFromXmp()` and `parseTitleFromXmp()` utilities handle both formats.

---

## CORS-Friendly Test PDF Sources

For browser-based tools that need to `fetch()` test PDFs at runtime, CORS headers are the constraint. Most PDF hosting sites (pdfa.org, w3.org, government domains) do **not** send `Access-Control-Allow-Origin` headers.

### Domains That Work

- **`cdn.jsdelivr.net`** -- wraps any GitHub repo. Returns `Access-Control-Allow-Origin: *`, proper `content-type: application/pdf`, and long cache (604800s). URL format: `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}`. Spaces in paths must be URL-encoded as `%20`. Preferred over raw GitHub for content-type and caching.
- **`raw.githubusercontent.com`** -- serves raw files from GitHub repos. Returns `Access-Control-Allow-Origin: *` but `content-type: application/octet-stream` (not `application/pdf`). Short cache (300s). Works for `fetch()` + `arrayBuffer()` since content-type doesn't matter for binary reads.
- **GitHub release assets** (`github.com/{owner}/{repo}/releases/download/...`) -- CORS-friendly but requires knowing exact release tag and asset name.

### Domains That Don't Work

- `pdfa.org` --PDF Association's download pages, no CORS
- `w3.org` --WCAG technique examples, no CORS
- `drive.google.com` --Google Drive sharing, no CORS
- Most `.gov` domains --no CORS

### Best Test PDF Repositories

1. **[veraPDF/veraPDF-corpus](https://github.com/veraPDF/veraPDF-corpus)** (staging branch, `PDF_UA-1/` directory) -- the largest source. Hundreds of atomic test files, each targeting a specific PDF/UA-1 clause. Files follow `{section}-t{test}-{pass|fail}-{variant}.pdf` naming. Covers: tagging, language, title, DisplayDocTitle, role mapping, graphics alt text, headings, tables, fonts (embedding, ToUnicode, encoding), security, annotations, tab order.

2. **[pdf-association/techniques-for-accessible-pdf](https://github.com/pdf-association/techniques-for-accessible-pdf)** -- files from the PDF Association's docs. Each demonstrates a specific accessible or inaccessible technique. Covers headings, lists, content tagging, reading order, role mapping. Files named `UA1_Tpdf-{code}.pdf`.

3. **[openpreserve/format-corpus](https://github.com/openpreserve/format-corpus)** (CC0 licensed, `pdfCabinetOfHorrors/` directory) -- edge case files: encryption variants (no text access, no copy, open password), font embedding variants (none, all, subset), PDF/A conformance, corruption, JavaScript, external links, file attachments.

---

## Testing Patterns

### PDF Number Value Extraction

`Number(val.toString())` works reliably across all PDFNumber creation methods. The `.numberValue()` / `.value()` accessors are inconsistent.

### pdf-lib Lazy Object Creation

pdf-lib creates font dict objects lazily --after `embedFont()` + `drawText()`, the actual PDF objects don't exist in `context` until `save()` is called. Tests that examine font objects require a save/reload cycle.

### Building Content Streams for Tests

To test the content stream parser without real PDFs, write raw PDF operators as text and wrap them in a `PDFRawStream`:

```js
function makeContentStream(doc, text) {
  const bytes = new TextEncoder().encode(text);
  const dict = doc.context.obj({ Length: bytes.length });
  return doc.context.register(PDFRawStream.of(dict, bytes));
}
// Usage: makeContentStream(doc, '/F1 12 Tf (Hello) Tj')
```

The font must be wired into the page's `Resources/Font` dict for `Tf` to resolve it. After save/reload, content streams become `PDFRawStream` objects (even if originally created differently). For testing inline font dicts (not behind indirect refs), operate on the pre-save document--save/reload serializes inline dicts as indirect objects, defeating the test.

### Circular References Don't Survive Save/Reload

pdf-lib flattens circular structure references during serialization. If you create a cycle (StructElem A → StructElem B → StructElem A) and save/reload, the cycle won't be present in the reloaded document. Tests for cycle detection must work on the document directly (before save) or use indirect structures that preserve the cycle through serialization.

### Node.js fetch() Detection

Node.js 18+ has a global `fetch()`, so `typeof fetch === 'function'` is true in both browser and Node. Use `typeof process !== 'undefined' && process.versions?.node` to identify Node.js.
