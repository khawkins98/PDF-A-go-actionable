/**
 * PDF fixture factories using pdf-lib.
 *
 * Each factory creates a PDF with specific characteristics, saves it,
 * and returns the bytes as a Uint8Array. Used by audit module tests.
 *
 * Pattern:
 * 1. Create doc with PDFDocument.create()
 * 2. Add a page
 * 3. Manually set MarkInfo, StructTreeRoot, StructElems via context
 * 4. Save with doc.save() to get bytes
 * 5. Return the bytes
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
} from 'pdf-lib';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add MarkInfo << /Marked true >> to the catalog.
 */
function addMarkInfo(doc) {
  const markInfo = doc.context.obj({ Marked: true });
  doc.catalog.set(PDFName.of('MarkInfo'), markInfo);
}

/**
 * Create a StructTreeRoot, register it, and set it on the catalog.
 * Returns { structTreeRoot, structTreeRootRef }.
 */
function addStructTreeRoot(doc) {
  const structTreeRoot = doc.context.obj({ Type: 'StructTreeRoot' });
  const structTreeRootRef = doc.context.register(structTreeRoot);
  doc.catalog.set(PDFName.of('StructTreeRoot'), structTreeRootRef);
  return { structTreeRoot, structTreeRootRef };
}

/**
 * Create a StructElem dict and register it.
 * @param {object} doc - PDFDocument
 * @param {string} structType - e.g. 'H1', 'P', 'Figure'
 * @param {import('pdf-lib').PDFRef} parentRef - ref to parent element
 * @param {object} [extras] - additional dict entries (e.g. { Alt: PDFString.of('...') })
 * @returns {{ elem, elemRef }}
 */
function createStructElem(doc, structType, parentRef, extras = {}) {
  const entries = {
    Type: 'StructElem',
    S: PDFName.of(structType),
    P: parentRef,
    ...extras,
  };
  const elem = doc.context.obj(entries);
  const elemRef = doc.context.register(elem);
  return { elem, elemRef };
}

// ---------------------------------------------------------------------------
// Factory: Untagged PDF
// ---------------------------------------------------------------------------

/**
 * Basic PDF with a page, no tags whatsoever.
 */
export async function createUntaggedPdf() {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: Tagged PDF
// ---------------------------------------------------------------------------

/**
 * Create a tagged PDF with:
 * - MarkInfo << /Marked true >>
 * - StructTreeRoot with a Document > P structure element
 * - /Lang (en-US) on catalog
 * - Title in info dict
 */
export async function createTaggedPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage();

  // Title
  doc.setTitle('Test Tagged Document');

  // Language
  doc.catalog.set(PDFName.of('Lang'), PDFString.of('en-US'));

  // MarkInfo
  addMarkInfo(doc);

  // StructTreeRoot
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // P element under Document
  const { elemRef: pElemRef } = createStructElem(
    doc, 'P', docElemRef,
  );

  // Wire children
  docElem.set(PDFName.of('K'), doc.context.obj([pElemRef]));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with title
// ---------------------------------------------------------------------------

export async function createPdfWithTitle(title = 'Test Document') {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setTitle(title);
  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with language
// ---------------------------------------------------------------------------

export async function createPdfWithLang(lang = 'en-US') {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));
  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with headings
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with StructElems of the given heading types in order.
 * @param {string[]} headingTypes - e.g. ['H1', 'H2', 'H3']
 */
export async function createPdfWithHeadings(headingTypes = ['H1', 'H2', 'H3']) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element as the root container
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // Heading elements under Document
  const headingRefs = headingTypes.map((type) => {
    const { elemRef } = createStructElem(doc, type, docElemRef);
    return elemRef;
  });

  docElem.set(PDFName.of('K'), doc.context.obj(headingRefs));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with heading skip
// ---------------------------------------------------------------------------

/**
 * Creates headings H1, H3 (skipping H2) to test heading hierarchy check.
 */
export async function createPdfWithHeadingSkip() {
  return createPdfWithHeadings(['H1', 'H3']);
}

// ---------------------------------------------------------------------------
// Factory: PDF with RoleMap
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with a RoleMap and StructElems using custom types.
 * @param {object} customMappings - e.g. { Heading1: 'H1', Slide: 'Sect' }
 */
export async function createPdfWithRoleMap(customMappings = { Heading1: 'H1', Slide: 'Sect' }) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Build RoleMap dict
  const roleMapEntries = {};
  for (const [custom, standard] of Object.entries(customMappings)) {
    roleMapEntries[custom] = PDFName.of(standard);
  }
  const roleMapDict = doc.context.obj(roleMapEntries);
  structTreeRoot.set(PDFName.of('RoleMap'), roleMapDict);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // Create StructElems with the custom types
  const childRefs = Object.keys(customMappings).map((customType) => {
    const { elemRef } = createStructElem(doc, customType, docElemRef);
    return elemRef;
  });

  docElem.set(PDFName.of('K'), doc.context.obj(childRefs));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with figures (images)
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with Figure StructElems, some with /Alt, some without.
 * @param {Array<{hasAlt: boolean, alt?: string}>} figures
 */
export async function createPdfWithFigures(figures = [{ hasAlt: true, alt: 'A chart' }, { hasAlt: false }]) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // Figure elements
  const figureRefs = figures.map((fig) => {
    const extras = {};
    if (fig.hasAlt && fig.alt) {
      extras.Alt = PDFHexString.fromText(fig.alt);
    }
    const { elemRef } = createStructElem(doc, 'Figure', docElemRef, extras);
    return elemRef;
  });

  docElem.set(PDFName.of('K'), doc.context.obj(figureRefs));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with table
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with Table > TR > TH/TD structure.
 * @param {object} options
 * @param {boolean} options.hasTH - Include TH header cells
 * @param {boolean} options.hasScope - Add /Scope attribute to TH cells
 */
export async function createPdfWithTable(options = { hasTH: true, hasScope: true }) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // Table element
  const { elem: tableElem, elemRef: tableRef } = createStructElem(
    doc, 'Table', docElemRef,
  );

  // Header row (TR with TH cells)
  const { elem: headerRow, elemRef: headerRowRef } = createStructElem(
    doc, 'TR', tableRef,
  );

  const headerCellRefs = [];
  if (options.hasTH) {
    for (let i = 0; i < 2; i++) {
      const extras = {};
      if (options.hasScope) {
        // Add /A attribute dict with /Scope
        const attrDict = doc.context.obj({
          O: PDFName.of('Table'),
          Scope: PDFName.of('Column'),
        });
        extras.A = doc.context.register(attrDict);
      }
      const { elemRef: thRef } = createStructElem(doc, 'TH', headerRowRef, extras);
      headerCellRefs.push(thRef);
    }
  } else {
    // No TH — use TD for header row too
    for (let i = 0; i < 2; i++) {
      const { elemRef: tdRef } = createStructElem(doc, 'TD', headerRowRef);
      headerCellRefs.push(tdRef);
    }
  }
  headerRow.set(PDFName.of('K'), doc.context.obj(headerCellRefs));

  // Data row (TR with TD cells)
  const { elem: dataRow, elemRef: dataRowRef } = createStructElem(
    doc, 'TR', tableRef,
  );

  const dataCellRefs = [];
  for (let i = 0; i < 2; i++) {
    const { elemRef: tdRef } = createStructElem(doc, 'TD', dataRowRef);
    dataCellRefs.push(tdRef);
  }
  dataRow.set(PDFName.of('K'), doc.context.obj(dataCellRefs));

  // Wire table children
  tableElem.set(PDFName.of('K'), doc.context.obj([headerRowRef, dataRowRef]));
  docElem.set(PDFName.of('K'), doc.context.obj([tableRef]));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with list
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with L > LI > Lbl + LBody structure.
 * @param {object} options
 * @param {boolean} options.hasLBody - Include LBody in list items
 */
export async function createPdfWithList(options = { hasLBody: true }) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // L (list) element
  const { elem: listElem, elemRef: listRef } = createStructElem(
    doc, 'L', docElemRef,
  );

  // Two list items
  const liRefs = [];
  for (let i = 0; i < 2; i++) {
    const { elem: liElem, elemRef: liRef } = createStructElem(
      doc, 'LI', listRef,
    );

    const liChildren = [];

    // Always add Lbl (label)
    const { elemRef: lblRef } = createStructElem(doc, 'Lbl', liRef);
    liChildren.push(lblRef);

    // Optionally add LBody
    if (options.hasLBody) {
      const { elemRef: lBodyRef } = createStructElem(doc, 'LBody', liRef);
      liChildren.push(lBodyRef);
    }

    liElem.set(PDFName.of('K'), doc.context.obj(liChildren));
    liRefs.push(liRef);
  }

  listElem.set(PDFName.of('K'), doc.context.obj(liRefs));
  docElem.set(PDFName.of('K'), doc.context.obj([listRef]));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with bookmarks
// ---------------------------------------------------------------------------

/**
 * Creates a PDF with /Outlines (bookmarks).
 */
export async function createPdfWithBookmarks() {
  const doc = await PDFDocument.create();
  const page = doc.addPage();

  // Create an outline entry
  const outlineItem = doc.context.obj({
    Title: PDFString.of('Chapter 1'),
    Dest: doc.context.obj([page.ref, PDFName.of('Fit')]),
  });
  const outlineItemRef = doc.context.register(outlineItem);

  // Create the outlines dict
  const outlines = doc.context.obj({
    Type: 'Outlines',
    First: outlineItemRef,
    Last: outlineItemRef,
    Count: 1,
  });
  const outlinesRef = doc.context.register(outlines);

  // Wire parent on the item
  outlineItem.set(PDFName.of('Parent'), outlinesRef);

  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with forms
// ---------------------------------------------------------------------------

/**
 * Creates a PDF with AcroForm and fields, optionally with /TU tooltips.
 * @param {object} options
 * @param {boolean} options.hasTU - Add /TU tooltip to fields
 */
export async function createPdfWithForms(options = { hasTU: true }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();

  // Create form fields
  const fieldDicts = [];
  for (let i = 0; i < 2; i++) {
    const fieldEntries = {
      Type: 'Annot',
      Subtype: PDFName.of('Widget'),
      FT: PDFName.of('Tx'),
      T: PDFString.of(`field_${i + 1}`),
      Rect: doc.context.obj([0, 0, 100, 20]),
    };
    if (options.hasTU) {
      fieldEntries.TU = PDFString.of(`Tooltip for field ${i + 1}`);
    }
    const field = doc.context.obj(fieldEntries);
    const fieldRef = doc.context.register(field);
    fieldDicts.push(fieldRef);
  }

  // Create AcroForm
  const acroForm = doc.context.obj({
    Fields: doc.context.obj(fieldDicts),
  });
  const acroFormRef = doc.context.register(acroForm);
  doc.catalog.set(PDFName.of('AcroForm'), acroFormRef);

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with links
// ---------------------------------------------------------------------------

/**
 * Creates a tagged PDF with Link StructElems with ActualText.
 * @param {string[]} linkTexts - Text for each link
 */
export async function createPdfWithLinks(linkTexts = ['Click here', 'Learn more about our services']) {
  const doc = await PDFDocument.create();
  doc.addPage();

  addMarkInfo(doc);
  const { structTreeRoot, structTreeRootRef } = addStructTreeRoot(doc);

  // Document element
  const { elem: docElem, elemRef: docElemRef } = createStructElem(
    doc, 'Document', structTreeRootRef,
  );

  // Link elements
  const linkRefs = linkTexts.map((text) => {
    const extras = {
      ActualText: PDFHexString.fromText(text),
    };
    const { elemRef } = createStructElem(doc, 'Link', docElemRef, extras);
    return elemRef;
  });

  docElem.set(PDFName.of('K'), doc.context.obj(linkRefs));
  structTreeRoot.set(PDFName.of('K'), doc.context.obj([docElemRef]));

  return doc.save();
}

// ---------------------------------------------------------------------------
// Factory: PDF with tab order
// ---------------------------------------------------------------------------

/**
 * Creates a PDF with /Tabs /S on pages (or without).
 * @param {boolean} tabsS - Whether to set /Tabs /S on the page
 */
export async function createPdfWithTabOrder(tabsS = true) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();

  if (tabsS) {
    page.node.set(PDFName.of('Tabs'), PDFName.of('S'));
  }

  return doc.save();
}
