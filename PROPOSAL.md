# Future Roadmap

Ideas for improving the tool for desktop designers and non-specialist users. Grouped by effort.

## Quick Wins

- **Tiered metadata display** — collapse diagnostic fields (PDF/UA, PDF/A, creator, producer) by default; show only actionable fields (title, author, language, tagged, pages)
- **Quick summary sentence** — plain-English one-liner above verdict: "This PDF has 3 issues that block screen reader access. The most important fix is adding alt text to 3 images."
- **Copy Fix Instructions** — per-finding clipboard button with formatted remediation steps, page reference, and WCAG/PDF/UA citations
- **Structure tree icons** — color-coded icons for tag types (headings, figures, tables, links, lists) to make the tree scannable
- **Tag name tooltips** — hover explanations on PDF tag names (e.g., "TH = Table Header cell")
- **Creator-specific hints** — contextual note based on creator/producer metadata (e.g., "InDesign PDFs commonly have reading order issues due to z-order tagging")

## Medium Effort

- **Tool-tab remediation** — restructure remediation as tabbed per-tool steps (InDesign / Word / Acrobat / General) instead of a single text block
- **Finding priority levels** — critical/high/medium/low per finding to answer "what should I fix first?"
- **Click-to-locate in preview** — clicking a finding detail navigates the PDF preview to the page and highlights the element
- **Fix list export** — markdown/text checklist of just failures and warnings with remediation steps, grouped by authoring tool
- **Page-level issue grouping** — alternative findings view grouped by page number (designers think spatially)
- **Problems-only tree filter** — collapse structure tree to show only nodes with issues
- **Comparison mode** — when re-checking the same filename, show a diff (fixed / new / unchanged)
- **First-run overlay** — 3-step guided introduction on first use

## Ambitious

- **Issue overlay in preview** — colored pins on PDF pages at issue locations (red=fail, amber=warning), clickable to select the finding
- **Side-by-side layout** — docked findings list + PDF preview for PAC-like workflow
- **Batch summary dashboard** — aggregate view when 3+ PDFs are analyzed ("6 pass, 2 fail, common issues: alt text, table headers")
- **Session history timeline** — check-by-check progress tracking across re-exports
- **Content tagged-or-artifacted check** — Matterhorn 01-003/01-004; detects untagged body text invisible to screen readers
- **Annotation tagging check** — PDF/UA 7.17; verifies link and widget annotations are tagged
- **Before/after sample PDFs** — curated examples showing a failing PDF and its remediated version
