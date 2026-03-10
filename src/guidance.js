/**
 * Consolidated guidance module — single source of truth for all user-facing
 * text: remediation advice, "why it matters" explanations, authoring tips,
 * metadata tooltips, and creator-specific hints.
 *
 * Pure data module (no DOM, no engine imports). Safe for Web Worker import.
 */

// ---------------------------------------------------------------------------
// FINDINGS — keyed by finding ID
// ---------------------------------------------------------------------------

/**
 * Static guidance for each finding.
 *
 * `remediation` can be:
 *  - string — single remediation for all statuses
 *  - { [status]: string } — status-keyed remediation
 *  - null — no remediation (pass, N/A)
 *
 * `why` is the plain-language explanation used in checklist, dashboard, and exports.
 */
export const FINDINGS = {
  'document-title': {
    why: 'The document title appears in browser tabs, bookmarks, and is the first thing a screen reader announces. Without it, users see a filename like "Q4_report_v3_FINAL.pdf" instead of a meaningful title.',
    remediation: {
      fail: 'Set the document title in your authoring tool (File > Properties in Word/InDesign, or Document Properties in Acrobat). Use something descriptive, not the filename.',
      warning: 'The document title is in the legacy Info dictionary but not in XMP metadata. PDF/UA requires dc:title in XMP. Re-export the PDF with your authoring tool, or use Acrobat\'s File > Properties to set the title (which updates both sources).',
    },
  },
  'document-lang': {
    why: 'The document language tells screen readers which pronunciation rules to use. Without it, an English document might be read with French pronunciation, making the content unintelligible.',
    remediation: {
      fail: 'Set the document language in your authoring tool. In Word: File > Options > Language. In InDesign: not set directly — after export, set it in Acrobat: File > Properties > Advanced > Language.',
      warning: null, // dynamic — audit module builds from invalid tag
    },
  },
  'security-permissions': {
    why: 'PDF security settings can block assistive technology from reading the document. If content extraction is restricted, screen readers cannot access the text at all.',
    remediation: 'Remove the security restrictions blocking accessibility. In Acrobat: File > Properties > Security > Change Settings, then enable "Enable text access for screen reader devices."',
  },
  'tagged-pdf': {
    why: 'Tags are the foundation of PDF accessibility. They define the document structure — headings, paragraphs, lists, tables — that assistive technology uses to navigate. An untagged PDF is essentially invisible to screen readers.',
    remediation: {
      fail: 'Tag the document in your authoring tool. In Word/PowerPoint: use heading styles and export with accessibility. In InDesign: enable "Create Tagged PDF" on export. In Acrobat: Accessibility > Add Tags to Document.',
      'fail-suspects': 'Open the document in Acrobat Pro and run Accessibility > Full Check to identify suspect tags. Review and fix the tag tree, then clear the Suspects flag.',
    },
  },
  'structure-tree': {
    why: 'Tags are the foundation of PDF accessibility. They define the document structure — headings, paragraphs, lists, tables — that assistive technology uses to navigate. An untagged PDF is essentially invisible to screen readers.',
    remediation: 'Tag the document properly. The structure tree gets created automatically when you use heading styles and accessibility-aware export.',
  },
  'heading-hierarchy': {
    why: 'Headings create the document outline that screen reader users navigate by. A broken hierarchy (jumping from H1 to H3, or using headings for visual styling) makes the document structure nonsensical.',
    remediation: {
      warning: 'Fix heading levels in your source document. Start with H1 and don\'t skip levels (H1 > H2 > H3, not H1 > H3). In InDesign: check your paragraph style export tags via Edit > Export Tagging to ensure styles map to the correct heading levels.',
      'warning-no-headings': 'Add headings using heading styles (H1, H2, H3, etc.) in your authoring tool. In InDesign: map paragraph styles to PDF heading tags via Edit > Export Tagging. They create the navigable outline.',
    },
  },
  'image-alt-text': {
    why: 'Alt text provides a text equivalent for images. Without it, screen reader users hear "image" or nothing at all, missing potentially critical information like charts, diagrams, or photos.',
    remediation: {
      fail: 'Add alt text to each meaningful image. In Word: right-click the image > Edit Alt Text. In InDesign: select the frame > Object > Object Export Options > Alt Text tab > Custom. In Acrobat: Reading Order panel > right-click Figure > Edit Alternate Text.',
      warning: 'Replace generic alt text (e.g., "image", "photo") with a real description. Say what the image shows or what information it communicates.',
      'warning-no-struct': 'Tag the document first, then add alt text to each meaningful image.',
    },
  },
  'decorative-images': {
    why: 'Decorative images (borders, backgrounds, spacers) should be hidden from screen readers. If tagged as Figures without alt text, they create confusing "image" announcements that interrupt the reading flow.',
    remediation: 'Review unmatched images. If decorative, mark as artifacts: in InDesign, select the frame > Object > Object Export Options > Tagged PDF tab > Artifact. In Acrobat: Tags panel > change the Figure tag to Artifact. If meaningful, add them as tagged Figure elements with alt text.',
  },
  'table-headers': {
    why: 'Screen readers use table headers (TH) to announce the column or row label as users navigate cells. Without headers, a data cell like "42" has no context — users cannot tell what the number refers to.',
    remediation: 'Mark header cells as TH elements with Scope attribute (Row or Column). In Word: use "Header Row" / "Header Column" in Table Design. In InDesign: Table > Table Options > Headers and Footers to define header rows, then map header cells to TH in export tagging. In Acrobat: Reading Order panel > Table Editor.',
  },
  'list-structure': {
    why: 'Screen readers announce list length and position (e.g., "item 3 of 7"), helping users understand content organization. Untagged lists are read as flat paragraphs, losing this navigational context.',
    remediation: 'Use proper list formatting in your authoring tool. In Word: use bullet/numbered list styles. In InDesign: use List paragraph styles and map them to L > LI > Lbl + LBody in Edit > Export Tagging. Avoid manually typing bullets or numbers. In Acrobat: use the Tags panel to fix list structure.',
  },
  'font-tounicode': {
    why: 'Without a ToUnicode CMap, the PDF viewer cannot convert font glyph codes back to characters. Screen readers will skip or mispronounce the text, and copy-paste will produce symbols instead of words.',
    remediation: 'Re-export the PDF with font embedding enabled, or use fonts that include Unicode mapping. In InDesign: File > Export > Adobe PDF > Advanced > check "Subset fonts below 100%". In Word: save as PDF (fonts are embedded by default). In Acrobat: Preflight > Embed missing fonts.',
  },
  'font-embedding': {
    why: 'Unembedded fonts rely on the reader\'s computer having the same font installed. If the font is missing, the system substitutes a different one, which can ruin the layout or render text unreadable.',
    remediation: 'Embed all fonts in the PDF. In Word: save as PDF with "embed fonts" option. In InDesign: export with "subset fonts below 100%". In Acrobat: Preflight > Embed missing fonts.',
  },
  'form-labels': {
    why: 'Screen readers announce the tooltip (/TU) as the field label. Without it, users hear "text field" with no context about what to enter.',
    remediation: 'Add tooltip text to each form field. In InDesign: select the form field > Object > Interactive > set Description (this becomes the /TU tooltip). In Acrobat: Form Editing > right-click field > Properties > General > Tooltip. The tooltip is read by screen readers as the field label.',
  },
  'tab-order': {
    why: 'When tab order does not follow document structure, keyboard-only users navigate form fields in a random-seeming order. This is especially confusing in forms where fields must be completed in sequence.',
    remediation: 'Set tab order to "Use Document Structure" for all pages. Note: InDesign does not set tab order — this must be done after export. In Acrobat: All Tools > Organize Pages, select a page thumbnail, then Page Properties > Tab Order > Use Document Structure. For tagged PDFs this is the recommended setting (see helpx.adobe.com/acrobat/using/page-thumbnails-bookmarks-pdfs.html).',
  },
  'link-text': {
    why: 'Screen readers can list all links on a page. Generic text like "click here" tells the user nothing about the destination. Descriptive link text lets users scan the link list and jump to the right one.',
    remediation: 'Use descriptive link text that makes sense out of context. Replace "click here" with a description of the destination (e.g., "download the annual report"). If a bare URL must be visible in the design, set the Link tag\'s ActualText to a descriptive phrase so screen readers announce "UNDRR strategic framework" instead of reading out the full URL. In InDesign: use the Hyperlinks panel (Window > Interactive > Hyperlinks) and set descriptive text as the link source. In Acrobat: use the Create Link command to ensure links are properly tagged. See helpx.adobe.com/acrobat/using/create-verify-pdf-accessibility.html for details.',
  },
  'color-contrast': {
    why: 'Low contrast between text and background makes content hard to read for users with low vision, color blindness, or in bright lighting. Meeting WCAG contrast ratios benefits everyone.',
    remediation: 'Increase contrast by using darker text on lighter backgrounds (or vice versa). Avoid light gray text on white, or colored text on colored backgrounds. Test with the Colour Contrast Analyser tool.',
  },
  'reading-order': {
    why: 'Screen readers follow the tag order, not the visual layout. If tags are in the wrong order, a user might hear the page footer before the main content, or a table caption after the table data.',
    remediation: 'If reading order is wrong, fix it in the authoring tool by adjusting the tag order. In InDesign: use the Articles panel (Window > Articles) to define reading order explicitly — drag frames in the desired sequence. In Acrobat: View > Navigation Panels > Order, then drag items to reorder. In Word: make sure content is in order in the document (text boxes can break flow).',
  },
  'screen-reader-test': {
    why: 'Automated checkers cannot verify that the document actually makes sense when read aloud. A screen reader test reveals issues like incorrect reading order, missing context, and confusing navigation that only a human listener can catch.',
    remediation: 'If the screen reader reads content in the wrong order or misses elements, fix the tag structure and reading order in your authoring tool.',
  },
  'pdfa-conformance': {
    why: 'PDF/A ensures long-term archival preservation. While not required for accessibility, it indicates the document follows strict standards.',
    remediation: null,
  },
  'pdfua-conformance': {
    why: 'A PDF/UA conformance flag tells tools and workflows the document meets the ISO 14289 accessibility standard. Not required to be accessible, but useful for compliance pipelines.',
    remediation: 'PDF/UA conformance is set via XMP metadata. Acrobat Pro and axesPDF can add the declaration after you validate the document.',
  },
  'display-doc-title': {
    why: 'When the viewer shows the filename instead of the document title, screen reader users hear a cryptic label rather than a meaningful description.',
    remediation: 'In Acrobat: File > Properties > Initial View > Window Options > Show: Document Title.',
  },
  'bookmarks': {
    why: 'Bookmarks help users navigate longer documents by providing a table-of-contents-like sidebar panel. Without them, users must scroll through the entire document.',
    remediation: 'Add bookmarks in your authoring tool. In Word, heading styles become bookmarks automatically on export. In Acrobat: View > Navigation Panels > Bookmarks.',
  },
  'per-element-language': {
    why: 'Multilingual documents need per-element language tags so screen readers switch pronunciation rules when the language changes mid-document.',
    remediation: 'If the document contains content in multiple languages, set the /Lang attribute on the relevant structure elements. In Acrobat: select the element in the Tags panel > Properties > Language.',
  },
  // Load-failure and error findings
  'load-failure': {
    why: null,
    remediation: null, // dynamic — runner builds from error message
  },
};

// ---------------------------------------------------------------------------
// getRemediation — helper to resolve string or status-keyed object
// ---------------------------------------------------------------------------

/**
 * Get remediation text for a finding.
 *
 * @param {string} findingId - The finding ID
 * @param {string} [status] - The finding status (for status-keyed remediation)
 * @returns {string|null}
 */
export function getRemediation(findingId, status) {
  const entry = FINDINGS[findingId];
  if (!entry || !entry.remediation) return null;

  if (typeof entry.remediation === 'string') return entry.remediation;

  if (status && entry.remediation[status]) return entry.remediation[status];

  return null;
}

// ---------------------------------------------------------------------------
// META_TOOLTIPS — tooltip text for dashboard metadata grid labels
// ---------------------------------------------------------------------------

/**
 * Tooltip text for each metadata field in the dashboard grid.
 * Keyed by the label text shown in the <dt> element.
 */
export const META_TOOLTIPS = {
  Title: 'The document title appears in browser tabs, bookmarks, and is the first thing a screen reader announces. Set it in File > Properties.',
  Author: 'Identifies who created the document. Helps users verify the source and contact the author for questions.',
  Subject: 'A brief description of the document\'s content. Used by search engines and document management systems.',
  Keywords: 'Search terms that help users find this document. Separate keywords with commas.',
  Language: 'Tells screen readers which pronunciation rules to use. Without it, the screen reader guesses — often incorrectly.',
  Pages: 'Total number of pages in the document.',
  'File Size': 'The file size of the PDF. Large files may be slow to load on mobile devices or slow connections.',
  Tagged: 'Tags define the document structure (headings, lists, tables) that screen readers use. An untagged PDF is invisible to assistive technology.',
  'PDF/UA': 'PDF/UA is the international standard for PDF accessibility. "Yes" means the document claims conformance.',
  'PDF/A': 'PDF/A is the archival standard. While not required for accessibility, it indicates the document follows strict preservation standards.',
  'Viewer Shows Title': 'Controls whether the viewer shows the document title or the filename in the title bar. Screen reader users benefit from a meaningful title.',
  'Structure Tree': 'The structure tree contains all tags. Without it, assistive technology cannot navigate the document.',
  Creator: 'The application that originally created the document (e.g., Word, InDesign).',
  Producer: 'The application that converted the document to PDF (e.g., Adobe PDF Library).',
};

// ---------------------------------------------------------------------------
// CREATOR_HINTS — tool-specific guidance banners
// ---------------------------------------------------------------------------

/**
 * Known creator/producer hints keyed by tool name.
 * Shown as a contextual banner when the authoring tool is detected.
 */
export const CREATOR_HINTS = {
  indesign: {
    tool: 'Adobe InDesign',
    hint: 'InDesign PDFs commonly have reading order issues because InDesign uses z-order for tag sequence. Use the Articles panel to set explicit reading order before exporting.',
  },
  word: {
    tool: 'Microsoft Word',
    hint: 'Word PDFs often have good heading structure but may have text boxes that break reading order, and tables without repeated headers on multi-page spans.',
  },
  powerpoint: {
    tool: 'Microsoft PowerPoint',
    hint: 'PowerPoint PDFs commonly have decorative elements that are not marked as artifacts and slide layouts with incorrect reading order. Check each slide\'s reading order pane.',
  },
  acrobat: {
    tool: 'Adobe Acrobat',
    hint: 'This PDF was produced or modified in Acrobat. Use the Accessibility tools in Acrobat Pro to review and fix tags, reading order, and alt text.',
  },
  libreoffice: {
    tool: 'LibreOffice',
    hint: 'LibreOffice PDFs may be missing ToUnicode CMaps for some fonts and often have weak table structure. Verify heading hierarchy matches document styles.',
  },
};

/**
 * Detect the primary authoring tool from creator/producer metadata.
 * @param {object} meta - Document metadata with creator/producer fields
 * @returns {string|null} Tool key or null
 */
export function detectCreatorTool(meta) {
  if (!meta) return null;
  const str = `${meta.creator || ''} ${meta.producer || ''}`.toLowerCase();
  if (str.includes('powerpoint')) return 'powerpoint';
  if (str.includes('word')) return 'word';
  if (str.includes('indesign')) return 'indesign';
  if (str.includes('libreoffice') || str.includes('writer')) return 'libreoffice';
  if (str.includes('acrobat')) return 'acrobat';
  return null;
}

// ---------------------------------------------------------------------------
// COMPLEMENTARY_TOOLS — external tool references
// ---------------------------------------------------------------------------

/**
 * Complementary tools for PDF accessibility testing and remediation.
 * Keyed by short identifier for referencing from checklist items.
 */
export const COMPLEMENTARY_TOOLS = {
  pac: {
    name: 'PAC (PDF Accessibility Checker)',
    url: 'https://pac.pdf-accessibility.org/',
    description: 'Free PDF/UA validation tool. Runs the full set of machine checks against the PDF/UA standard.',
    platform: 'Windows (Wine on macOS/Linux)',
    role: 'Automated PDF/UA validation',
  },
  axesCheck: {
    name: 'axesCheck',
    url: 'https://www.axes4.com/axescheck',
    description: 'Free online PDF accessibility checker. Quick structural validation without installation.',
    platform: 'Web',
    role: 'Quick online validation',
  },
  nvda: {
    name: 'NVDA',
    url: 'https://www.nvaccess.org/download/',
    description: 'Free, open-source screen reader for Windows. The go-to tool for manual reading order testing.',
    platform: 'Windows',
    role: 'Screen reader testing',
  },
  jaws: {
    name: 'JAWS',
    url: 'https://www.freedomscientific.com/products/software/jaws/',
    description: 'Commercial screen reader widely used in enterprise environments. Offers detailed PDF reading support.',
    platform: 'Windows',
    role: 'Screen reader testing',
  },
  voiceover: {
    name: 'VoiceOver',
    url: null,
    description: 'Built-in screen reader on macOS and iOS. System Settings > Accessibility > VoiceOver.',
    platform: 'macOS / iOS',
    role: 'Screen reader testing',
  },
  acrobatPro: {
    name: 'Adobe Acrobat Pro',
    url: 'https://www.adobe.com/acrobat/acrobat-pro.html',
    description: 'Full PDF editing with accessibility checking and remediation. The standard tool for fixing tagged PDFs.',
    platform: 'Windows / macOS',
    role: 'Remediation and validation',
  },
  verapdf: {
    name: 'veraPDF',
    url: 'https://verapdf.org/',
    description: 'Open-source PDF/A and PDF/UA validation. Reference implementation used by many compliance workflows.',
    platform: 'Cross-platform (Java)',
    role: 'Standards conformance validation',
  },
};

// ---------------------------------------------------------------------------
// UNDRR_CHECKLIST — 13-point validation checklist
// ---------------------------------------------------------------------------

/**
 * UNDRR 13-point validation checklist.
 * Each item maps to one or more of our finding IDs and includes
 * educational narrative content and authoring-tool-specific tips.
 *
 * `whyItMatters` references FINDINGS[id].why where the finding has a matching
 * explanation, keeping text consistent across dashboard and checklist.
 */
export const UNDRR_CHECKLIST = [
  {
    undrrNumber: 1,
    title: 'Document title is set',
    findingIds: ['document-title'],
    whyItMatters: FINDINGS['document-title'].why,
    authoringTips: {
      general: 'Set a descriptive document title in your authoring tool before exporting to PDF. Also enable "Display Document Title" in the PDF viewer preferences.',
      word: 'File > Info > Properties > Title. This transfers directly to PDF metadata on export.',
      indesign: 'File > File Info > Description > Document Title. Note: InDesign cannot set the display preference -- do that in Acrobat after export.',
      powerpoint: 'File > Info > Properties > Title. PowerPoint exports this as PDF metadata automatically.',
      acrobat: 'File > Properties > Description tab > Title. Then Initial View tab > Show: Document Title.',
    },
    complementaryTools: ['acrobatPro'],
  },
  {
    undrrNumber: 2,
    title: 'Document language is specified',
    findingIds: ['document-lang'],
    whyItMatters: FINDINGS['document-lang'].why,
    authoringTips: {
      general: 'Set the document language before exporting to PDF. Use standard language codes like "en" for English or "fr" for French.',
      word: 'File > Options > Language. The proofing language set for the majority of text becomes the PDF language on export.',
      indesign: 'Not directly set in InDesign. Set it in Acrobat: File > Properties > Advanced tab > Language.',
      powerpoint: 'Review > Language > Set Proofing Language. This sets the document-level language on PDF export.',
      acrobat: 'File > Properties > Advanced tab > Reading Options > Language dropdown.',
    },
    complementaryTools: ['acrobatPro', 'pac'],
  },
  {
    undrrNumber: 3,
    title: 'Security permits accessibility',
    findingIds: ['security-permissions'],
    whyItMatters: FINDINGS['security-permissions'].why,
    authoringTips: {
      general: 'When adding password protection, always ensure the "Enable text access for screen reader devices" option is checked.',
      word: 'Security settings are typically applied after export using Acrobat or other PDF tools.',
      indesign: 'Export dialog > Security panel. Ensure "Enable text access for screen reader devices" is checked.',
      powerpoint: 'Security settings are typically applied after export using Acrobat or other PDF tools.',
      acrobat: 'File > Properties > Security tab. Under Permissions, ensure content accessibility is enabled.',
    },
    complementaryTools: ['acrobatPro'],
  },
  {
    undrrNumber: 4,
    title: 'PDF is tagged',
    findingIds: ['tagged-pdf', 'structure-tree'],
    whyItMatters: FINDINGS['tagged-pdf'].why,
    authoringTips: {
      general: 'Always export with the "Tagged PDF" or "Create Tagged PDF" option enabled. Use built-in styles (headings, lists) rather than manual formatting.',
      word: 'File > Save As > PDF > Options > check "Document structure tags for accessibility".',
      indesign: 'File > Export > Adobe PDF > check "Create Tagged PDF" in the General panel.',
      powerpoint: 'File > Save As > PDF. PowerPoint automatically creates tags from slide structure.',
      acrobat: 'Accessibility > Autotag Document can add tags to an untagged PDF, but results need manual review.',
    },
    complementaryTools: ['pac', 'acrobatPro'],
  },
  {
    undrrNumber: 5,
    title: 'Reading and tab order is logical',
    findingIds: ['reading-order', 'tab-order'],
    whyItMatters: FINDINGS['reading-order'].why,
    authoringTips: {
      general: 'Review the reading order by tabbing through the document or using the structure tree. Multi-column layouts and text boxes often cause order issues.',
      word: 'Word generally produces good reading order. Watch out for text boxes, which may appear at the end of the reading order.',
      indesign: 'Use the Articles panel to define reading order explicitly. InDesign\'s default tag order follows the z-order of frames.',
      powerpoint: 'Home > Arrange > Selection Pane. The reading order is bottom-to-top in the list. Reorder as needed.',
      acrobat: 'View > Navigation Panels > Order. Drag items to correct the reading sequence. For tab order: All Tools > Organize Pages > select page thumbnail > Page Properties > Tab Order > Use Document Structure. This is recommended for all tagged PDFs (see helpx.adobe.com/acrobat/using/page-thumbnails-bookmarks-pdfs.html).',
    },
    complementaryTools: ['nvda', 'jaws', 'voiceover', 'acrobatPro'],
  },
  {
    undrrNumber: 6,
    title: 'Images have alt text',
    findingIds: ['image-alt-text'],
    whyItMatters: FINDINGS['image-alt-text'].why,
    authoringTips: {
      general: 'Write alt text that conveys the same information the image provides visually. For complex images like charts, provide a detailed description nearby.',
      word: 'Right-click image > Edit Alt Text. Write a concise description. Check "Mark as decorative" for purely visual elements.',
      indesign: 'Object > Object Export Options > Alt Text tab. Choose Custom and enter the description.',
      powerpoint: 'Right-click image > Edit Alt Text. PowerPoint also has an "Generate a description" AI feature.',
      acrobat: 'Accessibility > Set Alternate Text, or edit the Figure tag\'s Alt property in the Tags panel.',
    },
    complementaryTools: ['pac', 'acrobatPro'],
  },
  {
    undrrNumber: 7,
    title: 'Decorative images marked as artifacts',
    findingIds: ['decorative-images'],
    whyItMatters: FINDINGS['decorative-images'].why,
    authoringTips: {
      general: 'Mark purely decorative images as artifacts so screen readers skip them entirely. Only meaningful images should be tagged as Figures.',
      word: 'Right-click image > Edit Alt Text > check "Mark as decorative". Word will artifact these on export.',
      indesign: 'Object > Object Export Options > Tagged PDF tab > set to "Artifact". Or place decorative elements on a non-exported layer.',
      powerpoint: 'Right-click > Edit Alt Text > "Mark as decorative". Decorative elements will be excluded from the tag structure.',
      acrobat: 'In the Tags panel, select the Figure tag and change it to Artifact. Or use the Reading Order tool > select image > Background/Artifact.',
    },
    complementaryTools: ['acrobatPro'],
  },
  {
    undrrNumber: 8,
    title: 'Heading hierarchy is correct',
    findingIds: ['heading-hierarchy'],
    whyItMatters: FINDINGS['heading-hierarchy'].why,
    authoringTips: {
      general: 'Use heading levels in order: H1 > H2 > H3. Never skip levels. Use headings for structure, not just to make text look bigger.',
      word: 'Use the built-in Heading 1, Heading 2, Heading 3 styles from the Styles gallery. Check the Navigation Pane to verify hierarchy.',
      indesign: 'Map paragraph styles to PDF heading tags in Edit > Export Tagging. Ensure the mapping follows a logical hierarchy.',
      powerpoint: 'Slide titles map to headings. Use the Outline View to verify structure. Avoid using text boxes formatted to look like headings.',
      acrobat: 'View the Tags panel. Headings should nest logically. Change mis-tagged elements by editing the tag type.',
    },
    complementaryTools: ['pac', 'acrobatPro'],
  },
  {
    undrrNumber: 9,
    title: 'Table headers are identified',
    findingIds: ['table-headers'],
    whyItMatters: FINDINGS['table-headers'].why,
    authoringTips: {
      general: 'Designate header rows and columns in your authoring tool. Ensure TH cells have a Scope attribute (Row or Column) in the final PDF.',
      word: 'In Table Design, check "Header Row" and "First Column" as appropriate. Repeat header rows across page breaks.',
      indesign: 'Use Table > Table Options > Headers and Footers. Map header cells to TH tags in the export tagging.',
      powerpoint: 'PowerPoint tables have limited accessibility support. Consider providing a text description of the data alongside the table.',
      acrobat: 'In the Tags panel, ensure header cells are tagged as TH (not TD). Add Scope attributes via Properties.',
    },
    complementaryTools: ['pac', 'acrobatPro'],
  },
  {
    undrrNumber: 10,
    title: 'Lists are properly tagged',
    findingIds: ['list-structure'],
    whyItMatters: FINDINGS['list-structure'].why,
    authoringTips: {
      general: 'Use your authoring tool\'s built-in bullet and numbered list features. Never create lists by manually typing bullet characters or numbers.',
      word: 'Use the Bullets or Numbering button in the Home tab. Nested lists should use the Increase Indent button.',
      indesign: 'Use List styles for bullets and numbering. Map them to L > LI > Lbl + LBody in export tagging.',
      powerpoint: 'Use the built-in bullet list feature on slides. These export as proper list tags automatically.',
      acrobat: 'In the Tags panel, verify the structure: L > LI > Lbl + LBody. Fix manually if the structure is wrong.',
    },
    complementaryTools: ['pac', 'acrobatPro'],
  },
  {
    undrrNumber: 11,
    title: 'Accessibility checker is run',
    findingIds: [],
    whyItMatters: 'Running an accessibility checker catches structural issues that manual review might miss. This tool performs that role — review the findings above for specific issues.',
    authoringTips: {
      general: 'This checker has been run. If issues were found, fix them in your authoring tool and re-check until all automated checks pass.',
      word: 'File > Check for Issues > Check Accessibility. Review and fix all issues in the Inspection Results pane.',
      indesign: 'InDesign has no built-in accessibility checker. Export to PDF and use Acrobat or PAC to validate.',
      powerpoint: 'File > Check for Issues > Check Accessibility (or Review > Check Accessibility in newer versions).',
      acrobat: 'Accessibility > Full Check. Review the report and fix each issue. Re-run until all checks pass.',
    },
    complementaryTools: ['pac', 'acrobatPro', 'verapdf'],
  },
  {
    undrrNumber: 12,
    title: 'PAC reports no errors',
    findingIds: ['pdfua-conformance'],
    whyItMatters: FINDINGS['pdfua-conformance'].why,
    authoringTips: {
      general: 'Download and run PAC on your PDF. Address all errors first, then warnings. PAC provides detailed explanations for each issue.',
      word: 'Export your PDF and open it in PAC. Common Word-export issues: missing table headers, text box ordering, missing alt text.',
      indesign: 'Export and validate with PAC. Common InDesign issues: missing language, artifacts not properly set, heading hierarchy.',
      powerpoint: 'Export and validate with PAC. Common PowerPoint issues: decorative elements not artifacted, reading order on complex slides.',
      acrobat: 'Use PAC alongside Acrobat\'s own checker. PAC often finds issues Acrobat\'s checker misses, especially in tag structure.',
    },
    complementaryTools: ['pac', 'verapdf'],
  },
  {
    undrrNumber: 13,
    title: 'Screen reader test',
    findingIds: ['screen-reader-test'],
    whyItMatters: FINDINGS['screen-reader-test'].why,
    authoringTips: {
      general: 'Listen to the entire document with a screen reader. Navigate by headings, tables, and links. Verify that the experience makes sense without seeing the visual layout.',
      word: 'Test the final PDF, not the Word file. Word\'s reading experience can differ significantly from the exported PDF.',
      indesign: 'Test the exported PDF. Pay special attention to reading order in multi-column layouts and text-wrapped elements.',
      powerpoint: 'Test each slide. Verify that slide content is read in a logical order and that all meaningful content is announced.',
      acrobat: 'Use Read Out Loud (View > Read Out Loud) for a quick test, but also test with NVDA or VoiceOver for the full experience.',
    },
    complementaryTools: ['nvda', 'jaws', 'voiceover'],
  },
];
