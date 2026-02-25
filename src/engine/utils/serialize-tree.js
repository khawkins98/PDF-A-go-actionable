/**
 * Serializable structure tree builder for tagged PDFs.
 *
 * Produces a hierarchical JSON-safe tree from the StructTreeRoot,
 * suitable for postMessage transfer and interactive UI rendering.
 *
 * Each TreeNode carries MCID references and page indices so the UI
 * can map tree nodes to visual regions on the rendered PDF page.
 *
 * Same safety caps as struct-tree-walker.js:
 * - Visited set prevents cycles
 * - Depth cap (200) prevents stack overflow
 * - Element count cap (50,000) prevents hangs on huge documents
 */
import { PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import { resolve } from './resolve.js';
import { resolveRole } from './role-map.js';

const MAX_DEPTH = 200;
const MAX_ELEMENTS = 50000;

/**
 * @typedef {Object} TreeNode
 * @property {number} id - Sequential integer
 * @property {string} type - Original structure type (without leading slash)
 * @property {string} role - Resolved via RoleMap
 * @property {string|null} alt - Alt text if present
 * @property {string|null} lang - Language if present
 * @property {TreeNode[]} children - Child nodes
 * @property {Array<{mcid: number, pageIndex: number}>} mcids - Marked content IDs with page indices
 * @property {number|null} pageIndex - Page index from /Pg (inherited or direct), null if unknown
 */

/**
 * Build a serializable tree from the PDF's structure tree.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {Map<string, string>} roleMap - From buildRoleMap() / getRoleMapFromDoc()
 * @returns {{ root: TreeNode|null, totalCount: number, truncated: boolean }}
 */
export function buildSerializableTree(pdfDoc, roleMap) {
  const catalog = pdfDoc.catalog;
  const context = pdfDoc.context;

  const structTreeRootRef = catalog.get(PDFName.of('StructTreeRoot'));
  if (!structTreeRootRef) return { root: null, totalCount: 0, truncated: false };

  const structTreeRoot = resolve(structTreeRootRef, context);
  if (!(structTreeRoot instanceof PDFDict)) return { root: null, totalCount: 0, truncated: false };

  // Build a map from page ref string → 0-based page index
  const pageRefToIndex = buildPageRefMap(pdfDoc);

  const visited = new Set();
  let nextId = 0;
  let truncated = false;

  /**
   * Resolve a /Pg value to a 0-based page index, or return null.
   */
  function resolvePageIndex(pgVal) {
    if (!pgVal) return null;
    const resolved = resolve(pgVal, context);
    if (!resolved) return null;
    // pgVal might be a PDFRef — use its string as the key
    const refKey = pgVal instanceof PDFRef ? pgVal.toString() : null;
    if (refKey && pageRefToIndex.has(refKey)) return pageRefToIndex.get(refKey);
    // Also try the resolved object's toString
    if (resolved instanceof PDFRef) {
      const rk = resolved.toString();
      if (pageRefToIndex.has(rk)) return pageRefToIndex.get(rk);
    }
    return null;
  }

  /**
   * Extract an integer from a pdf-lib value.
   * Works for PDFNumber and any object with numberValue or toString.
   */
  function toInt(val) {
    if (val == null) return null;
    if (typeof val === 'number') return val;
    if (typeof val.numberValue === 'function') return val.numberValue();
    if (typeof val.numberValue === 'number') return val.numberValue;
    const n = Number(val.toString());
    return isNaN(n) ? null : n;
  }

  function buildNode(node, depth, inheritedPageIndex) {
    if (depth > MAX_DEPTH || nextId >= MAX_ELEMENTS) {
      truncated = true;
      return null;
    }

    const resolved = resolve(node, context);
    if (!resolved) return null;

    // Track visited refs to prevent cycles
    if (node instanceof PDFRef) {
      const tag = node.toString();
      if (visited.has(tag)) return null;
      visited.add(tag);
    }

    if (!(resolved instanceof PDFDict)) return null;

    const s = resolved.get(PDFName.of('S'));
    if (!s) return null;

    const typeName = s instanceof PDFName
      ? s.decodeText()
      : s.toString().replace(/^\//, '');

    const altObj = resolved.get(PDFName.of('Alt'));
    const langObj = resolved.get(PDFName.of('Lang'));

    // Determine this element's page index from /Pg or inherit from parent
    const pgVal = resolved.get(PDFName.of('Pg'));
    const elemPageIndex = resolvePageIndex(pgVal);
    const effectivePageIndex = elemPageIndex != null ? elemPageIndex : inheritedPageIndex;

    const treeNode = {
      id: nextId++,
      type: typeName,
      role: resolveRole(typeName, roleMap),
      alt: altObj && typeof altObj.decodeText === 'function' ? altObj.decodeText() : null,
      lang: langObj && typeof langObj.decodeText === 'function' ? langObj.decodeText() : null,
      children: [],
      mcids: [],
      pageIndex: effectivePageIndex,
    };

    if (nextId >= MAX_ELEMENTS) {
      truncated = true;
      return treeNode;
    }

    // Process children (/K)
    const k = resolved.get(PDFName.of('K'));
    if (!k) return treeNode;

    const kResolved = resolve(k, context);

    if (kResolved instanceof PDFArray) {
      for (let i = 0; i < kResolved.size(); i++) {
        const child = kResolved.get(i);
        processKChild(child, treeNode, depth, effectivePageIndex);
      }
    } else {
      processKChild(kResolved, treeNode, depth, effectivePageIndex);
      // Also try the unreferenced K if it's a different type
      if (kResolved !== k) {
        // Already processed via resolve
      } else if (k instanceof PDFRef || k instanceof PDFDict) {
        // Process as struct element — handled above
      }
    }

    return treeNode;
  }

  /**
   * Process a single child from /K — can be an integer (MCID),
   * an MCR dict, an OBJR dict, or a struct element ref/dict.
   */
  function processKChild(child, parentNode, depth, inheritedPageIndex) {
    if (child == null) return;

    const childResolved = resolve(child, context);
    if (childResolved == null) return;

    // Integer MCID — appears directly in /K
    const intVal = toInt(childResolved);
    if (intVal != null && !(childResolved instanceof PDFDict) && !(childResolved instanceof PDFArray) && !(childResolved instanceof PDFRef)) {
      parentNode.mcids.push({ mcid: intVal, pageIndex: inheritedPageIndex != null ? inheritedPageIndex : null });
      return;
    }

    // Dict children
    if (childResolved instanceof PDFDict) {
      const type = childResolved.get(PDFName.of('Type'));
      const typeName = type instanceof PDFName ? type.decodeText() : (type ? type.toString().replace(/^\//, '') : '');

      if (typeName === 'MCR') {
        // Marked content reference dict
        const mcidVal = childResolved.get(PDFName.of('MCID'));
        const mcidInt = toInt(mcidVal);
        if (mcidInt != null) {
          const mcrPg = childResolved.get(PDFName.of('Pg'));
          const mcrPageIndex = resolvePageIndex(mcrPg);
          parentNode.mcids.push({
            mcid: mcidInt,
            pageIndex: mcrPageIndex != null ? mcrPageIndex : (inheritedPageIndex != null ? inheritedPageIndex : null),
          });
        }
        return;
      }

      if (typeName === 'OBJR') {
        // Object reference (annotations, form fields) — skip for now
        return;
      }

      // Structure element — has /S
      if (childResolved.get(PDFName.of('S'))) {
        const childNode = buildNode(child instanceof PDFRef ? child : childResolved, depth + 1, inheritedPageIndex);
        if (childNode) parentNode.children.push(childNode);
        return;
      }
    }

    // PDFRef that resolves to a struct element
    if (child instanceof PDFRef) {
      const childNode = buildNode(child, depth + 1, inheritedPageIndex);
      if (childNode) parentNode.children.push(childNode);
    }
  }

  // Start from StructTreeRoot's /K
  const rootK = structTreeRoot.get(PDFName.of('K'));
  if (!rootK) return { root: null, totalCount: 0, truncated: false };

  const rootKResolved = resolve(rootK, context);
  let root = null;

  if (rootKResolved instanceof PDFArray) {
    // Multiple root children — wrap in a virtual Document node
    const children = [];
    for (let i = 0; i < rootKResolved.size(); i++) {
      const child = rootKResolved.get(i);
      const childNode = buildNode(child, 1, null);
      if (childNode) children.push(childNode);
    }
    if (children.length === 1) {
      root = children[0];
    } else if (children.length > 1) {
      // Keep the first child as root if it's Document-like, otherwise wrap
      root = children[0];
      // If multiple roots, just take the first — rare in practice
      // Attach siblings as children of the first root
      for (let i = 1; i < children.length; i++) {
        root.children.push(children[i]);
      }
    }
  } else {
    root = buildNode(rootK, 1, null);
  }

  return { root, totalCount: nextId, truncated };
}

/**
 * Build a map from page ref string → 0-based page index.
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @returns {Map<string, number>}
 */
function buildPageRefMap(pdfDoc) {
  const map = new Map();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    // page.ref is the PDFRef for this page object
    if (page.ref) {
      map.set(page.ref.toString(), i);
    }
  }
  return map;
}
