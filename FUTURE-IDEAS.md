# Future Ideas

Features and improvements deferred from V1.0. Kept here so they don't get lost.

## V1.1 Candidates

### Export & Interoperability
- **EARL (Evaluation and Report Language)** --W3C standard format for accessibility evaluation results. Enables machine-to-machine exchange of audit data.
- **veraPDF rule mapping** --map findings to veraPDF rule IDs for interoperability with existing compliance workflows.
- **CI/CD integration** --CLI mode or API endpoint so automated pipelines can run accessibility checks on PDF artifacts.

### Batch & Scale
- **Batch processing** --drag multiple PDFs, get aggregate reporting. The worker architecture already supports sequential processing; needs UI for queue management and summary-across-files.

### Deeper Analysis
- **Per-image decorative detection** --MCID-to-content-stream correlation to identify exactly which images are untagged (V1.0 uses a count-based heuristic).
- **Full link text extraction** --parse content streams to extract actual rendered text from `/Link` marked content spans, rather than relying on `/ActualText` attributes.
- **Color contrast analysis** -- requires full page rendering (PDF.js or similar). Adds ~400 KB to the bundle. Would enable automated WCAG 1.4.3 / 1.4.6 checking.
- ~~**PDF.js visual preview**~~ --**Done (V1.0).** Renders pages via pdfjs-dist with MCID highlight overlays, reading order visualization, alt text overlay, and zoom controls. Integrated into the floating panel system.

### UI & Experience
- **Dark mode** -- WinBox theme variant. The V1.0 theme CSS already uses custom properties, so this should be straightforward.
- **Service worker for offline** -- explicit offline support with precache manifest and update strategy. The app already works offline (static assets), but a service worker would make it reliable and add install-to-homescreen.
- **Layout persistence** --save and restore window positions/sizes in localStorage.
- **Keyboard navigation** --full keyboard control of the window layout (beyond what WinBox provides out of the box).

### Integration
- **PDF-A-go-slim embed** --link to or embed PDF-A-go-slim for a "fix this PDF" workflow after identifying issues.
- **Screen reader testing guidance** -- deeper integration with NVDA/VoiceOver testing workflows, maybe a guided walkthrough.

## Someday/Maybe

- **PDF editing / remediation** -- currently a non-goal ("validation tool, not remediation tool"), but users will ask for it. Could start with simple fixes like adding a document title or language tag.
- **Full PDF/UA-1 / PDF/UA-2 conformance** -- the full 300+ machine rules from the Matterhorn Protocol. Huge scope increase.
- **Shared npm package** -- extract the 7 utility modules shared with PDF-A-go-slim into a standalone package if both projects stabilize and the shared code stops diverging.
- **Browser extension** -- check PDFs from the browser download bar or a context menu.
- **Internationalization** -- translate the UI and remediation guidance into other languages.
