# PRD: PDF-A-go-actionable

## Product Overview

PDF-A-go-actionable is a free, client-side PDF accessibility checker that runs entirely in the browser. No file uploads, no server processing, no accounts. Drop a PDF and get a clear, actionable accessibility report.

The tool fills a gap in the current landscape: most free accessibility checkers are either desktop-only (PAC, veraPDF), require uploads to third-party servers (axesCheck, PDFix), or are limited in scope (PDFcheck). PDF-A-go-actionable delivers comprehensive, practical accessibility auditing with zero privacy concerns.

### Target Users

- **Document producers** at NGOs, government agencies, and universities who need to validate PDFs before publication
- **Accessibility coordinators** reviewing documents from multiple authors
- **Designers** (InDesign, Word, PowerPoint) who want quick feedback before handing off to an accessibility specialist
- **Anyone** who needs a free alternative to Acrobat Pro's accessibility checker

### Positioning

This is a **validation tool**, not a remediation tool. It tells you exactly what's wrong and what to fix — it does not edit the PDF. Think of it as "PAC in a browser" rather than "Acrobat Pro in a browser."

---

## V1.0 Scope — Practical Accessibility Audit

### Design Philosophy

- **Actionable over exhaustive.** Every check result should tell the user what's wrong and what to do about it. Avoid jargon-heavy compliance-speak.
- **Practical over pedantic.** Cover the checks that matter most in real-world accessibility (the 13-point checklist from validation workflows), not the full 300+ PDF/UA machine rules.
- **Client-side only.** All processing happens in the browser via Web Workers. No data leaves the user's machine.
- **Professional UI.** Desktop metaphor with functional panel layout. Clean, modern aesthetic — serious tool for serious work, not a novelty.

### Audit Checks (mapped to UNDRR 13-point checklist)

#### Automated — Pass/Fail

| # | Check | Detection Method |
|---|---|---|
| 1 | Document title is set (not filename) | XMP `dc:title` + Info dict `/Title` |
| 2 | Document language is specified | Catalog `/Lang` |
| 3 | Security permits accessibility | Encryption dict `/P` permissions bit 5 |
| 4 | PDF is tagged | `/MarkInfo << /Marked true >>` |
| 5 | Structure tree present | Catalog `/StructTreeRoot` |
| 6 | All meaningful images have alt text | `/Figure` StructElems with/without `/Alt` |
| 7 | Decorative images marked as artifacts | Images not referenced by StructElems, artifact markers in content streams |
| 8 | Headings use correct hierarchy | H1-H6 StructElems in document order; skip detection |
| 9 | Tables have proper header cells | `/Table` StructElems with `/TH` children and `/Scope` |
| 10 | Lists are properly tagged | `/L` > `/LI` > `/Lbl` + `/LBody` structure |

#### Automated — Informational

| Check | Detection Method |
|---|---|
| PDF/A conformance level | XMP `pdfaid:part` + `pdfaid:conformance` |
| PDF/UA conformance | XMP `pdfuaid:part` |
| DisplayDocTitle enabled | `/ViewerPreferences << /DisplayDocTitle true >>` |
| ToUnicode CMap coverage | Font objects with/without `/ToUnicode` stream |
| Bookmark/outline presence | Catalog `/Outlines` |
| Tab order set to structure | Per-page `/Tabs /S` |
| Form field labeling | `/AcroForm` fields with/without `/TU` tooltips |
| Link text quality | `/Link` StructElem text content; flag generic ("click here") |
| Structure tree summary | Element count, types, max depth |
| Per-element language | `/Lang` on individual StructElems |

#### Manual Review Required (flagged with guidance)

| # | Check | What We Provide |
|---|---|---|
| 5 | Reading order is logical | Structure tree order visualization; anomaly detection |
| 12 | PAC reports no errors | Link to PAC download + online alternatives |
| 13 | Logical reading order confirmed by ear | Link to NVDA download; testing guidance |

### Report Output

The audit produces a structured report with:

1. **Summary score** — e.g., "8 of 10 automated checks passed, 2 issues found, 3 items need manual review"
2. **Per-check detail** — pass/fail/warning/manual-check status, explanation, remediation guidance
3. **Structure tree explorer** — interactive tree view of the tag structure
4. **Font inventory** — all fonts with ToUnicode status
5. **Image inventory** — all images with alt text status

### V1.1 — Machine-Actionable Reports (future)

Leave the architecture open for structured, machine-readable output:

- **JSON report export** — full audit results as structured JSON
- **EARL (Evaluation and Report Language)** — W3C standard for accessibility evaluation results
- **CI/CD integration** — CLI mode or API endpoint for automated pipelines
- **Batch processing** — multiple PDFs, aggregate reporting
- **veraPDF rule mapping** — map findings to veraPDF rule IDs for interoperability

The V1.0 data model should already use structured objects internally (not just rendered HTML), making V1.1 export a thin serialization layer.

---

## Technical Architecture

### Stack

- **Vite** — build tool (same as PDF-A-go-slim)
- **pdf-lib** — low-level PDF object access (proven in PDF-A-go-slim)
- **fflate** — stream decompression for content stream parsing
- **dockview-core** — panel/window management (MIT, actively maintained, VS Code-grade aesthetic)
- **Web Workers** — off-main-thread PDF parsing and auditing

### Shared Code from PDF-A-go-slim

The following modules can be extracted or copied from PDF-A-go-slim as a starting point:

| Module | Purpose |
|---|---|
| `accessibility-detect.js` | Core trait detection + existing audits |
| `content-stream-parser.js` | Extract char codes per font from content streams |
| `unicode-mapper.js` | Map char codes to Unicode codepoints |
| `glyph-list.js` | Adobe Glyph List + encoding tables |
| `stream-decode.js` | Decoders: Flate, LZW, ASCII85, ASCIIHex, RunLength |
| `pdf-traversal.js` | BFS graph walker from PDF trailer |
| `hash.js` | djb2 hash utility |

### New Code

```
src/
  main.js              — app shell, drag-and-drop, worker orchestration
  worker.js            — Web Worker: loads PDF, runs audit, posts results
  audit/
    runner.js           — orchestrates all audit modules, collects findings
    metadata.js         — title, lang, security, displayDocTitle, bookmarks
    structure.js        — tagged check, structure tree walk, heading hierarchy
    images.js           — alt text coverage, decorative image detection
    tables.js           — TH/TD validation, scope, caption
    lists.js            — L/LI/Lbl/LBody structure validation
    fonts.js            — ToUnicode coverage, embedding status
    forms.js            — field labels, tab order
    links.js            — link text quality analysis
    reading-order.js    — content stream position vs structure tree order
  ui/
    app-shell.js        — dockview layout setup, panel registration
    report.js           — summary score, per-check cards
    tree-explorer.js    — interactive structure tree view
    font-table.js       — font inventory display
    image-table.js      — image inventory display
    guidance.js         — remediation text and external links
  engine/utils/         — shared utilities (from PDF-A-go-slim)
```

### Data Model

Each audit check produces a `Finding` object:

```js
{
  id: 'heading-hierarchy',          // stable identifier
  category: 'structure',            // grouping
  title: 'Heading Hierarchy',       // human label
  status: 'fail',                   // 'pass' | 'fail' | 'warning' | 'manual' | 'not-applicable'
  summary: 'Heading level skipped: H1 → H3 (missing H2)',
  details: [ ... ],                 // per-instance details
  remediation: 'Add H2 headings between H1 and H3 sections in your source document.',
  wcagRef: '1.3.1',                 // WCAG success criterion
  pdfuaRef: '7.4.2',               // PDF/UA clause (where applicable)
}
```

This model supports both human-readable rendering (V1.0) and machine-readable export (V1.1).

### Worker Protocol

Inbound:
```js
{ type: 'audit', buffer: ArrayBuffer }
```

Outbound:
```js
{ type: 'progress', phase: 'structure', percent: 40 }
{ type: 'result', findings: Finding[], meta: { pageCount, fileSize, ... } }
{ type: 'error', message: string }
```

---

## UI / UX

### Layout

Professional panel-based layout using dockview-core:

- **Drop zone** — prominent, always accessible (top bar or dedicated panel)
- **Summary panel** — overall score and pass/fail counts
- **Findings panel** — expandable list of all checks, grouped by category
- **Structure explorer panel** — interactive tag tree (collapsible, searchable)
- **Details panel** — selected check details, remediation guidance, WCAG/PDF/UA references
- **Font & image inventories** — tabular views as secondary panels

Panels can be rearranged, resized, and toggled. Layout state persists in localStorage.

### Visual Design

- Clean, neutral color palette (not retro)
- Traffic-light status indicators (green pass, red fail, amber warning, blue manual-check)
- Professional typography — system font stack or Inter
- Dark mode support via dockview's built-in theming
- Responsive: panels stack vertically on mobile

### Interaction Flow

1. User drops PDF (or clicks to browse)
2. Progress bar during analysis (fast — typically under 2 seconds)
3. Summary appears with overall score
4. User explores findings, drills into details
5. Remediation guidance tells them exactly what to fix and where
6. Optional: export report as JSON (V1.1 groundwork — the button can exist in V1.0 UI)

---

## Non-Goals (V1.0)

- PDF editing or remediation
- Full PDF/UA-1 or PDF/UA-2 conformance validation (300+ rules)
- Color contrast analysis (requires full rendering)
- Screen reader simulation
- Server-side processing
- User accounts or saved history

---

## Success Criteria

- Covers 10 of 13 UNDRR checklist items with automated checks
- Zero false positives on well-formed tagged PDFs (e.g., PDF/UA-compliant documents)
- Processes a 50-page tagged PDF in under 3 seconds
- Works offline after initial load (service worker cacheable)
- Passes WCAG 2.1 AA itself (the accessibility checker must be accessible)

---

## Open Questions

1. **Window manager choice:** dockview-core (VS Code aesthetic, MIT, active) is the leading candidate. WinBox.js (5 kB, simpler API, Apache 2.0, stalled) is the lightweight alternative. Decision needed before UI implementation begins.
2. **Shared code strategy:** Copy modules from PDF-A-go-slim vs. extract to a shared npm package. Copying is simpler for V1.0; a shared package makes sense if both tools evolve in parallel.
3. **PDF.js for visual preview:** Adding Mozilla's pdf.js would enable page rendering for reading-order visualization. Significant bundle addition (~400 kB). Worth evaluating for V1.1.
4. **Branding / domain:** Naming follows the "PDF-A-go-*" family. Consider whether "actionable" communicates the right thing to non-technical users, or whether something like "PDF-A-go-check" is clearer.
