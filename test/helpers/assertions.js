/**
 * Shared assertion helpers for audit module tests.
 *
 * Provides concise helpers for the most common test assertions
 * on Finding objects: finding by ID and asserting status.
 */

/**
 * Find a finding by ID, or throw a descriptive error.
 *
 * @param {object[]} findings - Array of Finding objects
 * @param {string} id - The finding ID to search for
 * @returns {object} The matched finding
 * @throws {Error} If no finding with the given ID exists
 */
export function findFindingById(findings, id) {
  const found = findings.find(f => f.id === id);
  if (!found) {
    const ids = findings.map(f => f.id).join(', ');
    throw new Error(`Finding "${id}" not found. Available IDs: [${ids}]`);
  }
  return found;
}

/**
 * Find a finding by ID and assert its status.
 *
 * @param {object[]} findings - Array of Finding objects
 * @param {string} id - The finding ID to search for
 * @param {string} status - The expected status
 * @param {object} expect - Vitest expect function
 */
export function expectFindingStatus(findings, id, status, expect) {
  const found = findFindingById(findings, id);
  expect(found.status).toBe(status);
}
