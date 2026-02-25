/**
 * Reading order audit module.
 *
 * Manual review checks #11, #12, #13.
 * Returns manual-status findings with guidance text.
 */

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkReadingOrder(pdfDoc, ctx) {
  return [
    {
      id: 'reading-order',
      category: 'reading-order',
      title: 'Logical Reading Order',
      status: 'manual',
      summary: 'Reading order must be verified manually. Use the Structure Tree panel to review element order and compare it to the visual layout.',
      details: [
        { label: 'What to check', value: 'Content should follow a logical reading sequence: headings before body text, table headers before data cells, multi-column layouts left-to-right then top-to-bottom.' },
        { label: 'How to check', value: 'Use the Structure Tree explorer in this tool to review tag order. Elements are listed in reading order.' },
      ],
      remediation: 'If reading order is wrong, fix it in the authoring tool by adjusting the tag order. In Acrobat: View > Navigation Panels > Order, then drag items to reorder. In Word: make sure content is in order in the document (text boxes can break flow).',
      wcagRef: '1.3.2',
      pdfuaRef: '7.2',
    },
    {
      id: 'pac-validation',
      category: 'reading-order',
      title: 'PAC Validation',
      status: 'manual',
      summary: 'Run the document through PAC (PDF Accessibility Checker) for full PDF/UA validation.',
      details: [
        { label: 'Download PAC', value: 'https://pac.pdf-accessibility.org/' },
        { label: 'Note', value: 'PAC is Windows-only. Use Wine on macOS/Linux, or the online version at https://pac.pdf-accessibility.org/en/pac-online' },
      ],
      remediation: 'Download and install PAC, then open your PDF in it. Fix any errors PAC reports.',
      wcagRef: null,
      pdfuaRef: null,
    },
    {
      id: 'screen-reader-test',
      category: 'reading-order',
      title: 'Screen Reader Testing',
      status: 'manual',
      summary: 'Test the document with a screen reader. Check that content is read in the right order and all elements are announced.',
      details: [
        { label: 'NVDA (Windows)', value: 'https://www.nvaccess.org/download/' },
        { label: 'VoiceOver (macOS)', value: 'Built-in: System Settings > Accessibility > VoiceOver' },
        { label: 'Testing tip', value: 'Open the PDF in Acrobat Reader or a browser, turn on the screen reader, and listen to the whole document. Pay attention to heading announcements, image alt text, table navigation, form field labels, and link text.' },
      ],
      remediation: 'If the screen reader reads content in the wrong order or misses elements, fix the tag structure and reading order in your authoring tool.',
      wcagRef: '1.3.2',
      pdfuaRef: null,
    },
  ];
}
