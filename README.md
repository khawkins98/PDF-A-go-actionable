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

## Relationship to PDF-A-go-slim

This is a sibling project to [PDF-A-go-slim](https://github.com/nickhawkins/PDF-A-go-slim), a browser-based PDF optimizer. Both tools share underlying PDF parsing infrastructure (pdf-lib, content stream parsing, structure tree traversal) but serve different purposes:

- **PDF-A-go-slim** -- reduce file size
- **PDF-A-go-actionable** -- validate accessibility

## Status

Early development. See [PRD.md](PRD.md) for the full product requirements.

## License

MIT
