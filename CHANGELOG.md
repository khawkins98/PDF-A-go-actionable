# Changelog

## 1.3.2 2026-03-12

### Bug fixes
- Fixed PDF export crash ("can't access lexical declaration before initialization"). The `nextMcid` variable was declared after the first call to `addNewPage()` which referenced it, causing a Temporal Dead Zone error in production builds.

## 1.3.1 2026-03-10

### PDF export branding
- Logo mark + tool name header on first page, linked to the web app
- Page footer on every page: mini logo, "View on GitHub" link, page numbers
- Section headings with colored accent bars
- Metadata values truncated with ellipsis to fit column width (long filenames no longer bleed over)
- Removed divider lines between sections
- Timestamped filenames on all exports (JSON, CSV, PDF) so re-exports don't collide
- Report subtitle now shows date and time, not just date

### PDF export accessibility
The exported report is now a tagged PDF. It passes all of our own checks except PDF/UA conformance (which we intentionally don't claim).

- Tagged structure tree: content wrapped in `BDC`/`EMC` marked content with roles (H1, H2, H3, P, Sect, Artifact), StructTreeRoot > Document > StructElem hierarchy, and ParentTree
- Document language `en` on the catalog
- `DisplayDocTitle` viewer preference enabled
- Tab order set to structure (`/Tabs /S`) on all pages
- Bookmarks for each report section
- XMP metadata (`dc:title`, `dc:creator`, `xmp:CreatorTool`)
- Keywords: "PDF accessibility, WCAG, audit report, PDF/UA, assistive technology"
- Per-element language (`Lang='en'`) on the Document StructElem
- Footer content marked as Artifact (Pagination/Footer type) so screen readers skip it
- Fix: MCID counter resets per page — the old global counter broke ParentTree indexing on multi-page reports
- Fix: link annotation handler now works when a page already has annotations (direct PDFArray vs indirect PDFRef)

### Audit changes
- PDF/UA Conformance is now `manual` instead of `warning` — we're not pushing people toward full PDF/UA
- PAC Validation finding removed — the PDF/UA Conformance finding already mentions PAC and veraPDF

## 1.3.0 2026-03-10

### Audit accuracy
- Severity corrections: `form-labels`, `font-embedding`, and `font-tounicode` promoted from warning to fail
- Tab order severity: `fail` when form fields present (keyboard navigation broken), `warning` otherwise (best practice — structure tree still governs screen reader reading order)
- Standard 14 font exemption: base PDF fonts (Helvetica, Courier, Times-Roman, Symbol, ZapfDingbats and variants) exempt from ToUnicode requirement
- CIDFont composite font embedding: Type0 fonts now check DescendantFonts for embedding status
- BCP-47 language validation: invalid document-level and per-element language tags produce warnings
- Nested form field traversal: recursive `/Kids` resolution finds leaf fields inside parent containers (depth cap 20)
- Table TR wrapper validation: TH/TD cells not wrapped in TR elements are flagged
- Page numbers in finding details: all structure-based checks include `Page N:` prefix when page reference is available
- Fix WCAG references: heading hierarchy → 2.4.6, form labels → 3.3.2, font ToUnicode → 4.1.1
- Recognize `/Formula` StructElem in image alt text checks (not just `/Figure`)
- Support generic `/H` heading type (level 0) in heading hierarchy validation
- Heading hierarchy: non-H1 start without skipped levels is now a warning, not a fail
- Lists: missing `/Lbl` is now a warning (structural issues remain fail)
- Link text extraction: recursively collect text from child StructElems
- Add color contrast as a manual-review finding (WCAG 1.4.3)

### Self-accessibility
- Add ARIA roles (`dialog`, `region`) on all WinBox windows
- Announce analysis verdict via `aria-live` region for screen readers
- Document-level drag-and-drop: drop PDFs anywhere on the page, not just the drop zone
- Structure tree: color-coded icons for tag types (headings, figures, tables, links, lists)
- Structure tree: hover tooltips with plain-English tag explanations
- Creator-specific hint banner on dashboard (InDesign, Word, PowerPoint, Acrobat, LibreOffice)

### Dashboard UX
- Remove UNDRR 13-point validation checklist from dashboard (findings are already shown in status-grouped sections — the checklist duplicated them)
- Remediation hints: first sentence of remediation shown inline on fail/warning rows
- Document title shown in dashboard header and window title bar when available
- `display-doc-title` decoupled from checklist item #1

### Export quality
- PDF export: set document metadata (title, author, subject, producer, creator, creation date)
- PDF export: render finding details in full-density sections
- CSV export: add details column and UTF-8 BOM for Excel compatibility
- JSON export: remove UNDRR checklist (findings already included individually)
- PDF export: remove separate checklist summary page (findings grouped by status in main report)
- Extract `buildJsonOutput()` and `buildCsvContent()` as testable pure functions

### Remediation guidance
- InDesign-specific remediation tips added to all finding remediations
- Link text remediation includes bare URL workaround
- Tab order guidance includes Adobe Acrobat steps

### Performance
- Single-pass structure tree walk: `getStructureElements()` cached in shared context
- Performance benchmark: 1000-element PDF audited in under 3 seconds

### Better error messages
- Non-PDF file detection via `%PDF-` magic byte check
- Password-protected PDF detection with specific remediation guidance
- Corrupt PDF detection with clearer messaging

### Messaging
- Clarify that this is not a PDF/UA conformance validator; it covers the checks that most affect whether a PDF works with assistive technology
- Updated README, About dialog, welcome screen, meta tags, and PDF export
- Replaced "Non-Goals" with "Scope" section in README

### Test infrastructure
- New shared assertion helpers: `findFindingById()`, `expectFindingStatus()`
- 6 new PDF fixture factories
- 798 tests across 45 test files (up from 688 across 40)

## 1.2.0 2026-03-02

- 13-point validation checklist alignment throughout the tool
- Dashboard: validation checklist section with color-coded number badges and contextual N/A reasons
- PDF export: checklist summary as page 1 with columnar status badges, numbered items, and additional checks
- Details panel: "Why This Matters" narrative, authoring-tool tips (Word, InDesign, PowerPoint, Acrobat) with auto-detection from creator/producer metadata, and complementary tool links
- Help dialog: complementary tools reference section (PAC, NVDA, VoiceOver, JAWS, veraPDF, Acrobat Pro, axesCheck)
- Checklist item 11 (accessibility checker passes) derives status from overall verdict
- Remove unused guidance module (superseded by undrr-checklist)

## 1.1.0 2026-02-28

- Report Dashboard as initial results view with PASS/FAIL/PASS WITH WARNINGS verdict banner
- Document properties metadata grid with warning indicators for missing accessibility fields
- Findings grouped by status: fail/warning as full rows, manual review as compact cards, pass/N/A as chips
- Download Report (PDF) as primary call-to-action, View Advanced Report for detailed findings
- Back to Dashboard button in detailed view for easy navigation
- Verdict edge case handling for manual-only and empty findings
- Accessibility improvements: aria-hidden on decorative badges, role="status" on verdict label, touch target sizing
- Bus subscription lifecycle cleanup to prevent memory leaks
- PDF export layout fix for verdict banner text overflow

## 1.0.0 2026-02-25

- Initial release: browser-based PDF accessibility checker
- 10 automated checks from the 13-point accessibility checklist plus 3 manual review items
- 9 audit modules: metadata, structure, images, tables, lists, fonts, forms, links, reading order
- Interactive structure tree with ARIA tree view, keyboard navigation, and search/filter
- PDF preview with page rendering, zoom, MCID highlights, and reading order overlay
- Font inventory and image inventory panels
- Multi-PDF support with per-session scoped event buses
- Export as JSON, CSV, or PDF summary report
- NeXTSTEP-inspired visual theme
- Fully client-side — no uploads, no server, no accounts
