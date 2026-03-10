/**
 * Shared constants and helpers for the dashboard and export modules.
 */

/**
 * Status groups in display order. Fail first (most important), then
 * warnings, manual review, pass, and finally not-applicable.
 *
 * Each consumer may use a subset of fields:
 * - dashboard.js uses key, heading, icon, density
 * - export.js uses key, heading, density
 */
export const STATUS_GROUPS = [
  { key: 'fail', heading: 'Requires Attention', icon: 'FAIL', density: 'full' },
  { key: 'warning', heading: 'Warnings', icon: 'WARN', density: 'full' },
  { key: 'manual', heading: 'Manual Review', icon: 'MANUAL', density: 'compact' },
  { key: 'pass', heading: 'Passed', icon: '\u2713', density: 'chip' },
  { key: 'not-applicable', heading: 'Not Applicable', icon: '\u2014', density: 'chip' },
];

/**
 * Group findings by status, keyed by STATUS_GROUPS keys.
 *
 * @param {object[]} findings
 * @returns {Record<string, object[]>}
 */
export function groupFindings(findings) {
  const groups = {};
  for (const g of STATUS_GROUPS) groups[g.key] = [];
  for (const f of findings) {
    if (groups[f.status]) groups[f.status].push(f);
  }
  return groups;
}

/**
 * Compute the overall verdict from grouped findings.
 *
 * @param {Record<string, object[]>} groups - Output of groupFindings()
 * @returns {{ overallStatus: string, label: string, description: string }}
 */
export function computeVerdict(groups) {
  const failCount = groups.fail.length;
  const warnCount = groups.warning.length;
  const manualCount = groups.manual.length;
  const passCount = groups.pass.length;
  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';

  let label;
  let description;
  if (overallStatus === 'pass') {
    label = 'PASS';
    if (passCount === 0 && manualCount === 0) {
      description = 'No checks were performed.';
    } else if (passCount === 0 && manualCount > 0) {
      description = `No automated checks were performed. ${manualCount} item${manualCount !== 1 ? 's' : ''} flagged for manual review.`;
    } else if (manualCount > 0) {
      description = `All ${passCount} automated check${passCount !== 1 ? 's' : ''} passed. ${manualCount} item${manualCount !== 1 ? 's' : ''} flagged for manual review.`;
    } else {
      description = `All ${passCount} automated check${passCount !== 1 ? 's' : ''} passed.`;
    }
  } else if (overallStatus === 'warning') {
    label = 'PASS WITH WARNINGS';
    description = `No failures, but ${warnCount} warning${warnCount !== 1 ? 's' : ''} need review. ${passCount} check${passCount !== 1 ? 's' : ''} passed.`;
  } else {
    label = 'FAIL';
    description = `${failCount} accessibility issue${failCount !== 1 ? 's' : ''} must be fixed. ${passCount} check${passCount !== 1 ? 's' : ''} passed.`;
  }

  return { overallStatus, label, description };
}
