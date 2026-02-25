# Test Coverage TODO

Audit of test gaps against the project's TDD requirements. Ordered by priority.

## Critical --No Tests

### `src/engine/utils/resolve.js`
Core PDFRef resolution utility used by every audit module.
- [x] PDFRef resolves to the looked-up object
- [x] Non-PDFRef values pass through unchanged
- [x] Undefined ref returns undefined
- [x] Null/undefined context handling

### `src/engine/utils/struct-tree-walker.js`
DFS tree walk with safety caps --used by structure/heading hierarchy checks.
- [x] Valid tree produces correct element list with types and depth
- [x] MAX_DEPTH cap (200) stops recursion and doesn't crash
- [ ] MAX_ELEMENTS cap (50,000) stops traversal and doesn't crash
- [x] Cycle detection (visited set prevents infinite loops)
- [x] Alt text extracted from structure elements
- [x] Lang attribute extracted from structure elements
- [ ] MCID (Marked Content ID) extracted
- [x] PDFArray children (multiple kids) handled
- [x] Single PDFDict child (not wrapped in array) handled
- [x] Missing/null StructTreeRoot returns empty result
- [x] RoleMap-resolved type names in output

### `src/engine/utils/accessibility-detect.js`
XMP parsing and trait detection --runner populates `context.traits` from this.
- [x] XMP element-style PDF/A detection (`<pdfaid:part>1</pdfaid:part>`)
- [x] XMP attribute-style PDF/A detection (`pdfaid:part="1"`)
- [x] PDF/A level detection (1a, 1b, 2a, 2b, 3a, 3b)
- [x] PDF/UA detection from XMP
- [x] Title extraction from `dc:title`
- [x] Missing XMP metadata returns defaults
- [x] Malformed XMP doesn't throw
- [x] MarkInfo `/Marked true` detected
- [x] MarkInfo `/Marked false` detected
- [x] Missing MarkInfo detected
- [x] MarkInfo `/Suspects true` detected (added in Suspects fix)
- [x] Language from catalog `/Lang`
- [x] DisplayDocTitle preference
- [x] ToUnicode coverage --all fonts have it
- [x] ToUnicode coverage --some fonts missing it
- [x] ToUnicode coverage --no fonts

### `src/engine/utils/stream-decode.js`
FlateDecode/ASCII85 decompression for content stream parsing.
- [x] FlateDecode (zlib) decompression succeeds
- [x] ASCII85Decode decompression succeeds
- [ ] Fallback chain (inflateSync → decompressSync) on pako-produced streams
- [x] Unsupported filter throws error
- [x] Missing filter type handling (no filter returns data unchanged)
- [x] Multiple chained filters
- [x] getFilterNames extracts single and array filter names
- [x] hasImageFilter detects image-native filters
- [x] allFiltersDecodable validates decodable filters

### `src/engine/utils/content-stream-parser.js`
PDF content stream operator parsing --infrastructure for text/image extraction.
- [ ] Text operators: Tf (set font), Tj/TJ (show text)
- [ ] Image operators: Do (paint XObject)
- [ ] Marked content: BMC/BDC (begin), EMC (end)
- [ ] MCID extraction from BDC dictionaries
- [ ] Form XObject recursion with resource fallback
- [ ] Inline images (BI/ID/EI with binary data boundary)
- [ ] Array content streams (multiple stream refs concatenated)
- [ ] Null/empty stream returns empty result
- [ ] Decompression failure skips stream (doesn't abort)

### `src/worker.js`
Worker message protocol --bridges main thread and audit pipeline.
- [ ] `type: 'audit'` message triggers `runAudit` with buffer
- [ ] Progress callbacks post `type: 'progress'` with sessionId
- [ ] Result message includes findings array and meta
- [ ] Error message includes error string and sessionId
- [ ] sessionId propagated on all outbound messages
- [ ] Non-audit message types silently ignored

---

## High --Existing Tests Missing Important Cases

### Audit modules: RoleMap resolution
No audit module tests verify that custom element types resolve through RoleMap.
- [x] `structure.test.js` --custom heading name (e.g., "Heading1" → "H1") detected in hierarchy
- [x] `images.test.js` --custom figure type (e.g., "Image" → "Figure") counted
- [x] `tables.test.js` --custom table type (e.g., "DataTable" → "Table") detected
- [x] `lists.test.js` --custom list type (e.g., "ItemList" → "L") detected

### `src/audit/fonts.js` --weakest audit module coverage (3 tests)
- [x] Multiple fonts with mixed ToUnicode (some have it, some don't)
- [ ] Font embedding status detection (embedded vs system)
- [ ] CIDFont and Type1/TrueType type detection
- [ ] Symbol/decorative fonts without ToUnicode
- [ ] Type3 font handling (currently skipped entirely)
- [x] Font without `/BaseFont` (malformed) --should handle gracefully
- [ ] Standard 14 fonts (Times, Helvetica) not embedded --expected behavior, should pass

### `src/audit/runner.js` --error isolation
- [ ] Injected module error produces warning Finding (not crash)
- [ ] Encrypted PDF triggers `ignoreEncryption: true` fallback
- [x] Progress callback fires at expected percentages
- [ ] PDF with corrupted structure tree (cycles, missing parents) --graceful handling
- [ ] Multiple module errors in single run --reports all, doesn't halt
- [ ] PDF with stripped/malformed XMP metadata --doesn't crash

### `src/audit/metadata.js` --encryption edge cases
- [ ] Encrypted PDF with accessibility permission allowed → pass
- [ ] Encrypted PDF with accessibility permission blocked → fail
- [ ] Encrypted PDF with malformed `/P` value (non-numeric, missing) → warn
- [ ] DisplayDocTitle explicitly set to `false` → warning (vs missing)

### Audit modules: checks too lenient (code bugs, not just test gaps)
These are cases where the check logic itself needs to be tightened, with tests added.
- [x] `structure.js` --MarkInfo/Suspects=true should fail tagged-pdf check (fixed)
- [x] `images.js` --alt text quality not validated; empty `""`, generic `"image"`, or whitespace-only `" "` alt text passes (FIXED: added generic alt text detection)
- [x] `tables.js` --`/Scope` value not validated; only checks existence, not that it's `Row`/`Column`/`Both` (FIXED: validates Scope value)
- [x] `links.js` --links with no `ActualText` AND no `Alt` should fail, not just be reported (FIXED: counts missing text as fail)
- [x] `forms.js` --form fields without `/FT` (field type) not caught as invalid (tested: still counted and warned about missing TU)
- [x] `lists.js` --only checks for `LBody` presence; PDF/UA 7.6 requires both `Lbl` AND `LBody` (FIXED: checks for both)

---

## Medium --Edge Cases & UI Gaps

### `src/audit/structure.js`
- [x] Heading starting at H2 (no H1)
- [x] Single H1 only (no sub-headings)
- [x] Deep heading nesting (H1 through H6)
- [x] Multiple headings of same level in sequence (H1 → H2 → H2 → H3) --should pass
- [x] Heading decrease then increase (H1 → H2 → H1 → H3)
- [x] Custom heading types via RoleMap (e.g., `Heading1` → `H1`) resolved in hierarchy check

### `src/audit/images.js`
- [x] Empty alt text (`/Alt` present but empty string) --should warn
- [x] Whitespace-only alt text --should warn
- [x] Generic alt text (`"image"`, `"photo"`, `"picture"`) --should warn
- [ ] Very short alt text (1-2 chars) --should warn
- [x] Mixed figures (some with alt, some without, some generic) --per-figure detail

### `src/audit/tables.js`
- [ ] Multiple tables with mixed TH coverage
- [ ] TH with /A as array vs dict
- [ ] Nested table structures (THead/TBody/TFoot)
- [x] Table with invalid `/Scope` value --should fail
- [ ] Table with some TH cells having scope, others missing --should fail
- [ ] Empty table (structure but no TR children) --should not-applicable
- [ ] Data-only table (all TD, no TH) --should fail with specific guidance

### `src/audit/links.js`
- [x] All GENERIC_LINK_TEXT patterns tested (9 patterns tested)
- [x] Case-insensitive generic text matching
- [x] HTTP/HTTPS/FTP bare URL detection
- [x] Link with no ActualText AND no Alt --should fail
- [x] Link with whitespace-only text --should fail or warn
- [x] Mixed links in same PDF (good, generic, bare URL, empty) --per-link detail

### `src/audit/lists.js`
- [x] LI with LBody but no Lbl --should fail per PDF/UA 7.6
- [x] LI with Lbl but no LBody --should fail (existing test: createPdfWithList({ hasLBody: false }))
- [ ] Nested lists (L within LBody) --should pass
- [x] Empty LI (no Lbl, no LBody) --should fail
- [ ] List with unexpected child types (e.g., Div inside LI) --should warn
- [ ] Mixed valid and invalid LIs --should report which items are broken

### `src/audit/forms.js`
- [x] Form field without `/FT` (field type) --should warn as invalid
- [ ] Form field with `/Ff` read-only flag --should note in finding
- [ ] Multi-page PDF where some pages have `/Tabs /S` and others don't --inconsistency warning
- [x] Empty AcroForm (Fields array present but empty) --should be not-applicable
- [ ] HexString-encoded `/TU` values decoded correctly

### `src/audit/reading-order.js`
- [ ] PDF with form fields but no `/Tabs /S` --should include extra guidance in manual-review finding
- [ ] Multi-page PDF with no headings --should suggest reading order is hard to assess

### `src/ui/app-shell.js` --expand existing tests
- [ ] Worker message routing (progress → correct session)
- [ ] Worker error message handling
- [ ] Multi-PDF cascade positioning
- [ ] Window management: tile, cascade, close all
- [ ] Floating panel lifecycle (open, close, reopen)
- [ ] Welcome dialog closable/non-closable states
- [ ] Menu bar submenu keyboard handling (Escape closes)

---

## Low --Infrastructure / Currently Unused

These modules are copied from PDF-A-go-slim or not yet actively used.

### `src/engine/utils/unicode-mapper.js`
- [ ] CID to Unicode mapping
- [ ] ToUnicode CMap parsing
- [ ] Identity-H encoding

### `src/engine/utils/glyph-list.js`
- [ ] Spot-check common glyph names resolve correctly
- [ ] Missing glyph name returns undefined

### `src/engine/utils/hash.js`
- [ ] MD5 known-value test
- [ ] SHA-256 known-value test

### `src/engine/utils/pdf-traversal.js`
- [ ] Full object tree traversal
- [ ] Cycle handling

### `src/main.js`
- [ ] Small-screen banner displays below 768px
- [ ] Dismiss button removes banner
- [ ] Worker created with module type
