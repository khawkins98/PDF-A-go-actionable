/**
 * Shared constants for the dashboard and export modules.
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
  { key: 'fail', heading: 'Needs Attention', icon: 'FAIL', density: 'full' },
  { key: 'warning', heading: 'Warnings', icon: 'WARN', density: 'full' },
  { key: 'manual', heading: 'Manual Review', icon: 'MANUAL', density: 'compact' },
  { key: 'pass', heading: 'Passed', icon: '\u2713', density: 'chip' },
  { key: 'not-applicable', heading: 'Not Applicable', icon: '\u2014', density: 'chip' },
];
