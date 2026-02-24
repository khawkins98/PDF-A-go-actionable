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
- **Professional UI.** Conventional desktop application layout: welcome dialog, progress dialog, main results window with floating tool panels. Clean, modern aesthetic — serious tool for serious work, not a novelty.
- **Test-driven.** Tests are written before implementation. Every audit check has passing and failing test cases defined upfront. This ensures correctness from the start and prevents regressions as the codebase grows.
- **Conventional Commits.** All commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, etc.). This keeps the git history scannable and enables automated changelogs later.

### Audit Checks (13-point PDF accessibility checklist)

#### Automated — Pass/Fail

All 10 automated checks are implemented with tests (`src/audit/`). Each resolves custom types through RoleMap.

| # | Check | Detection Method | Status |
|---|---|---|---|
| 1 | Document title is set (not filename) | XMP `dc:title` + Info dict `/Title` | Done |
| 2 | Document language is specified | Catalog `/Lang` | Done |
| 3 | Security permits accessibility | Encryption dict `/P` permissions bit 5 + bit 10 | Done |
| 4 | PDF is tagged | `/MarkInfo << /Marked true >>` | Done |
| 5 | Structure tree present | Catalog `/StructTreeRoot` | Done |
| 6 | All meaningful images have alt text | `/Figure` StructElems with/without `/Alt` (resolved via RoleMap) | Done |
| 7 | Decorative images flagged for review | Images not in structure tree flagged as "please verify — may need alt text or artifact marking" (`warning` status) | Done |
| 8 | Headings use correct hierarchy | H1-H6 StructElems in document order; skip detection (via tree walk) | Done |
| 9 | Tables have proper header cells | `/Table` StructElems with `/TH` children and `/Scope` (resolved via RoleMap) | Done |
| 10 | Lists are properly tagged | `/L` > `/LI` > `/Lbl` + `/LBody` structure (resolved via RoleMap) | Done |

#### Automated — Informational

| Check | Detection Method | Status |
|---|---|---|
| PDF/A conformance level | XMP `pdfaid:part` + `pdfaid:conformance` | Done |
| PDF/UA conformance | XMP `pdfuaid:part` | Done |
| DisplayDocTitle enabled | `/ViewerPreferences << /DisplayDocTitle true >>` | Done |
| ToUnicode CMap coverage | Font objects with/without `/ToUnicode` stream | Done |
| Font embedding status | FontDescriptor with/without FontFile/FontFile2/FontFile3 | Done |
| Bookmark/outline presence | Catalog `/Outlines` | Done |
| Tab order set to structure | Per-page `/Tabs /S` | Done |
| Form field labeling | `/AcroForm` fields with/without `/TU` tooltips | Done |
| Link text quality | `/Link` StructElem text content; flag generic ("click here", "here", "read more", "learn more", "link", "this link", "more info", "download") and bare URLs | Done |
| Structure tree summary | Element count, types, max depth | Done |
| Per-element language | `/Lang` on individual StructElems | **Pending** |

#### Manual Review Required (flagged with guidance)

All three manual-review items return `manual` status findings with actionable guidance and tool links.

| # | Check | What We Provide | Status |
|---|---|---|---|
| 11 | Reading order is logical | Guidance to use the Structure Tree panel to review element order; remediation instructions for authoring tools | Done (guidance only — automated order-vs-position comparison is deferred) |
| 12 | PAC reports no errors | Link to PAC download + online alternatives | Done |
| 13 | Logical reading order confirmed by ear | Link to NVDA download; VoiceOver instructions; testing guidance | Done |

### Report Output

The audit produces a structured report with:

1. **Summary score** — pass/fail/warning/manual/not-applicable counts with traffic-light status icons | Done
2. **Per-check detail** — pass/fail/warning/manual-check status, explanation, remediation guidance | Done
3. **Structure tree explorer** — summary view (element count, types, max depth, heading hierarchy); full interactive tree rendering is a placeholder | Partial
4. **Font inventory** — all fonts with ToUnicode and embedding status | Done
5. **Image inventory** — all images with alt text status | Done
6. **Export** — download results as JSON, CSV, or a PDF summary report (all three formats implemented) | Done

### Remaining V1.0 Work

- **Per-element language check** — informational check for `/Lang` on individual StructElems (not yet implemented)
- **Interactive structure tree** — full tree rendering with lazy expansion (currently shows summary data only)
- **Layout persistence** — save/restore WinBox window positions in localStorage
- **Sample PDFs** — bundled samples in `public/samples/` for "try it now"
- ~~**In-app About/Credits panel**~~ — Done (About dialog in menu bar)
- **Reading order comparison** — automated structure-tree-order vs. page-position-order analysis (currently guidance-only)
- **Worker protocol tests** — test coverage for worker message handling
- **Real-world PDF testing** — test with PDFs from Word, InDesign, PptxGenJS, etc.

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

- **Vite** — build tool (same as PDF-A-go-slim) | Done
- **pdf-lib** — low-level PDF object access (proven in PDF-A-go-slim) | Done
- **fflate** — stream decompression for content stream parsing | Done
- **WinBox** — floating window management (movable, resizable windows) | Done
- **Web Workers** — off-main-thread PDF parsing and auditing | Done
- **Vanilla JS** — no framework | Done

### Shared Code from PDF-A-go-slim

All 7 modules copied to `src/engine/utils/` with provenance comments. Done.

| Module | Purpose | Status |
|---|---|---|
| `accessibility-detect.js` | Core trait detection + existing audits | Done |
| `content-stream-parser.js` | Extract char codes per font from content streams | Done |
| `unicode-mapper.js` | Map char codes to Unicode codepoints | Done |
| `glyph-list.js` | Adobe Glyph List + encoding tables | Done |
| `stream-decode.js` | Decoders: Flate, LZW, ASCII85, ASCIIHex, RunLength | Done |
| `pdf-traversal.js` | BFS graph walker from PDF trailer | Done |
| `hash.js` | djb2 hash utility | Done |

### New Code

All source files created. Done.

```
src/
  main.js              — entry point, worker creation, app shell init
  worker.js            — Web Worker: loads PDF, runs audit, posts results with sessionId
  audit/
    runner.js           — orchestrates all audit modules, collects findings
    metadata.js         — title, lang, security, displayDocTitle, bookmarks
    structure.js        — tagged check, structure tree walk, heading hierarchy
    images.js           — alt text coverage, decorative image detection
    tables.js           — TH/TD validation, scope
    lists.js            — L/LI/Lbl/LBody structure validation
    fonts.js            — ToUnicode coverage, embedding status
    forms.js            — field labels, tab order
    links.js            — link text quality analysis
    reading-order.js    — manual review guidance (PAC, NVDA, reading order)
  ui/
    app-shell.js        — WinBox multi-session lifecycle: menu bar + welcome → progress → per-PDF results + floating panels
    state.js            — EventBus class, global singleton, createSessionBus() for per-session isolation
    drop-zone.js        — reusable multi-file upload component (drag-and-drop + browse)
    report.js           — summary score, metadata, status counts
    findings-list.js    — grouped/sorted finding cards
    details.js          — selected finding detail + remediation
    tree-explorer.js    — structure tree summary view
    font-table.js       — font inventory table
    image-table.js      — image inventory table
    guidance.js         — remediation text templates and external links
    export.js           — JSON, CSV, and PDF report generation
  engine/utils/
    resolve.js          — PDFRef resolution helper (new)
    role-map.js         — RoleMap resolution for structure elements (new)
    struct-tree-walker.js — depth-first tree walk with safety caps (new)
    accessibility-detect.js — (from PDF-A-go-slim)
    content-stream-parser.js — (from PDF-A-go-slim)
    unicode-mapper.js   — (from PDF-A-go-slim)
    glyph-list.js       — (from PDF-A-go-slim)
    stream-decode.js    — (from PDF-A-go-slim)
    pdf-traversal.js    — (from PDF-A-go-slim)
    hash.js             — (from PDF-A-go-slim)
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

Implemented in `src/worker.js`. Done.

Inbound:
```js
{ type: 'audit', buffer: ArrayBuffer, fileName: string, sessionId: string }
```

Outbound (all include `sessionId` for routing to the correct session):
```js
{ type: 'progress', sessionId, phase: 'structure', percent: 40 }
{ type: 'result', sessionId, findings: Finding[], meta: { pageCount, fileSize, ... } }
{ type: 'error', sessionId, message: string }
```

---

## UI / UX

### Layout

Desktop-style layout using WinBox (floating, movable, resizable windows) with a persistent application menu bar. Supports multiple PDFs — each gets its own results window. Done.

- **App menu bar** — persistent fixed bar at top of viewport; contains Open File(s), Export All (format submenu), Window (Tile All/Cascade All/Close All + open window list), About, Help | Done
- **Welcome dialog** — centered window with app info, feature highlights, and multi-file upload zone; reappears when all results windows are closed | Done
- **Progress dialog** — per-session centered window with file name, progress bar, and phase info | Done
- **Results windows** — one per analyzed PDF, cascade-positioned (~85% of viewport); contains summary bar (top), session toolbar (floating panel toggles + per-file export), and split findings/details view; movable and resizable | Done
- **Floating tool panels** — Structure Tree, Font Inventory, Image Inventory per session; opened from session toolbar buttons; movable, resizable, closeable | Done
- **About dialog** — app info, version, technology credits | Done
- **Help dialog** — usage steps, tips, keyboard shortcuts | Done

All WinBox windows are constrained below the menu bar height (36px) for drag and maximize. Each results window shows summary + findings list (left 35%) + finding details (right 65%). Finding selection is scoped per session via `EventBus` instances — selecting a finding in one window doesn't affect another. Floating panels open per session and can be repositioned. Closing all results windows returns to the welcome dialog.

### Visual Design

- Soft, high-contrast accessible light theme with CSS custom properties. The tool must pass WCAG 2.1 AA itself. | Done
- Traffic-light status indicators (green pass #2b8a3e, red fail #c92a2a, amber warning #e67700, blue manual-check #1864ab) — not color-only, includes text labels | Done
- Professional typography — system font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto) | Done
- **Light mode only for V1.0.** Theme CSS structured with custom properties for easy dark mode addition. | Done
- **WinBox theme** — white theme via `winbox/dist/css/themes/white.min.css`. | Done
- **Desktop-focused.** On small screens (< 768px), show a dismissible banner: "This tool is designed for larger screens." No mobile-specific layout — users aren't blocked, just informed. | Done
- **Skip link** for keyboard navigation. Focus-visible outlines. ARIA labels on interactive regions. | Done

### Interaction Flow

All steps implemented. Done.

1. App menu bar is always visible at the top of the viewport
2. Welcome dialog opens with app info and multi-file upload zone
3. User drops PDFs or uses menu bar "Open File(s)" to browse
4. Per-file progress dialogs show analysis progress with phase info
5. Each analyzed PDF spawns its own cascade-positioned results window
6. User explores findings in any window; finding selection is scoped per session
7. Opens floating panels (Structure Tree, Fonts, Images) per session from session toolbar
8. Exports single-session results via session toolbar, or all results via menu bar "Export All"
9. Uses Window menu to Tile, Cascade, or navigate between open results
10. About and Help dialogs available from the menu bar at any time
11. Closing a results window cleans up its session and floating panels
12. When all results windows are closed, welcome dialog reappears

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

| Criterion | Status |
|---|---|
| Covers 10 of 13 checklist items with automated checks | Done (all 10 automated + 3 manual guidance) |
| Zero false positives on well-formed tagged PDFs | Pending real-world testing |
| Processes a 50-page tagged PDF in under 3 seconds | Pending performance profiling |
| Works offline in practice (static assets, no server calls). Explicit service worker deferred to V1.1 | Done (static build, no server calls) |
| Passes WCAG 2.1 AA itself (the accessibility checker must be accessible) | Partial (skip link, focus styles, ARIA labels, contrast ratios — needs axe-core audit) |

---

## Attribution & Acknowledgments

### Policy

When this project draws on code, patterns, or ideas from other projects, we cite the source clearly. This applies to:

- **Direct code reuse** — the 7 utility modules copied from PDF-A-go-slim should credit that project and note that they in turn depend on work from pdf-lib, fflate, and the broader PDF specification ecosystem.
- **Design inspiration** — if UI patterns, interaction models, or check logic are informed by existing tools (PAC, axesCheck, veraPDF, etc.), say so.
- **Dependencies** — runtime dependencies (pdf-lib, fflate, WinBox, etc.) should be acknowledged with their licenses.
- **Standards and references** — WCAG, PDF/UA, Matterhorn Protocol, and other specifications that inform the audit checks.

### Where attribution appears

| Location | Status |
|---|---|
| **README.md** — "Acknowledgments" section listing key inspirations and dependencies | Done |
| **In-app** — an "About" panel or footer with credits and dependency licenses | Pending |
| **Source code** — file-level provenance comments in modules copied from PDF-A-go-slim | Done |

### Upstream awareness

The utility modules shared with PDF-A-go-slim are not written in a vacuum — they build on capabilities provided by their dependencies. When we adapt or extend these modules, we should remain aware of and credit the upstream chain. For example, `stream-decode.js` wraps fflate's decompression; `unicode-mapper.js` implements logic informed by the Adobe Glyph List specification; `content-stream-parser.js` implements parsing defined by the PDF specification (ISO 32000).

---

## Testing

### Methodology: Test-Driven Development (TDD)

All audit modules and core logic are developed using **strict TDD** — tests are written before implementation code.

#### TDD Workflow

1. **Red** — Write a failing test that defines the expected behavior of the feature or check. For audit modules, this means: create a test PDF fixture (using pdf-lib), call the audit function, and assert the expected `Finding` result (status, summary, details).
2. **Green** — Write the minimum implementation code to make the test pass. No more.
3. **Refactor** — Clean up the implementation while keeping tests green. Extract shared helpers, improve naming, reduce duplication.

#### What Gets Tests First

| Area | Status |
|---|---|
| Every audit check — pass and fail cases | Done (52 tests across 8 test files) |
| Utility functions — `resolveRole()`, `buildRoleMap()`, cycle detection | Done (11 tests in `role-map.test.js`) |
| UI integration — panel creation contracts, render functions, event bus (including scoped session buses), export helpers | Done (67 tests across 6 test files) |
| Worker protocol — message handling | Pending |

#### UI Integration Tests

UI code must have test coverage. The WinBox panel creation, panel render functions, the event bus, and export helpers are all testable without a browser — using `happy-dom` as the Vitest environment.

| Test File | What It Covers | Tests |
|---|---|---|
| `src/ui/app-shell.test.js` | `createPanelElement` returns HTMLElement for 3 floating panel types; element properties; correct render function dispatch | 9 |
| `src/ui/state.test.js` | EventBus on/off/emit, state storage, late subscriber access, reset, unsubscribe; EventBus class export; createSessionBus isolation; destroy method | 16 |
| `src/ui/export.test.js` | `escapeCsvField` quoting/escaping, `buildFilename` generation, `initExport` API shape | 14 |
| `src/ui/report.test.js` | `renderSummaryPanel` status counts, overall badge, metadata rendering, ARIA labels | 9 |
| `src/ui/findings-list.test.js` | Category grouping, status-priority sorting, card rendering, scoped bus click dispatch, keyboard accessibility | 9 |
| `src/ui/details.test.js` | Placeholder state, scoped bus finding rendering, late subscriber, content replacement, semantic sections | 10 |

**Why this matters:** Any code that interfaces with a third-party UI library or renders DOM must have contract tests to catch integration bugs early.

#### TDD Conventions

- Test files live alongside source files: `src/audit/metadata.js` → `src/audit/metadata.test.js` | Done
- Test PDF fixtures are built inline using pdf-lib factory functions (14 factories in `test/fixtures/create-test-pdfs.js`) | Done
- Shared test helper: `test/helpers/context.js` with `buildTestContext()` matching runner.js logic | Done
- UI tests use `// @vitest-environment happy-dom` directive for DOM access | Done
- Each test file runnable in isolation: `npx vitest run src/audit/metadata.test.js` | Done
- Commit tests and implementation together | Done
- Any code interfacing with a third-party UI library must have contract tests verifying the expected API shape | Done

### Framework

**Vitest** — natural fit with Vite. Audit modules are pure functions (PDF buffer in, findings out), ideal for unit tests and TDD. Done.

### Sample PDFs

Bundled sample PDFs serve double duty: test fixtures for development, and a "try it now" feature in the app (users can select a sample PDF from a menu instead of dropping their own). **Pending** — `public/samples/` directory created but not yet populated.

Sources (all CC BY 4.0 or public domain, compatible with this project's license (MIT) with required attribution):

| Source | What | Use |
|---|---|---|
| **veraPDF Corpus** | Pass/fail pairs per Matterhorn Protocol checkpoint | Automated regression tests |
| **PDF/UA Reference Suite 1.1** | 10 well-formed PDF/UA-1 documents | Zero-false-positive verification |
| **PDF Association Techniques** | Atomic pass/fail examples per technique | Unit-testing individual checks |

Cherry-pick a small representative set covering the 10 automated checks. Store in `test/fixtures/` with a manifest describing each file's expected results. The app loads a curated subset from `public/samples/`.

---

## Resolved Questions

1. **Window manager:** Using **WinBox** (0.2.x). Provides floating, movable, resizable windows with minimize/maximize. White theme via built-in theme CSS.
2. **Shared code strategy:** Copy 7 modules from PDF-A-go-slim's `src/engine/utils/` into `src/engine/utils/`. They're self-contained (only depend on pdf-lib + fflate, both already in our stack). Expect divergence — the optimization project and validation project serve different goals. Done — all 7 copied with provenance comments.
3. **PDF.js / visual preview:** Not needed for V1.0 — all checks are structural analysis via pdf-lib, and reading order is presented as a list comparison, not a visual overlay. PDF-A-go-slim embeds PDF-A-go-go (a PDF.js-based viewer) for before/after preview, but that viewer is designed for simple display, not deep integration with audit results. When visual preview is added (V1.1+), build directly on PDF.js rather than wrapping PDF-A-go-go — the level of integration needed (element highlighting, structure tree overlays, linking findings to page locations) would fight against PDF-A-go-go's abstraction layer.
4. **Branding:** Keep "actionable" — it differentiates from "check" (passive) and signals the remediation guidance angle.
5. **Decorative image detection:** V1.0 uses a heuristic (image count vs. figure count). Flag unmatched images as "please verify — may need alt text or artifact marking" (`warning` status). Per-image MCID correlation deferred to V1.1. Done.
6. **Link text quality:** Simple built-in word list: "click here", "here", "read more", "learn more", "link", "this link", "more info", "download". Also flag bare URLs as link text. Done.
7. **Mobile:** Desktop-focused. Dismissible banner on small screens (< 768px): "This tool is designed for larger screens." No mobile-specific layout work. Done.
8. **Dark mode:** Light only for V1.0. Theme CSS structured with CSS custom properties for easy dark mode addition later. Done.
9. **Export:** V1.0 feature, not deferred. Export audit results as JSON, CSV, or a PDF summary report. Done.
10. **Service worker:** Deferred. App works offline in practice (static assets, no server). Explicit service worker in V1.1.
11. **Testing:** TDD with Vitest — 119 tests across 14 test files covering audit checks, RoleMap utilities, and UI integration (panel creation, render functions, scoped event buses, export helpers). Worker protocol tests pending. 14 pdf-lib fixture factories in `test/fixtures/`. Uses `happy-dom` for DOM-based UI tests. Sample PDFs for in-app "try it" feature pending.
12. **Content stream robustness:** Architect the audit layer defensively — graceful fallbacks (warning findings, not crashes) if pdf-lib or stream parsing hits edge cases. Done — each audit module wraps in try/catch, runner catches per-module errors and returns warning findings.
