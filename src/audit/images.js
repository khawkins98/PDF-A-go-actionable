/**
 * Images audit module.
 *
 * Checks:
 * #6 — All meaningful images have alt text (Figure StructElems with /Alt)
 * #7 — Decorative images flagged for review
 */
import { PDFName, PDFDict, PDFStream } from 'pdf-lib';
import { resolve } from '../engine/utils/resolve.js';
import { resolveRole } from '../engine/utils/role-map.js';

/** Generic alt text patterns (case-insensitive match). */
const GENERIC_ALT_TEXT = [
  'image',
  'photo',
  'picture',
  'graphic',
  'figure',
  'icon',
  'logo',
  'img',
  'screenshot',
  'illustration',
  'diagram',
  'chart',
];

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {object} ctx - Shared context from runner
 * @returns {object[]} Array of Finding objects
 */
export function checkImages(pdfDoc, ctx) {
  const { traits, roleMap, context } = ctx;
  const findings = [];

  if (!traits.hasStructTree) {
    // Count images even without a structure tree
    const imageCount = countImageXObjects(context);

    if (imageCount === 0) {
      findings.push({
        id: 'image-alt-text',
        category: 'images',
        title: 'Image Alt Text',
        status: 'not-applicable',
        summary: 'No images found in the document.',
        details: [],
        remediation: null,
        wcagRef: '1.1.1',
        pdfuaRef: '7.3',
      });
    } else {
      findings.push({
        id: 'image-alt-text',
        category: 'images',
        title: 'Image Alt Text',
        status: 'warning',
        summary: `${imageCount} image(s) found but no structure tree to verify alt text. Cannot check accessibility.`,
        details: [{ label: 'Image XObjects', value: String(imageCount) }],
        remediation: 'Tag the document first, then add alt text to each meaningful image.',
        wcagRef: '1.1.1',
        pdfuaRef: '7.3',
      });
    }

    return findings;
  }

  // Flat scan for Figure StructElems (resolve via RoleMap)
  const figures = [];
  context.enumerateIndirectObjects().forEach(([, obj]) => {
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of('Type'));
    if (type && type.toString() !== '/StructElem') return;

    const s = obj.get(PDFName.of('S'));
    if (!s) return;

    const typeName = s instanceof PDFName ? s.decodeText() : s.toString().replace(/^\//, '');
    const resolved = resolveRole(typeName, roleMap);

    if (resolved !== 'Figure') return;

    const altObj = obj.get(PDFName.of('Alt'));
    const alt = altObj ? altObj.decodeText() : null;

    const trimmedAlt = alt ? alt.trim() : '';
    const isGeneric = trimmedAlt.length > 0 && GENERIC_ALT_TEXT.includes(trimmedAlt.toLowerCase());

    figures.push({
      type: typeName,
      alt,
      hasAlt: !!alt && trimmedAlt.length > 0,
      isGeneric,
    });
  });

  const imageCount = countImageXObjects(context);
  const figuresWithAlt = figures.filter(f => f.hasAlt && !f.isGeneric);
  const figuresWithoutAlt = figures.filter(f => !f.hasAlt);
  const figuresWithGenericAlt = figures.filter(f => f.hasAlt && f.isGeneric);

  // #6 — Alt text coverage
  if (figures.length === 0 && imageCount === 0) {
    findings.push({
      id: 'image-alt-text',
      category: 'images',
      title: 'Image Alt Text',
      status: 'not-applicable',
      summary: 'No images or Figure elements found.',
      details: [],
      remediation: null,
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  } else if (figuresWithoutAlt.length > 0) {
    const details = figuresWithoutAlt.map((f) => ({
      label: 'Figure without alt',
      value: f.type === 'Figure' ? 'No /Alt attribute' : `Custom type "${f.type}" (maps to Figure), no /Alt attribute`,
    }));
    if (figuresWithGenericAlt.length > 0) {
      details.push(...figuresWithGenericAlt.map((f) => ({
        label: 'Generic alt text',
        value: `"${f.alt}" -- not descriptive`,
      })));
    }
    findings.push({
      id: 'image-alt-text',
      category: 'images',
      title: 'Image Alt Text',
      status: 'fail',
      summary: `${figuresWithoutAlt.length} of ${figures.length} Figure element(s) missing alt text.`,
      details,
      remediation: 'Add alt text to each meaningful image. In Word: right-click the image > Edit Alt Text. In Acrobat: Reading Order panel > right-click Figure > Edit Alternate Text.',
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  } else if (figuresWithGenericAlt.length > 0) {
    findings.push({
      id: 'image-alt-text',
      category: 'images',
      title: 'Image Alt Text',
      status: 'warning',
      summary: `${figuresWithGenericAlt.length} of ${figures.length} Figure element(s) have generic alt text that may not be descriptive.`,
      details: figuresWithGenericAlt.map((f, i) => ({
        label: `Figure with generic alt`,
        value: `"${f.alt}" -- use descriptive text instead`,
      })),
      remediation: 'Replace generic alt text (e.g., "image", "photo") with a real description. Say what the image shows or what information it communicates.',
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  } else if (figures.length > 0) {
    findings.push({
      id: 'image-alt-text',
      category: 'images',
      title: 'Image Alt Text',
      status: 'pass',
      summary: `All ${figures.length} Figure element(s) have alt text.`,
      details: figuresWithAlt.map((f, i) => ({
        label: `Figure ${i + 1}`,
        value: f.alt,
      })),
      remediation: null,
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  }

  // #7 — Decorative images (images not in structure tree)
  const unmatchedImages = imageCount - figures.length;
  if (unmatchedImages > 0) {
    findings.push({
      id: 'decorative-images',
      category: 'images',
      title: 'Decorative Images',
      status: 'warning',
      summary: `${unmatchedImages} image XObject(s) not matched to Figure elements. These may be decorative (artifacts) or may need alt text.`,
      details: [
        { label: 'Image XObjects', value: String(imageCount) },
        { label: 'Figure StructElems', value: String(figures.length) },
        { label: 'Unmatched', value: String(unmatchedImages) },
      ],
      remediation: 'Review unmatched images. If decorative, mark them as artifacts in the tag structure. If meaningful, add them as tagged Figure elements with alt text.',
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  } else if (imageCount > 0) {
    findings.push({
      id: 'decorative-images',
      category: 'images',
      title: 'Decorative Images',
      status: 'pass',
      summary: 'All image XObjects have matching entries in the structure tree.',
      details: [],
      remediation: null,
      wcagRef: '1.1.1',
      pdfuaRef: '7.3',
    });
  }

  return findings;
}

/**
 * Count image XObjects via flat scan.
 */
function countImageXObjects(context) {
  let count = 0;
  context.enumerateIndirectObjects().forEach(([, obj]) => {
    if (!(obj instanceof PDFStream)) return;
    const dict = obj instanceof PDFDict ? obj : obj.dict;
    if (!dict) return;
    const subtype = dict.get(PDFName.of('Subtype'));
    if (subtype && subtype.toString() === '/Image') count++;
  });
  return count;
}
