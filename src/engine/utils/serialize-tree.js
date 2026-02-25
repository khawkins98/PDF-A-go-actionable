/**
 * Serializable structure tree builder for tagged PDFs.
 *
 * Produces a hierarchical JSON-safe tree from the StructTreeRoot,
 * suitable for postMessage transfer and interactive UI rendering.
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

  const visited = new Set();
  let nextId = 0;
  let truncated = false;

  function buildNode(node, depth) {
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

    const treeNode = {
      id: nextId++,
      type: typeName,
      role: resolveRole(typeName, roleMap),
      alt: altObj ? altObj.decodeText() : null,
      lang: langObj ? langObj.decodeText() : null,
      children: [],
    };

    if (nextId >= MAX_ELEMENTS) {
      truncated = true;
      return treeNode;
    }

    // Recurse into children
    const k = resolved.get(PDFName.of('K'));
    if (!k) return treeNode;

    const kResolved = resolve(k, context);

    if (kResolved instanceof PDFArray) {
      for (let i = 0; i < kResolved.size(); i++) {
        const child = kResolved.get(i);
        if (child instanceof PDFRef || child instanceof PDFDict) {
          const childNode = buildNode(child, depth + 1);
          if (childNode) treeNode.children.push(childNode);
        }
      }
    } else if (kResolved instanceof PDFDict || kResolved instanceof PDFRef) {
      const childNode = buildNode(kResolved, depth + 1);
      if (childNode) treeNode.children.push(childNode);
    }

    return treeNode;
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
      const childNode = buildNode(child, 1);
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
    root = buildNode(rootK, 1);
  }

  return { root, totalCount: nextId, truncated };
}
