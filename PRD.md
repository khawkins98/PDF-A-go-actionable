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

### Audit Checks (13-point PDF accessibility checklist)

#### Automated — Pass/Fail

| # | Check | Detection Method |
|---|---|---|
| 1 | Document title is set (not filename) | XMP `dc:title` + Info dict `/Title` |
| 2 | Document language is specified | Catalog `/Lang` |
| 3 | Security permits accessibility | Encryption dict `/P` permissions bit 5 |
| 4 | PDF is tagged | `/MarkInfo << /Marked true >>` |
| 5 | Structure tree present | Catalog `/StructTreeRoot` |
| 6 | All meaningful images have alt text | `/Figure` StructElems with/without `/Alt` |
| 7 | Decorative images flagged for review | Images not in structure tree flagged as "please verify — may need alt text or artifact marking" (`warning` status) |
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
| Link text quality | `/Link` StructElem text content; flag generic ("click here", "here", "read more", "learn more", "link", "this link", "more info", "download") and bare URLs |
| Structure tree summary | Element count, types, max depth |
| Per-element language | `/Lang` on individual StructElems |

#### Manual Review Required (flagged with guidance)

| # | Check | What We Provide |
|---|---|---|
| 11 | Reading order is logical | List of content items showing structure-tree order vs. page position order, with mismatches flagged |
| 12 | PAC reports no errors | Link to PAC download + online alternatives |
| 13 | Logical reading order confirmed by ear | Link to NVDA download; testing guidance |

### Report Output

The audit produces a structured report with:

1. **Summary score** — e.g., "8 of 10 automated checks passed, 2 issues found, 3 items need manual review"
2. **Per-check detail** — pass/fail/warning/manual-check status, explanation, remediation guidance
3. **Structure tree explorer** — interactive tree view of the tag structure
4. **Font inventory** — all fonts with ToUnicode status
5. **Image inventory** — all images with alt text status
6. **Export** — download results as JSON, CSV, or a PDF summary report

### V1.1 — Extended Capabilities (future)

See `FUTURE-IDEAS.md` for the full deferred feature list. Key items:

- **EARL (Evaluation and Report Language)** — W3C standard for accessibility evaluation results
- **CI/CD integration** — CLI mode or API endpoint for automated pipelines
- **Batch processing** — multiple PDFs, aggregate reporting
- **veraPDF rule mapping** — map findings to veraPDF rule IDs for interoperability
- **Dark mode** — WinBox theme variant
- **Per-image decorative detection** — MCID-to-content-stream correlation for exact identification

---

## Technical Architecture

### Stack

- **Vite** — build tool (same as PDF-A-go-slim)
- **pdf-lib** — low-level PDF object access (proven in PDF-A-go-slim)
- **fflate** — stream decompression for content stream parsing
- **WinBox.js** — window management (~5 KB, Apache 2.0). Custom accessible theme with modular CSS (no built-in design tokens — we write our own reusable theme).
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
    app-shell.js        — WinBox layout setup, window creation
    report.js           — summary score, per-check cards
    tree-explorer.js    — interactive structure tree view
    font-table.js       — font inventory display
    image-table.js      — image inventory display
    guidance.js         — remediation text and external links
    export.js           — JSON, CSV, and PDF report generation
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

Window-based layout using WinBox.js:

- **Drop zone** — prominent, always accessible (top bar or dedicated area)
- **Summary window** — overall score and pass/fail counts
- **Findings window** — expandable list of all checks, grouped by category
- **Structure explorer window** — interactive tag tree (collapsible, searchable)
- **Details window** — selected check details, remediation guidance, WCAG/PDF/UA references
- **Font & image inventories** — tabular views as secondary windows

Windows can be moved, resized, minimized, and maximized. Users arrange them to suit their workflow.

### Visual Design

- Soft, high-contrast accessible light theme (not blazing white). The tool must pass WCAG 2.1 AA itself.
- Traffic-light status indicators (green pass, red fail, amber warning, blue manual-check)
- Professional typography — system font stack or Inter
- **Light mode only for V1.0.** Theme CSS is structured to support dark mode later without a rewrite.
- **WinBox theme is modular** — written as a standalone CSS file that could be reused by other WinBox projects. nextOS-inspired feel.
- **Desktop-focused.** On small screens (< 768px), show a dismissible banner: "This tool is designed for larger screens." No mobile-specific layout — users aren't blocked, just informed.

### Interaction Flow

1. User drops PDF (or clicks to browse)
2. Progress bar during analysis (fast — typically under 2 seconds)
3. Summary appears with overall score
4. User explores findings, drills into details
5. Remediation guidance tells them exactly what to fix and where
6. Export results as JSON, CSV, or PDF summary report

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

- Covers 10 of 13 checklist items with automated checks
- Zero false positives on well-formed tagged PDFs (e.g., PDF/UA-compliant documents)
- Processes a 50-page tagged PDF in under 3 seconds
- Works offline in practice (static assets, no server calls). Explicit service worker deferred to V1.1.
- Passes WCAG 2.1 AA itself (the accessibility checker must be accessible)

---

## Attribution & Acknowledgments

### Policy

When this project draws on code, patterns, or ideas from other projects, we cite the source clearly. This applies to:

- **Direct code reuse** — the 7 utility modules copied from PDF-A-go-slim should credit that project and note that they in turn depend on work from pdf-lib, fflate, and the broader PDF specification ecosystem.
- **Design inspiration** — if UI patterns, interaction models, or check logic are informed by existing tools (PAC, axesCheck, veraPDF, etc.), say so.
- **Dependencies** — runtime dependencies (pdf-lib, fflate, WinBox.js, etc.) should be acknowledged with their licenses.
- **Standards and references** — WCAG, PDF/UA, Matterhorn Protocol, and other specifications that inform the audit checks.

### Where attribution appears

- **README.md** — an "Acknowledgments" section listing key inspirations and dependencies.
- **In-app** — an "About" panel or footer with credits and dependency licenses.
- **Source code** — file-level comments in modules adapted from other projects, noting the origin (e.g., "Adapted from PDF-A-go-slim's stream-decode.js, which builds on fflate by 101arrowz").

### Upstream awareness

The utility modules shared with PDF-A-go-slim are not written in a vacuum — they build on capabilities provided by their dependencies. When we adapt or extend these modules, we should remain aware of and credit the upstream chain. For example, `stream-decode.js` wraps fflate's decompression; `unicode-mapper.js` implements logic informed by the Adobe Glyph List specification; `content-stream-parser.js` implements parsing defined by the PDF specification (ISO 32000).

---

## Testing

### Framework

**Vitest** — natural fit with Vite. Audit modules are pure functions (PDF buffer in, findings out), ideal for unit tests.

### Sample PDFs

Bundled sample PDFs serve double duty: test fixtures for development, and a "try it now" feature in the app (users can select a sample PDF from a menu instead of dropping their own).

Sources (all CC BY 4.0 or public domain, compatible with this project's license (MIT) with required attribution):

| Source | What | Use |
|---|---|---|
| **veraPDF Corpus** | Pass/fail pairs per Matterhorn Protocol checkpoint | Automated regression tests |
| **PDF/UA Reference Suite 1.1** | 10 well-formed PDF/UA-1 documents | Zero-false-positive verification |
| **PDF Association Techniques** | Atomic pass/fail examples per technique | Unit-testing individual checks |

Cherry-pick a small representative set covering the 10 automated checks. Store in `test/fixtures/` with a manifest describing each file's expected results. The app loads a curated subset from `public/samples/`.

---

## Resolved Questions

1. **Window manager:** WinBox.js (~5 KB, Apache 2.0). Lightweight, full CSS control. We write a custom accessible theme (modular, reusable, nextOS-inspired). No built-in design tokens — theming is class-based CSS overrides.
2. **Shared code strategy:** Copy 7 modules from PDF-A-go-slim's `src/engine/utils/` into `src/engine/utils/`. They're self-contained (only depend on pdf-lib + fflate, both already in our stack). Expect divergence — the optimization project and validation project serve different goals.
3. **PDF.js:** Not used by PDF-A-go-slim (it uses pdf-lib only). Not needed for V1.0. Reading order uses a list of items with structure-tree vs. page-position order, flagging mismatches — no page rendering required.
4. **Branding:** Keep "actionable" — it differentiates from "check" (passive) and signals the remediation guidance angle.
5. **Decorative image detection:** V1.0 uses a heuristic (image count vs. figure count). Flag unmatched images as "please verify — may need alt text or artifact marking" (`warning` status). Per-image MCID correlation deferred to V1.1.
6. **Link text quality:** Simple built-in word list: "click here", "here", "read more", "learn more", "link", "this link", "more info", "download". Also flag bare URLs as link text.
7. **Mobile:** Desktop-focused. Dismissible banner on small screens (< 768px): "This tool is designed for larger screens." No mobile-specific layout work.
8. **Dark mode:** Light only for V1.0. Theme CSS structured for easy dark mode addition later.
9. **Export:** V1.0 feature, not deferred. Export audit results as JSON, CSV, or a PDF summary report.
10. **Service worker:** Deferred. App works offline in practice (static assets, no server). Explicit service worker in V1.1.
11. **Testing:** Vitest for unit tests. Sample PDFs bundled for both testing and in-app "try it" feature.
12. **Content stream robustness:** Architect the audit layer defensively — graceful fallbacks (warning findings, not crashes) if pdf-lib or stream parsing hits edge cases. Plan for robustness from the start since we'll be doing intensive checking.
