/**
 * Remediation guidance — reference text templates and external resource links.
 *
 * Provides structured guidance text for accessibility remediation,
 * organized by category. Includes links to external tools and resources.
 */

/**
 * External tools and resources for PDF accessibility testing and remediation.
 */
export const externalResources = {
  tools: [
    {
      name: 'PAC (PDF Accessibility Checker)',
      url: 'https://pac.pdf-accessibility.org/',
      description: 'Free PDF/UA validation tool (Windows). Runs the full set of machine checks against the PDF/UA standard.',
      platform: 'Windows (Wine on macOS/Linux)',
    },
    {
      name: 'PAC Online',
      url: 'https://pac.pdf-accessibility.org/en/pac-online',
      description: 'Browser-based version of PAC for quick checks without installation.',
      platform: 'Web',
    },
    {
      name: 'NVDA',
      url: 'https://www.nvaccess.org/download/',
      description: 'Free, open-source screen reader for Windows. The go-to tool for manual reading order testing.',
      platform: 'Windows',
    },
    {
      name: 'VoiceOver',
      url: null,
      description: 'Built-in screen reader on macOS and iOS. System Settings > Accessibility > VoiceOver.',
      platform: 'macOS / iOS',
    },
    {
      name: 'veraPDF',
      url: 'https://verapdf.org/',
      description: 'Open-source PDF/A and PDF/UA validation. Reference implementation used by many compliance workflows.',
      platform: 'Cross-platform (Java)',
    },
    {
      name: 'Adobe Acrobat Pro',
      url: 'https://www.adobe.com/acrobat/acrobat-pro.html',
      description: 'Full PDF editing with accessibility checking and remediation. Most accessibility professionals use this.',
      platform: 'Windows / macOS',
    },
    {
      name: 'axesPDF',
      url: 'https://www.axes4.com/axespdf-quickfix',
      description: 'PDF accessibility remediation tool. Fixes many structural issues automatically.',
      platform: 'Windows',
    },
  ],

  wcagResources: [
    {
      name: 'WCAG 2.1 Understanding Documents',
      url: 'https://www.w3.org/WAI/WCAG21/Understanding/',
      description: 'Explains each WCAG success criterion with examples.',
    },
    {
      name: 'PDF Techniques for WCAG 2.1',
      url: 'https://www.w3.org/WAI/WCAG21/Techniques/#pdf',
      description: 'How to meet WCAG requirements in PDFs specifically.',
    },
    {
      name: 'Matterhorn Protocol',
      url: 'https://pdfa.org/resource/the-matterhorn-protocol/',
      description: 'Test conditions for PDF/UA conformance. Maps which requirements can be machine-checked vs. human-checked.',
    },
    {
      name: 'PDF/UA in a Nutshell',
      url: 'https://pdfa.org/resource/pdfua-in-a-nutshell/',
      description: 'Short, readable introduction to the PDF/UA standard.',
    },
  ],
};

/**
 * Guidance text templates organized by category.
 * Each entry provides general guidance for a finding category.
 */
export const guidanceTemplates = {
  metadata: {
    title: 'Document Metadata',
    description: 'Screen readers and other assistive tools rely on metadata like title, language, and security settings to interact with the document correctly.',
    steps: [
      'Set a meaningful document title (not the filename) in your authoring tool.',
      'Specify the document language (e.g., "en" for English, "fr" for French).',
      'Ensure security settings allow accessibility access.',
      'Enable "Display Document Title" in viewer preferences.',
      'Add bookmarks for documents longer than a few pages.',
    ],
  },

  structure: {
    title: 'Document Structure',
    description: 'Tags are what make a PDF accessible. They define the reading order, identify headings, and create the navigable outline that assistive technology uses.',
    steps: [
      'Use your authoring tool\'s built-in styles (Heading 1, Heading 2, etc.) instead of manual formatting.',
      'Export with "Create Tagged PDF" enabled.',
      'Verify headings follow a logical hierarchy (H1 > H2 > H3) with no skipped levels.',
      'Check that the document starts with an H1.',
      'Review the structure tree to ensure all content is properly tagged.',
    ],
  },

  images: {
    title: 'Images and Alt Text',
    description: 'Meaningful images need alt text that conveys the same information. Decorative images should be marked as artifacts so screen readers skip them.',
    steps: [
      'Add alt text to every meaningful image that conveys information.',
      'Write alt text that describes the purpose and content of the image.',
      'Mark purely decorative images as artifacts (not tagged as Figure).',
      'For complex images (charts, diagrams), provide a detailed description nearby in the document text.',
      'Avoid using images of text. Use real text instead.',
    ],
  },

  tables: {
    title: 'Table Structure',
    description: 'Screen readers need tagged headers to connect data cells with their row and column labels. Without them, tables are just a grid of unlabeled cells.',
    steps: [
      'Designate header rows and columns in your authoring tool.',
      'In Word: check "Header Row" in Table Design.',
      'Ensure TH (header) cells have a Scope attribute (Row or Column).',
      'Avoid merged cells when possible. They complicate table navigation.',
      'Add a caption or summary to describe the table\'s purpose.',
    ],
  },

  lists: {
    title: 'List Structure',
    description: 'Screen readers announce list length and position (e.g., "item 3 of 7"). Lists need the correct nesting: L > LI > Lbl + LBody.',
    steps: [
      'Use your authoring tool\'s built-in bullet and numbered list styles.',
      'Avoid manually typing bullet characters or numbers.',
      'Ensure nested lists are created using the indent feature, not manual spacing.',
      'In Acrobat, verify the tag structure shows L > LI > Lbl + LBody.',
    ],
  },

  fonts: {
    title: 'Font Unicode Mapping',
    description: 'ToUnicode CMaps let text be extracted, searched, and read by assistive technology. Without them, copy/paste produces garbled text and screen readers may not read the content at all.',
    steps: [
      'Use standard fonts or embed all fonts when exporting to PDF.',
      'Prefer fonts with built-in Unicode mapping.',
      'If using custom or decorative fonts, verify text can be selected and copied correctly in the PDF.',
      'Re-export with "Embed all fonts" enabled if ToUnicode maps are missing.',
    ],
  },

  forms: {
    title: 'Form Accessibility',
    description: 'Form fields need labels that screen readers can announce. The tooltip (/TU) attribute is the accessible name, and tab order should follow the document structure.',
    steps: [
      'Add a tooltip (TU) to every form field. This is the label screen readers read.',
      'Make tooltip text descriptive: "Enter your first name" instead of "Name".',
      'Set tab order to "Use Document Structure" for all pages.',
      'Group related fields with fieldset/legend structure where possible.',
    ],
  },

  links: {
    title: 'Link Text Quality',
    description: 'Link text should make sense on its own. Screen reader users often navigate by links alone, hearing only the link text without the surrounding sentence.',
    steps: [
      'Replace generic link text ("click here", "read more") with descriptive text.',
      'Describe the destination: "Download the 2024 Annual Report (PDF)" instead of "Click here".',
      'Avoid using bare URLs as link text.',
      'If a URL must be displayed, also provide a descriptive link label.',
    ],
  },

  'reading-order': {
    title: 'Reading Order and Manual Checks',
    description: 'These checks can\'t be automated. Reading order, screen reader testing, and PAC validation all need a person to verify.',
    steps: [
      'Review the structure tree order against the visual layout.',
      'Use the Reading Order tool in Acrobat to check and fix order issues.',
      'Run the document through PAC (PDF Accessibility Checker) for PDF/UA validation.',
      'Test with a screen reader (NVDA, VoiceOver). Listen to the entire document.',
      'Pay attention to multi-column layouts, text boxes, and floating elements.',
    ],
  },
};

/**
 * Get guidance for a specific category.
 *
 * @param {string} category
 * @returns {{ title: string, description: string, steps: string[] } | null}
 */
export function getGuidance(category) {
  return guidanceTemplates[category] || null;
}

/**
 * Get all external resources.
 *
 * @returns {object}
 */
export function getExternalResources() {
  return externalResources;
}
