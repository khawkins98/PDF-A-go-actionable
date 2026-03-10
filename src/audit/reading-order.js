/**
 * Reading order audit module.
 *
 * Manual review checks #11, #13.
 * Returns manual-status findings with guidance text.
 * Inspects the PDF for context-specific details (form tab order, headings).
 * PAC validation (formerly #12) is covered by the pdfua-conformance finding in metadata.js.
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';
import { getRemediation } from '../guidance.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkReadingOrder(pdfDoc, ctx) {
  const { traits, context, roleMap } = ctx;

  // Collect context-specific details for the reading-order finding
  const extraDetails = [];

  // Check for form fields without /Tabs /S
  try {
    const catalog = pdfDoc.catalog;
    const acroFormRef = catalog.get(PDFName.of('AcroForm'));
    if (acroFormRef) {
      const acroForm = resolve(acroFormRef, context);
      if (acroForm instanceof PDFDict) {
        const fields = acroForm.get(PDFName.of('Fields'));
        const resolvedFields = fields ? resolve(fields, context) : null;
        const hasFields = resolvedFields instanceof PDFArray && resolvedFields.size() > 0;

        if (hasFields) {
          const pages = pdfDoc.getPages();
          const allHaveTabs = pages.every(p => {
            const tabs = p.node.get(PDFName.of('Tabs'));
            return tabs && tabs.toString() === '/S';
          });
          if (!allHaveTabs) {
            extraDetails.push({
              label: 'Form tab order',
              value: 'This document has form fields but not all pages set /Tabs /S. Form field tab order may not follow the document structure. Set tab order to "Use Document Structure" for all pages.',
            });
          }
        }
      }
    }
  } catch (_) {
    // Non-critical — skip form tab order check if anything goes wrong
  }

  // Check for documents with no headings
  try {
    if (traits.hasStructTree) {
      let hasHeadings = false;
      const headingRoles = new Set(['H', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

      for (const [, obj] of context.enumerateIndirectObjects()) {
        if (hasHeadings) break;
        if (!(obj instanceof PDFDict)) continue;
        const s = obj.get(PDFName.of('S'));
        if (!s) continue;
        const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
        const resolved = resolveRole(typeName, roleMap);
        if (headingRoles.has(resolved)) hasHeadings = true;
      }

      if (!hasHeadings) {
        extraDetails.push({
          label: 'No headings found',
          value: 'This document has no heading elements (H1-H6). Without headings as landmarks, reading order is harder to assess. Consider adding headings to provide document structure.',
        });
      }
    }
  } catch (_) {
    // Non-critical — skip heading check if anything goes wrong
  }

  const baseDetails = [
    { label: 'What to check', value: 'Content should follow a logical reading sequence: headings before body text, table headers before data cells, multi-column layouts left-to-right then top-to-bottom.' },
    { label: 'How to check', value: 'Use the Structure Tree explorer in this tool to review tag order. Elements are listed in reading order.' },
    ...extraDetails,
  ];

  return [
    {
      id: 'color-contrast',
      category: 'reading-order',
      title: 'Color Contrast',
      status: 'manual',
      summary: 'Verify that all text meets minimum contrast ratios. Automated tools cannot reliably check contrast in PDF content streams.',
      details: [
        { label: 'WCAG requirement', value: 'Normal text: 4.5:1 contrast ratio. Large text (18pt or 14pt bold): 3:1 ratio.' },
        { label: 'How to check', value: 'Use the Colour Contrast Analyser (free, Windows/macOS) or inspect colors in Acrobat Pro. Check body text, headings, link text, and text over images or colored backgrounds.' },
      ],
      remediation: getRemediation('color-contrast'),
      wcagRef: '1.4.3',
      pdfuaRef: null,
    },
    {
      id: 'reading-order',
      category: 'reading-order',
      title: 'Logical Reading Order',
      status: 'manual',
      summary: 'Reading order must be verified manually. Use the Structure Tree panel to review element order and compare it to the visual layout.',
      details: baseDetails,
      remediation: getRemediation('reading-order'),
      wcagRef: '1.3.2',
      pdfuaRef: '7.2',
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
      remediation: getRemediation('screen-reader-test'),
      wcagRef: '1.3.2',
      pdfuaRef: null,
    },
  ];
}
