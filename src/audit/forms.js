/**
 * Forms audit module.
 *
 * Informational:
 * - Form field labeling (AcroForm fields with /TU tooltips)
 * - Tab order set to structure (/Tabs /S on pages)
 */
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkForms(pdfDoc, ctx) {
  const { context } = ctx;
  const findings = [];

  // Check AcroForm fields
  const catalog = pdfDoc.catalog;
  const acroFormRef = catalog.get(PDFName.of('AcroForm'));

  if (acroFormRef) {
    const acroForm = resolve(acroFormRef, context);
    if (acroForm instanceof PDFDict) {
      const fields = acroForm.get(PDFName.of('Fields'));
      if (fields) {
        const fieldResults = checkFieldLabels(resolve(fields, context), context);
        findings.push(fieldResults);
      } else {
        findings.push({
          id: 'form-labels',
          category: 'forms',
          title: 'Form Field Labels',
          status: 'not-applicable',
          summary: 'AcroForm present but no fields found.',
          details: [],
          remediation: null,
          wcagRef: '3.3.2',
          pdfuaRef: '7.18',
        });
      }
    }
  } else {
    findings.push({
      id: 'form-labels',
      category: 'forms',
      title: 'Form Field Labels',
      status: 'not-applicable',
      summary: 'No form fields in this document.',
      details: [],
      remediation: null,
      wcagRef: '3.3.2',
      pdfuaRef: '7.18',
    });
  }

  // Check tab order on pages
  const tabOrderResult = checkTabOrder(pdfDoc);
  findings.push(tabOrderResult);

  return findings;
}

/**
 * Recursively collect leaf form fields, following /Kids arrays.
 * Leaf fields are those with /FT or without /Kids.
 * @param {PDFArray} fieldsArray
 * @param {object} context
 * @param {object[]} results - accumulated leaf fields
 * @param {number} depth - recursion depth cap
 */
function collectLeafFields(fieldsArray, context, results, depth = 0) {
  if (depth > 20 || !(fieldsArray instanceof PDFArray)) return;

  for (let i = 0; i < fieldsArray.size(); i++) {
    const field = resolve(fieldsArray.get(i), context);
    if (!(field instanceof PDFDict)) continue;

    const kids = field.get(PDFName.of('Kids'));
    if (kids) {
      const kidsResolved = resolve(kids, context);
      if (kidsResolved instanceof PDFArray) {
        collectLeafFields(kidsResolved, context, results, depth + 1);
        continue;
      }
    }

    // Leaf field (has /FT or no /Kids)
    results.push(field);
  }
}

/**
 * Check form field labels (TU tooltip) for AcroForm fields.
 * Traverses nested /Kids to find leaf fields.
 */
function checkFieldLabels(fieldsArray, context) {
  if (!(fieldsArray instanceof PDFArray)) {
    return {
      id: 'form-labels',
      category: 'forms',
      title: 'Form Field Labels',
      status: 'not-applicable',
      summary: 'No form fields found.',
      details: [],
      remediation: null,
      wcagRef: '3.3.2',
      pdfuaRef: '7.18',
    };
  }

  const leafFields = [];
  collectLeafFields(fieldsArray, context, leafFields);

  let total = 0;
  let withTU = 0;
  const details = [];

  for (const field of leafFields) {
    total++;
    const nameObj = field.get(PDFName.of('T'));
    const name = nameObj ? nameObj.decodeText() : `Field ${total}`;

    const tu = field.get(PDFName.of('TU'));
    if (tu) {
      withTU++;
      details.push({ label: name, value: `Tooltip: "${tu.decodeText()}"` });
    } else {
      details.push({ label: name, value: 'Missing tooltip (/TU)' });
    }
  }

  if (total === 0) {
    return {
      id: 'form-labels',
      category: 'forms',
      title: 'Form Field Labels',
      status: 'not-applicable',
      summary: 'No form fields found.',
      details: [],
      remediation: null,
      wcagRef: '3.3.2',
      pdfuaRef: '7.18',
    };
  }

  const missing = total - withTU;
  return {
    id: 'form-labels',
    category: 'forms',
    title: 'Form Field Labels',
    status: missing === 0 ? 'pass' : 'fail',
    summary: missing === 0
      ? `All ${total} form field(s) have tooltip labels.`
      : `${missing} of ${total} form field(s) missing tooltip labels (/TU).`,
    details,
    remediation: missing === 0
      ? null
      : 'Add tooltip text to each form field. In InDesign: select the form field > Object > Interactive > set Description (this becomes the /TU tooltip). In Acrobat: Form Editing > right-click field > Properties > General > Tooltip. The tooltip is read by screen readers as the field label.',
    wcagRef: '3.3.2',
    pdfuaRef: '7.18',
  };
}

/**
 * Check if pages have /Tabs /S (tab order follows structure).
 */
function checkTabOrder(pdfDoc) {
  const pages = pdfDoc.getPages();
  let withTabsS = 0;
  let total = pages.length;

  for (const page of pages) {
    const tabs = page.node.get(PDFName.of('Tabs'));
    if (tabs && tabs.toString() === '/S') {
      withTabsS++;
    }
  }

  if (total === 0) {
    return {
      id: 'tab-order',
      category: 'forms',
      title: 'Tab Order',
      status: 'not-applicable',
      summary: 'No pages in document.',
      details: [],
      remediation: null,
      wcagRef: '2.4.3',
      pdfuaRef: null,
    };
  }

  const missing = total - withTabsS;
  return {
    id: 'tab-order',
    category: 'forms',
    title: 'Tab Order',
    status: missing === 0 ? 'pass' : 'fail',
    summary: missing === 0
      ? `All ${total} page(s) have tab order set to structure order (/Tabs /S).`
      : `${missing} of ${total} page(s) missing /Tabs /S. Tab order may not follow reading order.`,
    details: [
      { label: 'Pages with /Tabs /S', value: `${withTabsS} of ${total}` },
    ],
    remediation: missing === 0
      ? null
      : 'Set tab order to "Use Document Structure" for all pages. Note: InDesign does not set tab order — this must be done after export. In Acrobat: All Tools > Organize Pages, select a page thumbnail, then Page Properties > Tab Order > Use Document Structure. For tagged PDFs this is the recommended setting (see helpx.adobe.com/acrobat/using/page-thumbnails-bookmarks-pdfs.html).',
    wcagRef: '2.4.3',
    pdfuaRef: null,
  };
}
