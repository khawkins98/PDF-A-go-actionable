# PDF-A-go-actionable

A free, client-side PDF accessibility checker focused on practical impact. Drop a PDF, get an actionable report with fix-it guidance. No uploads, no accounts, no cost.

> **Note:** This is a practical accessibility checker, not a PDF/UA conformance validator. It focuses on the checks that deliver the most real-world accessibility value — the subset that makes PDFs genuinely usable by people and assistive technology. For full PDF/UA-1 validation (300+ rules), use [PAC](https://pac.pdf-accessibility.org/) or [veraPDF](https://verapdf.org/). See [LICENSE](LICENSE) for warranty terms.

## Why This Approach

Full PDF/UA conformance has over 300 rules, many of which are technical metadata requirements that don't directly affect whether a person can actually use the document. For most publishers — government agencies, NGOs, universities — trying to pass every rule is unrealistic and can distract from the changes that actually matter.

This tool focuses on the sweet spot: the ~13 checks that accessibility professionals consistently identify as highest-impact. These are the things that determine whether a screen reader user can navigate your document, whether text can be searched and copied, whether images have descriptions, and whether the reading order makes sense. Getting these right covers the vast majority of real-world accessibility needs.

Existing tools have tradeoffs:

- **Adobe Acrobat Pro** -- thorough but expensive ($240/year) and proprietary
- **PAC (PDF Accessibility Checker)** -- free and comprehensive, but Windows-only
- **axesCheck** -- web-based, but uploads files to a third party
- **PDFcheck** -- client-side, but limited to basic metadata checks

PDF-A-go-actionable is a browser-based audit that processes everything locally. Your PDFs never leave your machine.

## What It Checks

The tool covers the practical validation workflow used by accessibility professionals — the checks with the highest effort-to-impact ratio:

**Automated checks:**
- Document title, language, and security permissions
- Tagged PDF with structure tree
- Image alt text coverage
- Heading hierarchy (H1 > H2 > H3, no skips; generic /H supported)
- Table header cells and scope
- List structure (L > LI > Lbl + LBody)
- Font Unicode mapping (ToUnicode CMap coverage; standard 14 fonts exempt)
- Font embedding (including CIDFont composites via DescendantFonts)
- Bookmark/outline presence
- Form field labeling (including nested fields via /Kids traversal)
- Link text quality (with recursive child text extraction)
- Tab order configuration
- BCP-47 language tag validation (document-level and per-element)

**Visual tools:**
- PDF Preview panel with page navigation and zoom (50%-300% + fit-to-width)
- Reading order visualization -- numbered badges with connecting lines showing content stream order
- Structure tree to preview linking -- click a tree node to highlight its MCID regions on the rendered page

**Report dashboard:**
- At-a-glance verdict: PASS / PASS WITH WARNINGS / FAIL
- UNDRR 13-point validation checklist with expandable "Why This Matters" guidance and authoring tips
- Page numbers in finding details where available
- Remediation hints inline on fail/warning findings
- Clear error messages for non-PDF files, encrypted PDFs, and corrupt files

**Flagged for manual review:**
- Color contrast (WCAG 1.4.3)
- Reading order (with interactive structure tree explorer and visual reading order overlay to help)
- Screen reader testing (with tool recommendations)

## Related Projects

PDF-A-go-actionable is part of a family of client-side PDF tools:

- **[PDF-A-go-go](https://github.com/khawkins98/PDF-A-go-go)** -- a lightweight, embeddable PDF viewer for web pages. Built on PDF.js (pdfjs-dist). PDF-A-go-go was the first project; building a showcase PDF for it revealed font embedding bloat, which led to creating PDF-A-go-slim. Both projects run entirely in the browser with no framework, but use different PDF libraries (PDF.js for rendering vs. pdf-lib for structural access).

- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim)** -- a browser-based PDF optimizer that reduces file size. Built on pdf-lib and fflate. PDF-A-go-actionable shares its tech stack and reuses several utility modules from PDF-A-go-slim (stream decoding, content stream parsing, structure tree traversal, accessibility detection). PDF-A-go-slim's `docs/learnings.md` also informed this project's design.

**PDF-A-go-go** renders PDFs, **PDF-A-go-slim** optimizes them, **PDF-A-go-actionable** validates their accessibility.

## Visual Design

The UI borrows from NeXTSTEP: dark charcoal title bars, a slate gray workspace, square corners, and 3D beveled edges. Windows minimize to compact square tiles at the bottom of the screen. It looks more like a 1990s workstation than a web app, and that's intentional.

Built on [WinBox](https://github.com/nextapps-de/winbox) with CSS overrides for the NeXTSTEP look. Multiple results windows can be opened, dragged, minimized, tiled, and cascaded.

## Development

### Conventions

- **TDD** --tests are written before implementation
- **[Conventional Commits](https://www.conventionalcommits.org/)** --all commit messages use prefixes like `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

### Advanced Menu --Test PDFs

The **Advanced** menu in the menu bar provides one-click loading of curated test PDFs covering known pass/fail scenarios for each audit category (metadata, structure, headings, images, tables, lists, fonts, security, edge cases). Useful for verifying audit behavior against known-good and known-bad documents.

Test PDFs are sourced from:
- **[veraPDF PDF/UA-1 test corpus](https://github.com/veraPDF/veraPDF-corpus)** --atomic pass/fail files for specific PDF/UA clauses
- **[PDF Association "Techniques for Accessible PDF"](https://github.com/pdf-association/techniques-for-accessible-pdf)** --real-world scenario files
- **[OpenPreserve "Cabinet of Horrors"](https://github.com/openpreserve/format-corpus)** --edge cases (encryption, corruption, missing fonts)

All files are fetched via `cdn.jsdelivr.net` at runtime (CORS-friendly, no local fixtures needed).

## Approach

This tool is deliberately **practical over exhaustive**:

- **Impact-focused** -- checks the ~13 things that most affect real-world usability, not 300+ conformance rules
- **Actionable** -- every finding tells you what's wrong and how to fix it, with tool-specific remediation steps
- **Validation only** -- identifies issues but doesn't edit PDFs (use your authoring tool or Acrobat for fixes)
- **Client-side only** -- no server, no uploads, no accounts
- **Not a PDF/UA conformance validator** -- for full standard compliance, use PAC or veraPDF alongside this tool

## Status

V1.3.0. See [CHANGELOG.md](CHANGELOG.md) for release history.

## Acknowledgments

This project builds on the work of many others:

**Libraries (bundled in production build):**
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** by Andrew Dillon (MIT) -- low-level PDF object access that makes client-side PDF analysis possible
- **[fflate](https://github.com/101arrowz/fflate)** by 101arrowz (MIT) -- fast compression/decompression for PDF stream decoding
- **[pdfjs-dist](https://github.com/nicolo-ribaudo/pdfjs-dist)** ([PDF.js](https://mozilla.github.io/pdf.js/)) by Mozilla (Apache-2.0) -- PDF page rendering for the PDF Preview panel
- **[WinBox](https://github.com/nextapps-de/winbox)** by Nextapps GmbH (Apache-2.0) -- lightweight window manager for the floating panel system

**Sibling projects:**
- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim)** (MIT) -- sibling project whose utility modules (stream decoding, content stream parsing, unicode mapping, accessibility detection) are reused by this tool's PDF engine
- **[PDF-A-go-go](https://github.com/khawkins98/PDF-A-go-go)** (MIT) -- the first project in this family; building it revealed the PDF accessibility problems this tool checks for

**Reference tools and standards:**
- **[PAC (PDF Accessibility Checker)](https://pac.pdf-accessibility.org/)** by the PDF/UA Foundation -- the most thorough free PDF/UA conformance validator; use alongside this tool when full standard compliance is needed
- **[veraPDF](https://verapdf.org/)** -- open-source PDF/A and PDF/UA validator. The [veraPDF PDF/UA-1 test corpus](https://github.com/veraPDF/veraPDF-corpus) (CC BY 4.0 / GPLv3+) provides atomic pass/fail test files used in the Advanced menu
- **[PDF Association](https://pdfa.org/)** -- the ["Techniques for Accessible PDF"](https://github.com/pdf-association/techniques-for-accessible-pdf) repository (CC BY 4.0) provides real-world accessible/inaccessible PDF examples used in the Advanced menu
- **[Open Preservation Foundation](https://openpreservation.org/)** -- the ["Cabinet of Horrors" format corpus](https://github.com/openpreserve/format-corpus) (CC0 1.0) provides edge-case test PDFs (encryption, corruption, font embedding) used in the Advanced menu
- **WCAG**, **PDF/UA (ISO 14289)**, and the **Matterhorn Protocol** -- the standards that define what accessible PDFs look like

**Dev tooling:**
- **[Vite](https://vite.dev/)** (MIT) -- build tool
- **[Vitest](https://vitest.dev/)** (MIT) -- test framework
- **[happy-dom](https://github.com/nicolo-ribaudo/happy-dom)** (MIT) -- DOM implementation for UI tests

## License

[MIT](LICENSE)
