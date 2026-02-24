# PDF-A-go-actionable

A free, client-side PDF accessibility checker. Drop a PDF, get an actionable report. No uploads, no accounts, no cost.

## Background

Checking PDF accessibility shouldn't require a $240/year Adobe subscription or a Windows-only desktop tool. Most organizations producing PDFs -- government agencies, NGOs, universities -- need to validate accessibility before publication, but the tooling landscape has real gaps:

- **Adobe Acrobat Pro** -- comprehensive but expensive and proprietary
- **PAC (PDF Accessibility Checker)** -- excellent and free, but Windows-only
- **axesCheck** -- web-based, but uploads files to a third party
- **PDFcheck** -- client-side, but limited to basic metadata checks

PDF-A-go-actionable fills the gap: a comprehensive, browser-based accessibility audit that processes everything locally. Your PDFs never leave your machine.

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

**Flagged for manual review:**
- Reading order (with structure tree visualization to help)
- Screen reader testing (with tool recommendations)

## Related Projects

PDF-A-go-actionable is part of a family of client-side PDF tools:

- **[PDF-A-go-go](https://github.com/khawkins98/PDF-A-go-go)** — a lightweight, embeddable PDF viewer for web pages. Built on PDF.js (pdfjs-dist). PDF-A-go-go was the origin project — while building a showcase PDF for it, font embedding bloat was discovered, which motivated creating PDF-A-go-slim. The two projects share the "no server, no framework, pure browser" philosophy but use different PDF libraries (PDF.js for rendering vs. pdf-lib for structural access).

- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim)** — a browser-based PDF optimizer that reduces file size. Built on pdf-lib and fflate. PDF-A-go-actionable shares its tech stack and reuses several utility modules from PDF-A-go-slim (stream decoding, content stream parsing, structure tree traversal, accessibility detection). The extensive PDF internals knowledge documented in PDF-A-go-slim's `docs/learnings.md` also informed this project's design.

In short: **PDF-A-go-go** renders PDFs, **PDF-A-go-slim** optimizes them, and **PDF-A-go-actionable** validates their accessibility.

## Development Conventions

- **TDD** — tests are written before implementation (see PRD.md for details)
- **[Conventional Commits](https://www.conventionalcommits.org/)** — all commit messages use prefixes like `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

## Status

In development. See [PRD.md](PRD.md) for the full product requirements.

## Acknowledgments

This project builds on the work of many others:

- **[pdf-lib](https://github.com/Hopding/pdf-lib)** by Andrew Dillon — low-level PDF object access that makes client-side PDF analysis possible
- **[fflate](https://github.com/101arrowz/fflate)** by 101arrowz — fast, lightweight compression/decompression used for PDF stream decoding
- **[WinBox](https://github.com/nextapps-de/winbox)** by Nextapps GmbH — lightweight window manager providing the floating panel system
- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim)** — sibling project whose utility modules (stream decoding, content stream parsing, structure tree traversal, accessibility detection) provide the foundation for this tool's PDF engine
- **[PDF-A-go-go](https://github.com/khawkins98/PDF-A-go-go)** — the original project in this family, whose development surfaced the PDF accessibility challenges this tool addresses
- **[PAC (PDF Accessibility Checker)](https://pac.pdf-accessibility.org/)** by the PDF/UA Foundation — the gold standard for PDF accessibility validation, and the primary inspiration for this tool's check coverage
- **[veraPDF](https://verapdf.org/)** — open-source PDF/A and PDF/UA validator whose test corpus and rule definitions inform our check logic
- **WCAG**, **PDF/UA (ISO 14289)**, and the **Matterhorn Protocol** — the standards that define what accessible PDFs look like

## License

MIT
