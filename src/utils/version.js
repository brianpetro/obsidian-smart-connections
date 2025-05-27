/**
 * Determine whether two version strings represent an upgrade.
 * @param {string} prev - previous version
 * @param {string} curr - current version
 * @returns {boolean} true if both versions exist and differ
 */
export function is_upgrade(prev = '', curr = '') {
  return !!prev && !!curr && prev !== curr;
}
