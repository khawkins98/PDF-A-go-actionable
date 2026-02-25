# PDF-A-go-actionable

A free, client-side PDF accessibility checker. Drop a PDF, get an actionable report. No uploads, no accounts, no cost.

## Background

Checking PDF accessibility shouldn't require a $240/year Adobe subscription or a Windows-only desktop tool. Most organizations producing PDFs -- government agencies, NGOs, universities -- need to validate accessibility before publication, but the existing tools have tradeoffs:

- **Adobe Acrobat Pro** -- thorough but expensive and proprietary
- **PAC (PDF Accessibility Checker)** -- free and thorough, but Windows-only
- **axesCheck** -- web-based, but uploads files to a third party
- **PDFcheck** -- client-side, but limited to basic metadata checks

PDF-A-go-actionable is a browser-based accessibility audit that processes everything locally. Your PDFs never leave your machine.

## What It Checks

The tool covers the practical validation workflow used by accessibility professionals (the "13-point checklist"):

**Automated checks:**
- Document title, language, and security permissions
- Tagged PDF with structure tree
- Image alt text coverage
- Heading hierarchy (H1 > H2 > H3, no skips)
- Table header cells and scope
- List structure (L > LI > Lbl + LBody)
- Font Unicode mapping (ToUnicode CMap coverage)
- Bookmark/outline presence
- Form field labeling
- Link text quality
- Tab order configuration

**Visual tools:**
- PDF Preview panel with page navigation and zoom (50%-300% + fit-to-width)
- Reading order visualization -- numbered badges with connecting lines showing content stream order
- Structure tree to preview linking -- click a tree node to highlight its MCID regions on the rendered page

**Flagged for manual review:**
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

- **TDD** --tests are written before implementation (see PRD.md for details)
- **[Conventional Commits](https://www.conventionalcommits.org/)** --all commit messages use prefixes like `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

### Advanced Menu --Test PDFs

The **Advanced** menu in the menu bar provides one-click loading of curated test PDFs covering known pass/fail scenarios for each audit category (metadata, structure, headings, images, tables, lists, fonts, security, edge cases). Useful for verifying audit behavior against known-good and known-bad documents.

Test PDFs are sourced from:
- **[veraPDF PDF/UA-1 test corpus](https://github.com/veraPDF/veraPDF-corpus)** --atomic pass/fail files for specific PDF/UA clauses
- **[PDF Association "Techniques for Accessible PDF"](https://github.com/pdf-association/techniques-for-accessible-pdf)** --real-world scenario files
- **[OpenPreserve "Cabinet of Horrors"](https://github.com/openpreserve/format-corpus)** --edge cases (encryption, corruption, missing fonts)

All files are fetched via `cdn.jsdelivr.net` at runtime (CORS-friendly, no local fixtures needed).

## Status

In development. See [PRD.md](PRD.md) for the full product requirements.

## Acknowledgments

This project builds on the work of many others:

- **[pdf-lib](https://github.com/Hopding/pdf-lib)** by Andrew Dillon -- low-level PDF object access that makes client-side PDF analysis possible
- **[fflate](https://github.com/101arrowz/fflate)** by 101arrowz -- fast compression/decompression for PDF stream decoding
- **[WinBox](https://github.com/nextapps-de/winbox)** by Nextapps GmbH -- lightweight window manager for the floating panel system
- **[pdfjs-dist](https://github.com/nicolo-ribaudo/pdfjs-dist)** ([PDF.js](https://mozilla.github.io/pdf.js/)) by Mozilla -- PDF page rendering for the PDF Preview panel
- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim)** -- sibling project whose utility modules (stream decoding, content stream parsing, structure tree traversal, accessibility detection) are reused by this tool's PDF engine
- **[PDF-A-go-go](https://github.com/khawkins98/PDF-A-go-go)** -- the first project in this family; building it revealed the PDF accessibility problems this tool checks for
- **[PAC (PDF Accessibility Checker)](https://pac.pdf-accessibility.org/)** by the PDF/UA Foundation -- the most thorough free PDF/UA validator, and the main reference for this tool's check list
- **[veraPDF](https://verapdf.org/)** -- open-source PDF/A and PDF/UA validator. The [veraPDF PDF/UA-1 test corpus](https://github.com/veraPDF/veraPDF-corpus) (CC BY 4.0 / GPLv3+) provides atomic pass/fail test files used in the Advanced menu.
- **[PDF Association](https://pdfa.org/)** -- the ["Techniques for Accessible PDF"](https://github.com/pdf-association/techniques-for-accessible-pdf) repository (CC BY 4.0) provides real-world accessible/inaccessible PDF examples used in the Advanced menu
- **[Open Preservation Foundation](https://openpreservation.org/)** -- the ["Cabinet of Horrors" format corpus](https://github.com/openpreserve/format-corpus) (CC0 1.0) provides edge-case test PDFs (encryption, corruption, font embedding) used in the Advanced menu
- **WCAG**, **PDF/UA (ISO 14289)**, and the **Matterhorn Protocol** -- the standards that define what accessible PDFs look like

## License

MIT
