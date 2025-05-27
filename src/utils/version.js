/**
 * Pure helper to detect an upgrade.
 * @param {string} prev
 * @param {string} curr
 * @returns {boolean}
 */
export function is_upgrade(prev = '', curr = '') {
  return prev && curr && prev !== curr;
}
