# PRD: PDF-A-go-actionable

## Product Overview

PDF-A-go-actionable is a free, client-side PDF accessibility checker that runs entirely in the browser. No file uploads, no server processing, no accounts. Drop a PDF and get a clear, actionable accessibility report.

Most free accessibility checkers are either desktop-only (PAC, veraPDF), require uploads to third-party servers (axesCheck, PDFix), or are limited in scope (PDFcheck). PDF-A-go-actionable runs the same checks locally, so no files leave your machine.

### Target Users

- **Document producers** at NGOs, government agencies, and universities who need to validate PDFs before publication
- **Accessibility coordinators** reviewing documents from multiple authors
- **Designers** (InDesign, Word, PowerPoint) who want quick feedback before handing off to an accessibility specialist
- **Anyone** who needs a free alternative to Acrobat Pro's accessibility checker

### Positioning

This is a **validation tool**, not a remediation tool. It tells you exactly what's wrong and what to fix --it does not edit the PDF. Think of it as "PAC in a browser" rather than "Acrobat Pro in a browser."

---

## V1.0 Scope --Practical Accessibility Audit

### Design Philosophy

- **Actionable over exhaustive.** Every check result tells the user what's wrong and what to do about it. No jargon-heavy compliance-speak.
- **Practical over pedantic.** Covers the checks that matter most in real-world accessibility (the 13-point checklist from validation workflows), not the full 300+ PDF/UA machine rules.
- **Client-side only.** All processing happens in the browser via Web Workers. No data leaves the user's machine.
- **Desktop-style UI.** Welcome dialog, progress dialog, results window with floating tool panels. Looks like a workstation app, not a landing page.
- **Test-driven.** Tests are written before implementation. Every audit check has passing and failing test cases defined upfront.
- **Conventional Commits.** All commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, etc.).

### Audit Checks (13-point PDF accessibility checklist)

#### Automated --Pass/Fail

All 10 automated checks are implemented with tests (`src/audit/`). Each resolves custom types through RoleMap.

| # | Check | Detection Method | Status |
|---|---|---|---|
| 1 | Document title is set (not filename) | XMP `dc:title` (pass) or Info dict `/Title` (warning); PDF/UA requires XMP | Done |
| 2 | Document language is specified | Catalog `/Lang` | Done |
| 3 | Security permits accessibility | Encryption dict `/P` permissions bit 5 + bit 10 | Done |
| 4 | PDF is tagged | `/MarkInfo << /Marked true >>` | Done |
| 5 | Structure tree present | Catalog `/StructTreeRoot` | Done |
| 6 | All meaningful images have alt text | `/Figure` StructElems with/without `/Alt` (resolved via RoleMap); generic alt text ("image", "photo", etc.) flagged as warning | Done |
| 7 | Decorative images flagged for review | Images not in structure tree flagged as "please verify --may need alt text or artifact marking" (`warning` status) | Done |
| 8 | Headings use correct hierarchy | H1-H6 StructElems in document order; skip detection (via tree walk) | Done |
| 9 | Tables have proper header cells | `/Table` StructElems with `/TH` children and valid `/Scope` value (Row/Column/Both); resolved via RoleMap | Done |
| 10 | Lists are properly tagged | `/L` > `/LI` > `/Lbl` + `/LBody` structure (both required per PDF/UA 7.6); resolved via RoleMap | Done |

#### Automated --Informational

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
| Link text quality | `/Link` StructElem text content; flag generic ("click here", "here", "read more", "learn more", "link", "this link", "more info", "download", "more"), bare URLs (http/https/ftp), and links with no text | Done |
| Structure tree summary | Element count, types, max depth | Done |
| Per-element language | `/Lang` on individual StructElems | Done |

#### Manual Review Required (flagged with guidance)

All three manual-review items return `manual` status findings with actionable guidance and tool links.

| # | Check | What We Provide | Status |
|---|---|---|---|
| 11 | Reading order is logical | Guidance to use the Structure Tree panel to review element order; remediation instructions for authoring tools | Done (guidance only --automated order-vs-position comparison is deferred) |
| 12 | PAC reports no errors | Link to PAC download + online alternatives | Done |
| 13 | Logical reading order confirmed by ear | Link to NVDA download; VoiceOver instructions; testing guidance | Done |

### Report Output

The audit produces a structured report with:

1. **Report Dashboard** --initial view after analysis: verdict banner (PASS/FAIL/PASS WITH WARNINGS), document properties metadata grid with warning indicators for missing accessibility fields, findings grouped by status (fail/warning as full rows, manual review as compact cards, pass/N/A as chips), and action buttons (Download Report, View Advanced Report, Preview PDF, Upload Another PDF) | Done
2. **Summary score** --pass/fail/warning/manual/not-applicable counts with traffic-light status icons | Done
3. **Per-check detail** --pass/fail/warning/manual-check status, explanation, remediation guidance | Done
4. **Structure tree explorer** --interactive ARIA tree view (expand/collapse, keyboard nav, search/filter, RoleMap annotations, alt/lang badges); falls back to findings-based summary for untagged PDFs | Done
5. **Font inventory** --all fonts with ToUnicode and embedding status | Done
6. **Image inventory** --all images with alt text status | Done
7. **Export** --download results as JSON, CSV, or a PDF summary report (all three formats implemented) | Done

### Remaining V1.0 Work

- ~~**Per-element language check** --informational check for `/Lang` on individual StructElems~~ --Done (warning when no StructElems specify `/Lang`, pass with per-language breakdown)
- ~~**Interactive structure tree** --full tree rendering with lazy expansion~~ --Done (ARIA tree view with expand/collapse, keyboard nav, search/filter, batch rendering)
- ~~**Sample PDFs** --bundled samples in `public/samples/` for "try it now"~~ --Done (2 samples: `sample-accessible.pdf` + `sample-issues.pdf`; loaded from Samples menu in-app)
- ~~**In-app About/Credits panel**~~ --Done (About dialog in menu bar)
- ~~**Reading order visualization** --visual overlay showing content stream reading order on rendered pages~~ --Done (PDF Preview panel with numbered circle badges and connecting dashed lines; toggle from session toolbar)
- ~~**Worker protocol tests** --test coverage for worker message handling~~ --Done (6 tests)
- ~~**Real-world PDF testing** --test with PDFs from Word, InDesign, PptxGenJS, etc.~~ --Done (12 integration tests against veraPDF corpus)
- ~~**Title check: XMP vs Info dict**~~ --Done. Three-level check: pass (XMP dc:title), warning (Info dict only), fail (none).
- ~~**Split font finding into two**~~ --Done. `font-tounicode` (7.21.3) for CMap coverage, `font-embedding` (7.21.4) for embedding status.
- **Tagging check granularity** --our `tagged-pdf` check looks at `MarkInfo/Marked` broadly. veraPDF tests more granular clauses (e.g., StructTreeRoot presence, role mapping completeness). Consider splitting into sub-checks.
- **Corruption tolerance** --pdf-lib loads mildly corrupted PDFs (e.g., 1 byte missing) without error. Consider adding a post-load integrity check or noting when the trailer/xref is damaged.

### V1.1 --Extended Capabilities (future)

See `FUTURE-IDEAS.md` for the full deferred feature list. Key items:

- **EARL (Evaluation and Report Language)** --W3C standard for accessibility evaluation results
- **CI/CD integration** --CLI mode or API endpoint for automated pipelines
- **Batch processing** --multiple PDFs, aggregate reporting
- **veraPDF rule mapping** --map findings to veraPDF rule IDs for interoperability
- **Dark mode** --WinBox theme variant
- **Per-image decorative detection** --MCID-to-content-stream correlation for exact identification

---

## Technical Architecture

### Stack

- **Vite** --build tool (same as PDF-A-go-slim) | Done
- **pdf-lib** --low-level PDF object access (proven in PDF-A-go-slim) | Done
- **fflate** --stream decompression for content stream parsing | Done
- **WinBox** --floating window management (movable, resizable windows) | Done
- **pdfjs-dist** --PDF page rendering for the PDF Preview panel (lazy-loaded) | Done
- **Web Workers** --off-main-thread PDF parsing and auditing | Done
- **Vanilla JS** --no framework | Done

### Shared Code from PDF-A-go-slim

5 modules copied to `src/engine/utils/` with provenance comments. Done. (`pdf-traversal.js` and `hash.js` were originally copied but removed as unused dead code.)

| Module | Purpose | Status |
|---|---|---|
| `accessibility-detect.js` | Core trait detection + existing audits | Done |
| `content-stream-parser.js` | Extract char codes per font from content streams | Done |
| `unicode-mapper.js` | Map char codes to Unicode codepoints | Done |
| `glyph-list.js` | Adobe Glyph List + encoding tables | Done |
| `stream-decode.js` | Decoders: Flate, LZW, ASCII85, ASCIIHex, RunLength | Done |

### New Code

All source files created. Done.

```
src/
  main.js              --entry point, worker creation, app shell init
  worker.js            --Web Worker: loads PDF, runs audit, posts results with sessionId
  audit/
    runner.js           --orchestrates all audit modules, collects findings
    metadata.js         --title, lang, security, displayDocTitle, bookmarks
    structure.js        --tagged check, structure tree walk, heading hierarchy
    images.js           --alt text coverage, decorative image detection
    tables.js           --TH/TD validation, scope
    lists.js            --L/LI/Lbl/LBody structure validation
    fonts.js            --ToUnicode coverage, embedding status
    forms.js            --field labels, tab order
    links.js            --link text quality analysis
    reading-order.js    --manual review guidance (PAC, NVDA, reading order)
  ui/
    app-shell.js        --high-level orchestration: session lifecycle, file handling, worker routing, welcome/progress/results dialogs, floating panel toggle
    menu-bar.js         --menu bar DOM creation, SubmenuController class, keyboard navigation (ARIA menubar), submenu builders. Exports MENUBAR_HEIGHT
    window-manager.js   --tileWindows(), cascadeWindows(), closeAllWindows(), focusWindow(), getFloatingLayout(). Exports CASCADE_OFFSET
    dialogs.js          --showAboutDialog(), showHelpDialog(), showBookmarkPlaceholder()
    state.js            --EventBus class, createSessionBus() for per-session isolation
    drop-zone.js        --reusable multi-file upload component (drag-and-drop + browse)
    report.js           --summary score, metadata, status counts
    findings-list.js    --grouped/sorted finding cards
    details.js          --selected finding detail + remediation
    tree-explorer.js    --interactive structure tree (ARIA tree view) with fallback summary
    font-table.js       --font inventory table
    image-table.js      --image inventory table
    guidance.js         --remediation text templates and external links
    pdf-preview.js      --PDF page rendering with zoom, page nav, MCID highlighting, reading order overlay (lazy-loads pdfjs-dist)
    dashboard.js        --Report Dashboard: verdict banner, metadata grid, status-grouped findings, action buttons
    constants.js        --shared STATUS_GROUPS constant and helpers (groupFindings, computeVerdict) used by dashboard and export
    export.js           --JSON, CSV, and PDF report generation
  engine/utils/
    resolve.js          --PDFRef resolution helper (new)
    role-map.js         --RoleMap resolution for structure elements (new)
    struct-tree-walker.js --depth-first tree walk with safety caps (new)
    serialize-tree.js   --serializable hierarchical tree for postMessage transfer (new)
    accessibility-detect.js --(from PDF-A-go-slim)
    content-stream-parser.js --(from PDF-A-go-slim)
    unicode-mapper.js   --(from PDF-A-go-slim)
    glyph-list.js       --(from PDF-A-go-slim)
    stream-decode.js    --(from PDF-A-go-slim)
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

Used for both the UI rendering (V1.0) and machine-readable export (V1.1).

### Worker Protocol

Implemented in `src/worker.js`. Done.

Inbound:
```js
{ type: 'audit', buffer: ArrayBuffer, fileName: string, sessionId: string }
```

Outbound (all include `sessionId` for routing to the correct session):
```js
{ type: 'progress', sessionId, phase: 'structure', percent: 40 }
{ type: 'result', sessionId, findings: Finding[], meta: { pageCount, fileSize, author, subject, keywords, creator, producer, ... }, structureTree: { root, totalCount, truncated } | null }
{ type: 'error', sessionId, message: string }
```

---

## UI / UX

### Layout

Desktop-style layout using WinBox (floating, movable, resizable windows) with a persistent application menu bar. Supports multiple PDFs --each gets its own results window. Done.

- **App menu bar** --persistent fixed bar at top of viewport; contains Open File(s), Export All (format submenu), Window (Tile All/Cascade All/Close All + open window list), About, Help | Done
- **Welcome dialog** --centered window with app info, feature highlights, and multi-file upload zone; reopened by "Open File(s)" menu (with close button when results exist); reappears when all results windows are closed | Done
- **Progress dialog** --per-session centered window with file name, progress bar, and phase info | Done
- **Results windows** --one per analyzed PDF, cascade-positioned (~85% of viewport); contains summary bar (top), session toolbar (floating panel toggles + per-file export), and split findings/details view; movable and resizable | Done
- **Floating tool panels** --Structure Tree, Font Inventory, Image Inventory, PDF Preview per session; opened from session toolbar buttons; movable, resizable, closeable | Done
- **About dialog** --app info, version, technology credits | Done
- **Help dialog** --usage steps, tips, keyboard shortcuts | Done

All WinBox windows are constrained below the menu bar height (28px) for drag and maximize. Draggable windows use `overflow: true` for partial off-screen movement (native OS-like behavior); non-draggable windows (welcome, progress) stay centered. Each results window shows summary + findings list (left 35%) + finding details (right 65%). Finding selection is scoped per session via `EventBus` instances --selecting a finding in one window doesn't affect another. Floating panels open per session and can be repositioned. Closing all results windows returns to the welcome dialog.

### Visual Design

- **NeXTSTEP-inspired theme.** Slate gray workspace (#838990), dark charcoal title bars (#333) with white text, square corners, 3D beveled edges on windows/buttons/panels/cards. The WinBox `white` theme base is overridden with `!important` where needed. | Done
- Status indicators (green pass, red fail, amber warning, blue manual-check) --not color-only, includes text labels. Beveled badge styling. | Done
- Professional typography --system font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto) | Done
- **Dark menu bar** (28px height) matching title bars. White text, hover highlight. Submenus use NeXTSTEP-style white-on-dark hover inversion. | Done
- **WinBox theme** --`white` class with extensive CSS overrides: dark title bars, square beveled window controls, hard drop shadows, focus/unfocus distinction via title bar color, partial off-screen dragging (`overflow: true`). Root container has no `overflow: hidden` so windows can extend beyond viewport edges. | Done
- **Desktop-focused.** On small screens (< 768px), show a dismissible banner: "This tool is designed for larger screens." No mobile-specific layout --users aren't blocked, just informed. | Done
- **Skip link** for keyboard navigation. Focus-visible outlines. ARIA labels on interactive regions. ARIA menubar with roving tabindex and arrow-key navigation. Focus management on dialog open/close. aria-live region for error announcements. Color contrast verified (4.5:1+ on all text). | Done

### Interaction Flow

All steps implemented. Done.

1. App menu bar is always visible at the top of the viewport
2. Welcome dialog opens with app info and multi-file upload zone
3. User drops PDFs or uses menu bar "Open File(s)" to reopen the welcome dialog (closable when results exist)
4. Per-file progress dialogs show analysis progress with phase info
5. Each analyzed PDF spawns its own cascade-positioned results window
6. User explores findings in any window; finding selection is scoped per session
7. Opens floating panels (Structure Tree, Fonts, Images, PDF Preview) per session from session toolbar
7a. In PDF Preview: navigates pages, zooms (50%-300% + fit-to-width), toggles reading order visualization (numbered badges with connecting lines showing content stream order), and clicks structure tree nodes to highlight corresponding MCID regions on the rendered page
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
| Zero false positives on well-formed tagged PDFs | Done (12 real-world PDF audits from veraPDF corpus pass without false positives; 2 bundled sample PDFs verified) |
| Processes a 50-page tagged PDF in under 3 seconds | Pending performance profiling |
| Works offline in practice (static assets, no server calls). Explicit service worker deferred to V1.1 | Done (static build, no server calls) |
| Passes WCAG 2.1 AA itself (the accessibility checker must be accessible) | Done (contrast ratios verified, ARIA menubar keyboard nav, roving tabindex, focus management on dialogs, aria-live error region). Full arrow-key menu nav and focus trapping remain for V1.1 |

---

## Attribution & Acknowledgments

### Policy

When this project draws on code, patterns, or ideas from other projects, we cite the source clearly. This applies to:

- **Direct code reuse** -- the 5 utility modules copied from PDF-A-go-slim credit that project and note upstream dependencies (pdf-lib, fflate, PDF spec).
- **Design inspiration** -- UI patterns and check logic informed by existing tools (PAC, axesCheck, veraPDF, etc.) are noted.
- **Dependencies** -- runtime dependencies (pdf-lib, fflate, WinBox, etc.) are acknowledged with their licenses.
- **Standards** -- WCAG, PDF/UA, Matterhorn Protocol, and other specs that inform the audit checks.

### Where attribution appears

| Location | Status |
|---|---|
| **README.md** --"Acknowledgments" section listing key inspirations and dependencies | Done |
| **In-app** --an "About" dialog in menu bar with version info, credits, and dependency licenses (pdf-lib, fflate, WinBox) | Done |
| **Source code** --file-level provenance comments in modules copied from PDF-A-go-slim | Done |

### Upstream awareness

The utility modules shared with PDF-A-go-slim build on their dependencies. When we adapt or extend these modules, we should credit the upstream chain. `stream-decode.js` wraps fflate's decompression; `unicode-mapper.js` uses the Adobe Glyph List specification; `content-stream-parser.js` implements parsing from the PDF specification (ISO 32000).

---

## Testing

### Methodology: Test-Driven Development (TDD)

All audit modules and core logic are developed using **strict TDD** --tests are written before implementation code.

#### TDD Workflow

1. **Red** --Write a failing test that defines the expected behavior of the feature or check. For audit modules, this means: create a test PDF fixture (using pdf-lib), call the audit function, and assert the expected `Finding` result (status, summary, details).
2. **Green** --Write the minimum implementation code to make the test pass. No more.
3. **Refactor** --Clean up the implementation while keeping tests green. Extract shared helpers, improve naming, reduce duplication.

#### What Gets Tests First

| Area | Status |
|---|---|
| Every audit check --pass and fail cases | Done (117 tests across 10 test files) |
| Utility functions --`resolveRole()`, `buildRoleMap()`, cycle detection, `resolve()`, accessibility detection, struct-tree walker, serialize-tree, stream decode, content-stream-parser | Done (80 tests across 7 test files) |
| UI integration --panel creation contracts, render functions, event bus (including scoped session buses), dashboard, export helpers | Done (210 tests across 13 test files) |
| Worker protocol --message handling | Done (6 tests in `src/worker.test.js`) |

#### UI Integration Tests

UI code must have test coverage. The WinBox panel creation, panel render functions, the event bus, and export helpers are all testable without a browser --using `happy-dom` as the Vitest environment.

| Test File | What It Covers | Tests |
|---|---|---|
| `src/ui/app-shell.test.js` | `createPanelElement` returns HTMLElement for 3 floating panel types; element properties; correct render function dispatch | 9 |
| `src/ui/menu-bar.test.js` | Menu bar creation, ARIA attributes, keyboard nav, submenu builders, SubmenuController open/close/toggle | 50 |
| `src/ui/window-manager.test.js` | Tile, cascade, close, focus, getFloatingLayout, CASCADE_OFFSET | 16 |
| `src/ui/dialogs.test.js` | About, Help, Bookmark placeholder dialog creation and callbacks | 9 |
| `src/ui/state.test.js` | EventBus on/off/emit, state storage, late subscriber access, reset, unsubscribe; EventBus class export; createSessionBus isolation; destroy method | 16 |
| `src/ui/export.test.js` | `escapeCsvField` quoting/escaping, `buildFilename` generation, `initExport` API shape | 14 |
| `src/ui/report.test.js` | `renderSummaryPanel` status counts, overall badge, metadata rendering, ARIA labels | 9 |
| `src/ui/findings-list.test.js` | Category grouping, status-priority sorting, card rendering, scoped bus click dispatch, keyboard accessibility | 9 |
| `src/ui/details.test.js` | Placeholder state, scoped bus finding rendering, late subscriber, content replacement, semantic sections, WCAG slug mapping | 11 |
| `src/ui/tree-explorer.test.js` | Interactive ARIA tree rendering, expand/collapse, keyboard nav, type badges, RoleMap annotation, alt/lang display, filter, truncation warning; fallback summary view | 30 |
| `src/ui/font-table.test.js` | Font inventory table rendering, ToUnicode/embedding status, sorting, empty state | 14 |
| `src/ui/image-table.test.js` | Image inventory table rendering, alt text status, sorting, empty state | 13 |
| `src/ui/drop-zone.test.js` | Upload zone creation, drag-and-drop events, file filtering, multi-file handling | 13 |
| `src/ui/guidance.test.js` | Remediation text templates, external tool links, WCAG/PDF-UA references | 11 |
| `src/ui/dashboard.test.js` | Report Dashboard verdict banner, status groups, document metadata, file facts, action buttons, export menu, keyboard nav, edge states | 42 |
| `src/ui/dev-test-pdfs.test.js` | Test PDF registry, category grouping, URL validation, expected outcomes | 8 |

Any code that interfaces with a third-party UI library or renders DOM has contract tests to catch integration bugs early.

#### TDD Conventions

- Test files live alongside source files: `src/audit/metadata.js` → `src/audit/metadata.test.js` | Done
- Test PDF fixtures are built inline using pdf-lib factory functions (22 factories in `test/fixtures/create-test-pdfs.js`) | Done
- Shared test helper: `test/helpers/context.js` with `buildTestContext()` matching runner.js logic | Done
- UI tests use `// @vitest-environment happy-dom` directive for DOM access | Done
- Each test file runnable in isolation: `npx vitest run src/audit/metadata.test.js` | Done
- Commit tests and implementation together | Done
- Any code interfacing with a third-party UI library must have contract tests verifying the expected API shape | Done

### Framework

**Vitest** with Vite. Audit modules are pure functions (PDF buffer in, findings out), good fit for unit tests and TDD. Done.

### Sample PDFs

Bundled sample PDFs serve double duty: test fixtures for development, and a "try it now" feature in the app (users can select a sample PDF from a menu instead of dropping their own). Two sample PDFs bundled in `public/samples/`: `sample-accessible.pdf` (well-tagged, all checks pass) and `sample-issues.pdf` (missing tags/alt text, multiple failures). Additional samples from veraPDF corpus available via the Advanced menu at runtime.

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
2. **Shared code strategy:** Copy modules from PDF-A-go-slim's `src/engine/utils/` into `src/engine/utils/`. They're self-contained (only depend on pdf-lib + fflate, both already in our stack). Expect divergence --the optimization project and validation project serve different goals. Done --5 modules copied with provenance comments (originally 7; `pdf-traversal.js` and `hash.js` removed as unused dead code).
3. **PDF.js / visual preview:** Implemented as the PDF Preview floating panel using pdfjs-dist (lazy-loaded). Built directly on PDF.js rather than wrapping PDF-A-go-go, as predicted --the deep integration (MCID region highlighting, structure tree node selection, reading order overlay) requires direct access to PDF.js text content and marked content APIs. The `serialize-tree.js` TreeNodes now carry `mcids: [{mcid, pageIndex}]` and `pageIndex` for mapping structure elements to visual regions. Clicking a tree node emits `selectTreeNode` on the session bus, and the preview navigates to the correct page and highlights the MCID regions.
4. **Branding:** Keep "actionable" --it differentiates from "check" (passive) and signals the remediation guidance angle.
5. **Decorative image detection:** V1.0 uses a heuristic (image count vs. figure count). Flag unmatched images as "please verify --may need alt text or artifact marking" (`warning` status). Per-image MCID correlation deferred to V1.1. Done.
6. **Link text quality:** Simple built-in word list: "click here", "here", "read more", "learn more", "link", "this link", "more info", "download", "more". Also flag bare URLs (http, https, ftp) and links with no accessible text. Done.
7. **Mobile:** Desktop-focused. Dismissible banner on small screens (< 768px): "This tool is designed for larger screens." No mobile-specific layout work. Done.
8. **Dark mode:** Light only for V1.0. Theme CSS structured with CSS custom properties for easy dark mode addition later. Done.
9. **Export:** V1.0 feature, not deferred. Export audit results as JSON, CSV, or a PDF summary report. Done.
10. **Service worker:** Deferred. App works offline in practice (static assets, no server). Explicit service worker in V1.1.
11. **Testing:** TDD with Vitest --654 tests across 40 test files covering audit checks, engine utilities (resolve, accessibility detection, struct-tree walker, serialize-tree, stream decode, content-stream-parser, unicode-mapper, RoleMap), UI integration (panel creation, menu bar, window manager, dialogs, render functions, interactive tree, dashboard, scoped event buses, export helpers), and worker protocol. 22 pdf-lib fixture factories in `test/fixtures/`. Uses `happy-dom` for DOM-based UI tests. Two sample PDFs bundled in `public/samples/`.
12. **Content stream robustness:** Architect the audit layer defensively --graceful fallbacks (warning findings, not crashes) if pdf-lib or stream parsing hits edge cases. Done --each audit module wraps in try/catch, runner catches per-module errors and returns warning findings.
