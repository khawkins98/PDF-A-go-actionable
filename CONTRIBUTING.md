# Contributing

Thanks for your interest in PDF-A-go-actionable. This is a client-side PDF accessibility checker — everything runs in the browser, no backend, no uploads.

## Filing issues

Open an issue at https://github.com/khawkins98/PDF-A-go-actionable/issues. Most useful detail:

- A small repro PDF if possible (or a description of how to make one — avoid sharing sensitive content).
- Browser + OS, browser console output if there's an error.
- Which audit module looks involved (metadata, structure, images, tables, lists, fonts, forms, links, reading-order).
- Whether the PDF was produced by a specific tool (Word, InDesign, PptxGenJS, LaTeX) — those produce idiosyncratic structures and that detail is often the key to a fix.

For PDFs that hang or crash the audit, please capture the URL/console message — those are usually structure-tree cycle or stream-parser issues we want to fix at the source.

## Proposing changes

1. Fork and branch off `main`.
2. `npm install`, `npm run dev`, `npm test` (Vitest, runs in Node — audit modules don't touch the DOM).
3. **Strict TDD** for audit modules and core logic — write the failing test first. The CLAUDE.md project notes spell this out and `src/audit/*.test.js` shows the pattern. Test files are co-located with source.
4. Open a draft PR while you iterate.

## What to watch when editing

The PDF format is full of quirks. The CLAUDE.md file at the root captures the most important ones — read it before touching parser/structure code. Highlights:

- **Resolve through `/RoleMap` before matching tags.** Custom tag names (`/Slide`, `/Heading1`) only work if you walk the rolemap chain.
- **Flat object scan vs tree walk.** Use `enumerateIndirectObjects()` for aggregation. Only tree-walk when document order matters, and always with visited-set + element/depth caps.
- **`PDFStream` does not extend `PDFDict`.** Use `obj.dict.get()` for streams, never `obj.get()` directly.
- **Use fflate `zlibSync` (not `deflateSync`)** for FlateDecode round-trips.
- **Be resilient.** Each audit module catches its own errors and returns a `warning` Finding rather than aborting the whole audit.

## Branch and commit style

- Branches: descriptive, e.g. `feat/pdfjs-v5-migration`, `fix/structure-tree-cycle`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) — match recent history.

## Review

Best-effort, no SLA — this is a personal project. Bug reports with a repro PDF jump the queue.

## License

MIT. See [LICENSE](LICENSE).
