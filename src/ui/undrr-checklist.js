/**
 * UNDRR 13-Point Validation Checklist — data and logic module.
 *
 * Maps our audit findings to the UNDRR "Validating PDF Accessibility with
 * Adobe Acrobat Pro" guide's 13-point checklist. Provides narrative guidance,
 * authoring-tool tips, and complementary tool references per checklist item.
 *
 * This module is pure data/logic — no DOM.
 */

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

/**
 * UNDRR 13-point validation checklist.
 * Each item maps to one or more of our finding IDs and includes
 * educational narrative content and authoring-tool-specific tips.
 */
export const UNDRR_CHECKLIST = [
  {
    undrrNumber: 1,
    title: 'Document title is set',
    findingIds: ['document-title', 'display-doc-title'],
    whyItMatters: 'The document title appears in browser tabs, bookmarks, and is the first thing a screen reader announces. Without it, users see a filename like "Q4_report_v3_FINAL.pdf" instead of a meaningful title.',
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
    whyItMatters: 'The document language tells screen readers which pronunciation rules to use. Without it, an English document might be read with French pronunciation, making the content unintelligible.',
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
    whyItMatters: 'PDF security settings can block assistive technology from reading the document. If content extraction is restricted, screen readers cannot access the text at all.',
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
    whyItMatters: 'Tags are the foundation of PDF accessibility. They define the document structure -- headings, paragraphs, lists, tables -- that assistive technology uses to navigate. An untagged PDF is essentially invisible to screen readers.',
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
    whyItMatters: 'Screen readers follow the tag order, not the visual layout. If tags are in the wrong order, a user might hear the page footer before the main content, or a table caption after the table data.',
    authoringTips: {
      general: 'Review the reading order by tabbing through the document or using the structure tree. Multi-column layouts and text boxes often cause order issues.',
      word: 'Word generally produces good reading order. Watch out for text boxes, which may appear at the end of the reading order.',
      indesign: 'Use the Articles panel to define reading order explicitly. InDesign\'s default tag order follows the z-order of frames.',
      powerpoint: 'Home > Arrange > Selection Pane. The reading order is bottom-to-top in the list. Reorder as needed.',
      acrobat: 'View > Navigation Panels > Order. Drag items to correct the reading sequence. Also set tab order to "Use Document Structure" in Page Properties.',
    },
    complementaryTools: ['nvda', 'jaws', 'voiceover', 'acrobatPro'],
  },
  {
    undrrNumber: 6,
    title: 'Images have alt text',
    findingIds: ['image-alt-text'],
    whyItMatters: 'Alt text provides a text equivalent for images. Without it, screen reader users hear "image" or nothing at all, missing potentially critical information like charts, diagrams, or photos.',
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
    whyItMatters: 'Decorative images (borders, backgrounds, spacers) should be hidden from screen readers. If tagged as Figures without alt text, they create confusing "image" announcements that interrupt the reading flow.',
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
    whyItMatters: 'Headings create the document outline that screen reader users navigate by. A broken hierarchy (jumping from H1 to H3, or using headings for visual styling) makes the document structure nonsensical.',
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
    whyItMatters: 'Screen readers use table headers (TH) to announce the column or row label as users navigate cells. Without headers, a data cell like "42" has no context -- users cannot tell what the number refers to.',
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
    whyItMatters: 'Screen readers announce list length and position (e.g., "item 3 of 7"), helping users understand content organization. Untagged lists are read as flat paragraphs, losing this navigational context.',
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
    title: 'Accessibility checker passes',
    findingIds: [],
    whyItMatters: 'Running an accessibility checker catches structural issues that manual review might miss. This tool performs that role -- review the findings above for specific issues.',
    authoringTips: {
      general: 'Run an accessibility checker as a final step before publishing. Address all failures and review warnings.',
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
    findingIds: ['pac-validation'],
    whyItMatters: 'PAC (PDF Accessibility Checker) performs comprehensive PDF/UA validation with hundreds of machine checks. It catches issues that simpler tools miss, particularly in tag structure and role mapping.',
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
    whyItMatters: 'Automated checkers cannot verify that the document actually makes sense when read aloud. A screen reader test reveals issues like incorrect reading order, missing context, and confusing navigation that only a human listener can catch.',
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

/** All finding IDs that belong to the UNDRR 13-point checklist. */
const MAPPED_FINDING_IDS = new Set(
  UNDRR_CHECKLIST.flatMap((item) => item.findingIds),
);

/** Status priority for roll-up: lower index = higher priority. */
const STATUS_PRIORITY = ['fail', 'warning', 'manual', 'pass', 'not-applicable'];

/**
 * Resolve the rolled-up status and summary for a UNDRR checklist item.
 * Uses worst-status-wins: fail > warning > manual > pass > N/A.
 * Returns 'not-checked' if no mapped findings exist for that item.
 *
 * @param {object} item - A UNDRR_CHECKLIST entry
 * @param {Map<string, object>} findingsMap - Map of findingId → finding object
 * @returns {{ status: string, summary: string|null }}
 */
function resolveItemResult(item, findingsMap) {
  if (item.findingIds.length === 0) {
    return { status: 'not-checked', summary: null };
  }

  let bestPriority = -1;
  let bestStatus = null;
  let bestSummary = null;

  for (const fid of item.findingIds) {
    const finding = findingsMap.get(fid);
    if (!finding) continue;
    const priority = STATUS_PRIORITY.indexOf(finding.status);
    if (priority === -1) continue;
    if (bestStatus === null || priority < bestPriority) {
      bestPriority = priority;
      bestStatus = finding.status;
      bestSummary = finding.summary || null;
    }
  }

  return {
    status: bestStatus || 'not-checked',
    summary: bestSummary,
  };
}

/**
 * Map findings to the UNDRR 13-point checklist and derive a rolled-up
 * status per item. Item 11 (accessibility checker passes) derives its
 * status from the overall verdict since we ARE the checker.
 *
 * @param {object[]} findings - Array of Finding objects
 * @returns {Array<{ undrrNumber: number, title: string, status: string, summary: string|null, findings: object[] }>}
 */
export function resolveChecklistStatus(findings) {
  const findingsMap = new Map();
  for (const f of findings) findingsMap.set(f.id, f);

  return UNDRR_CHECKLIST.map((item) => {
    // Item 11: derive from overall verdict (we ARE the checker)
    if (item.undrrNumber === 11) {
      const result = resolveItem11Status(findings);
      return {
        undrrNumber: item.undrrNumber,
        title: item.title,
        status: result.status,
        summary: result.summary,
        findings: [],
      };
    }

    const result = resolveItemResult(item, findingsMap);
    return {
      undrrNumber: item.undrrNumber,
      title: item.title,
      status: result.status,
      summary: result.summary,
      findings: item.findingIds
        .map((fid) => findingsMap.get(fid))
        .filter(Boolean),
    };
  });
}

/**
 * Derive item 11 status from overall findings.
 * If there are any fail findings, this item fails. If only warnings, it's a warning.
 * If all pass, it passes. If no findings, it's not-checked.
 */
function resolveItem11Status(findings) {
  if (findings.length === 0) return { status: 'not-checked', summary: null };

  const hasFail = findings.some((f) => f.status === 'fail');
  const hasWarning = findings.some((f) => f.status === 'warning');
  const failCount = findings.filter((f) => f.status === 'fail').length;
  const warnCount = findings.filter((f) => f.status === 'warning').length;
  const passCount = findings.filter((f) => f.status === 'pass').length;

  if (hasFail) {
    return { status: 'fail', summary: `${failCount} issue${failCount !== 1 ? 's' : ''} found by this checker.` };
  }
  if (hasWarning) {
    return { status: 'warning', summary: `${warnCount} warning${warnCount !== 1 ? 's' : ''} found. ${passCount} checks passed.` };
  }
  return { status: 'pass', summary: `All ${passCount} automated checks passed.` };
}

/**
 * Get the UNDRR checklist item that a finding belongs to.
 *
 * @param {string} findingId
 * @returns {object|null} The UNDRR_CHECKLIST entry, or null for additional findings
 */
export function getUndrrItemForFinding(findingId) {
  return UNDRR_CHECKLIST.find((item) => item.findingIds.includes(findingId)) || null;
}

/**
 * Get findings that are not mapped to any UNDRR checklist item.
 *
 * @param {object[]} findings - Array of Finding objects
 * @returns {object[]} Findings not in the 13-point checklist
 */
export function getAdditionalFindings(findings) {
  return findings.filter((f) => !MAPPED_FINDING_IDS.has(f.id));
}
