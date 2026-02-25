/**
 * Developer test PDF presets — curated CORS-friendly PDFs for testing.
 *
 * All URLs use cdn.jsdelivr.net which serves with:
 * - Access-Control-Allow-Origin: *
 * - Proper content-type: application/pdf
 * - Long cache (604800s)
 *
 * Sources and licenses:
 *
 * - veraPDF PDF/UA-1 test corpus (staging branch)
 *   https://github.com/veraPDF/veraPDF-corpus
 *   License: CC BY 4.0 / GPLv3+ (dual-licensed)
 *   Atomic pass/fail test files for PDF/UA-1 (ISO 14289-1) clauses.
 *
 * - PDF Association "Techniques for Accessible PDF"
 *   https://github.com/pdf-association/techniques-for-accessible-pdf
 *   License: CC BY 4.0
 *   Real-world accessible/inaccessible PDF technique demonstrations.
 *
 * - Open Preservation Foundation "Cabinet of Horrors" format corpus
 *   https://github.com/openpreserve/format-corpus
 *   License: CC0 1.0 (public domain)
 *   Edge-case PDFs: encryption, corruption, font embedding variants.
 */

/** @typedef {{ name: string, url: string, expect: 'pass'|'fail'|'mixed'|'error', category: string }} TestPdf */

/** Base URLs for CORS-friendly CDN access. */
const VERAPDF = 'https://cdn.jsdelivr.net/gh/veraPDF/veraPDF-corpus@staging/PDF_UA-1';
const PDFA = 'https://cdn.jsdelivr.net/gh/pdf-association/techniques-for-accessible-pdf@main';
const HORRORS = 'https://cdn.jsdelivr.net/gh/openpreserve/format-corpus@master/pdfCabinetOfHorrors';

/** @type {TestPdf[]} */
export const testPdfs = [
  // --- Metadata ---
  {
    name: 'Title set (pass)',
    url: `${VERAPDF}/7.1%20General/7.1-t04-pass-a.pdf`,
    expect: 'pass',
    category: 'Metadata',
  },
  {
    name: 'Title missing (fail)',
    url: `${VERAPDF}/7.1%20General/7.1-t04-fail-a.pdf`,
    expect: 'fail',
    category: 'Metadata',
  },
  {
    name: 'Language set (pass)',
    url: `${VERAPDF}/7.1%20General/7.1-t03-pass-a.pdf`,
    expect: 'pass',
    category: 'Metadata',
  },
  {
    name: 'Language missing (fail)',
    url: `${VERAPDF}/7.1%20General/7.1-t03-fail-a.pdf`,
    expect: 'fail',
    category: 'Metadata',
  },
  {
    name: 'DisplayDocTitle set (pass)',
    url: `${VERAPDF}/7.1%20General/7.1-t06-pass-a.pdf`,
    expect: 'pass',
    category: 'Metadata',
  },
  {
    name: 'DisplayDocTitle missing (fail)',
    url: `${VERAPDF}/7.1%20General/7.1-t06-fail-a.pdf`,
    expect: 'fail',
    category: 'Metadata',
  },

  // --- Structure ---
  {
    name: 'Tagged PDF (pass)',
    url: `${VERAPDF}/7.1%20General/7.1-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Structure',
  },
  {
    name: 'Not tagged (fail)',
    url: `${VERAPDF}/7.1%20General/7.1-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Structure',
  },
  {
    name: 'Role map correct (pass)',
    url: `${PDFA}/fundamentals/1-basic-technical-rules/G1_01-Custom-tag-correctly-role-mapped/UA1_Tpdf-G1_01.pdf`,
    expect: 'pass',
    category: 'Structure',
  },
  {
    name: 'Role map missing (fail)',
    url: `${PDFA}/fundamentals/1-basic-technical-rules/G1_F01-Custom-tag-role-map-missing/UA1_Tpdf-G1_F01.pdf`,
    expect: 'fail',
    category: 'Structure',
  },

  // --- Headings ---
  {
    name: 'Headings H1-H6 (pass)',
    url: `${PDFA}/headings/H_03-Headings-with-different-levels-correctly-tagged/UA1_Tpdf-H_03.pdf`,
    expect: 'pass',
    category: 'Headings',
  },
  {
    name: 'Heading level skipped (fail)',
    url: `${PDFA}/headings/H_F08-Heading-level-incorrectly-skipped/UA1_Tpdf-H_F08.pdf`,
    expect: 'fail',
    category: 'Headings',
  },
  {
    name: 'First heading is H3 (fail)',
    url: `${PDFA}/headings/H_F05-First-level-heading-incorrectly-tagged-as-H3-instead-of-H1/UA1_Tpdf-H_F05.pdf`,
    expect: 'fail',
    category: 'Headings',
  },

  // --- Images ---
  {
    name: 'Figure with alt text (pass)',
    url: `${VERAPDF}/7.3%20Graphics/7.3-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Images',
  },
  {
    name: 'Figure missing alt text (fail)',
    url: `${VERAPDF}/7.3%20Graphics/7.3-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Images',
  },

  // --- Tables ---
  {
    name: 'Table with headers (pass)',
    url: `${VERAPDF}/7.5%20Tables/7.5-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Tables',
  },
  {
    name: 'Table missing headers (fail)',
    url: `${VERAPDF}/7.5%20Tables/7.5-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Tables',
  },

  // --- Lists ---
  {
    name: 'Unordered list (pass)',
    url: `${PDFA}/list/L_01-Unordered-list/UA1_Tpdf-L_01.pdf`,
    expect: 'pass',
    category: 'Lists',
  },
  {
    name: 'List missing LBody (fail)',
    url: `${PDFA}/list/L_F05-List-with-missing-LBody/UA1_Tpdf-L_F05.pdf`,
    expect: 'fail',
    category: 'Lists',
  },
  {
    name: 'List tagged as paragraphs (fail)',
    url: `${PDFA}/list/L_F06-List-incorrectly-tagged-as-P/UA1_Tpdf-L_F06.pdf`,
    expect: 'fail',
    category: 'Lists',
  },

  // --- Fonts ---
  {
    name: 'Fonts embedded (pass)',
    url: `${VERAPDF}/7.21%20Fonts/7.21.4%20Embedding/7.21.4.1%20General/7.21.4.1-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Fonts',
  },
  {
    name: 'Fonts not embedded (fail)',
    url: `${VERAPDF}/7.21%20Fonts/7.21.4%20Embedding/7.21.4.1%20General/7.21.4.1-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Fonts',
  },
  {
    name: 'ToUnicode CMap (pass)',
    url: `${VERAPDF}/7.21%20Fonts/7.21.7%20Unicode%20character%20maps/7.21.7-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Fonts',
  },
  {
    name: 'ToUnicode CMap missing (fail)',
    url: `${VERAPDF}/7.21%20Fonts/7.21.7%20Unicode%20character%20maps/7.21.7-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Fonts',
  },

  // --- Security ---
  {
    name: 'Accessibility allowed (pass)',
    url: `${VERAPDF}/7.16%20Security/7.16-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Security',
  },
  {
    name: 'Accessibility denied (fail)',
    url: `${VERAPDF}/7.16%20Security/7.16-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Security',
  },

  // --- Forms ---
  {
    name: 'Form field in structure (pass)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.4%20Forms/7.18.4-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Forms',
  },
  {
    name: 'Form field not in structure (fail)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.4%20Forms/7.18.4-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Forms',
  },
  {
    name: 'Form TU tooltip set (pass)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.1%20General/7.18.1-t03-pass-a.pdf`,
    expect: 'pass',
    category: 'Forms',
  },
  {
    name: 'Form TU tooltip missing (fail)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.1%20General/7.18.1-t03-fail-a.pdf`,
    expect: 'fail',
    category: 'Forms',
  },

  // --- Links ---
  {
    name: 'Link with tagged content (pass)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.5%20Links/7.18.5-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Links',
  },
  {
    name: 'Link missing tagged content (fail)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.5%20Links/7.18.5-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Links',
  },
  {
    name: 'Link alt text set (pass)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.5%20Links/7.18.5-t02-pass-a.pdf`,
    expect: 'pass',
    category: 'Links',
  },
  {
    name: 'Link alt text missing (fail)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.5%20Links/7.18.5-t02-fail-a.pdf`,
    expect: 'fail',
    category: 'Links',
  },

  // --- Tab Order ---
  {
    name: 'Tab order set (pass)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.3%20Tab%20order/7-18.3-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'Tab Order',
  },
  {
    name: 'Tab order not set (fail)',
    url: `${VERAPDF}/7.18%20Annotations/7.18.3%20Tab%20order/7.18.3-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'Tab Order',
  },

  // --- PDF/UA Conformance ---
  {
    name: 'PDF/UA marker present (pass)',
    url: `${VERAPDF}/5%20Version%20identification/5-t01-pass-a.pdf`,
    expect: 'pass',
    category: 'PDF/UA Conformance',
  },
  {
    name: 'PDF/UA marker missing (fail)',
    url: `${VERAPDF}/5%20Version%20identification/5-t01-fail-a.pdf`,
    expect: 'fail',
    category: 'PDF/UA Conformance',
  },

  // --- Edge Cases ---
  {
    name: 'Fonts not embedded at all',
    url: `${HORRORS}/text_only_fontsNotEmbedded.pdf`,
    expect: 'mixed',
    category: 'Edge Cases',
  },
  {
    name: 'PDF/A-1b document',
    url: `${HORRORS}/text_only_pdfa1b.pdf`,
    expect: 'mixed',
    category: 'Edge Cases',
  },
  {
    name: 'Corrupted PDF (1 byte missing)',
    url: `${HORRORS}/corruptionOneByteMissing.pdf`,
    expect: 'error',
    category: 'Edge Cases',
  },
];

/**
 * Get test PDFs grouped by category.
 * @returns {Map<string, TestPdf[]>}
 */
export function getTestPdfsByCategory() {
  const groups = new Map();
  for (const pdf of testPdfs) {
    if (!groups.has(pdf.category)) {
      groups.set(pdf.category, []);
    }
    groups.get(pdf.category).push(pdf);
  }
  return groups;
}

/**
 * Fetch a test PDF and return it as a File object.
 * @param {TestPdf} testPdf
 * @returns {Promise<File>}
 */
export async function fetchTestPdf(testPdf) {
  const response = await fetch(testPdf.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${testPdf.name}: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  // Derive a filename from the URL's last path segment
  const urlPath = new URL(testPdf.url).pathname;
  const fileName = decodeURIComponent(urlPath.split('/').pop());
  return new File([buffer], fileName, { type: 'application/pdf' });
}
