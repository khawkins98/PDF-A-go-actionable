/**
 * UNDRR 13-Point Validation Checklist — logic module.
 *
 * Maps our audit findings to the UNDRR "Validating PDF Accessibility with
 * Adobe Acrobat Pro" guide's 13-point checklist. The checklist data and
 * complementary tools live in ../guidance.js — re-exported here so
 * existing consumers don't need to change their imports.
 *
 * This module is pure data/logic — no DOM.
 */

// Re-export data from the consolidated guidance module
export { UNDRR_CHECKLIST, COMPLEMENTARY_TOOLS } from '../guidance.js';

import { UNDRR_CHECKLIST } from '../guidance.js';

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
 * The checker is always run (we ARE the checker), so this never fails —
 * it's either pass (all green) or warning (issues found, review above).
 */
function resolveItem11Status(findings) {
  if (findings.length === 0) return { status: 'not-checked', summary: null };

  const hasFail = findings.some((f) => f.status === 'fail');
  const hasWarning = findings.some((f) => f.status === 'warning');
  const failCount = findings.filter((f) => f.status === 'fail').length;
  const warnCount = findings.filter((f) => f.status === 'warning').length;
  const passCount = findings.filter((f) => f.status === 'pass').length;
  const issueCount = failCount + warnCount;

  if (hasFail || hasWarning) {
    return { status: 'warning', summary: `Checker ran — ${issueCount} issue${issueCount !== 1 ? 's' : ''} found. Address the issues above and run the checker again.` };
  }
  return { status: 'pass', summary: `Checker ran — all ${passCount} automated checks passed. No further action needed.` };
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
