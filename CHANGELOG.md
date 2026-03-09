# Changelog

## 1.3.0 2026-03-09

### Audit accuracy
- Fix WCAG reference for heading hierarchy: 1.3.1 → 2.4.6 (Headings and Labels)
- Fix WCAG reference for form labels: 1.3.1 → 3.3.2 (Labels or Instructions)
- Add WCAG reference for font ToUnicode: 4.1.1 (Parsing)
- Recognize `/Formula` StructElem in image alt text checks (not just `/Figure`)
- Support generic `/H` heading type (level 0) in heading hierarchy validation
- Heading hierarchy: non-H1 start without skipped levels is now a warning, not a fail
- Lists: missing `/Lbl` is now a warning (structural issues remain fail)
- Link text extraction: recursively collect text from child StructElems (`/K` children with `/ActualText` or `/Alt`)
- Add color contrast as a manual-review finding (WCAG 1.4.3)

### Self-accessibility
- Add `role="dialog"` and `aria-label` on About, Help, and Bookmark dialogs
- Add `role="dialog"` on Welcome and Progress windows
- Add `role="region"` on Results windows and floating panels
- Announce analysis verdict via `aria-live` region for screen readers
- Document-level drag-and-drop: drop PDFs anywhere on the page, not just the drop zone

### Export quality
- PDF export: set document metadata (title, author, subject, producer, creator, creation date)
- PDF export: render finding details in full-density sections
- CSV export: add details column (semicolon-separated label: value pairs)
- CSV export: prepend UTF-8 BOM for Excel compatibility
- JSON export: include UNDRR 13-point checklist status
- Extract `buildJsonOutput()` and `buildCsvContent()` as testable pure functions

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
