/**
 * Utilities for release notes state management.
 * Stores and retrieves the last plugin version shown in the release notes modal.
 */

/**
 * Returns the last saved plugin version or an empty string.
 * @returns {string}
 */
export function get_last_known_version() {
  return localStorage.getItem('smart_connections_last_version') || '';
}

/**
 * Persists the provided plugin version as last shown.
 * @param {string} version
 */
export function set_last_known_version(version) {
  localStorage.setItem('smart_connections_last_version', version);
}

/**
 * Determines if release notes should be shown for `current_version`.
 * @param {string} current_version
 * @returns {boolean}
 */
export function should_show_release_notes(current_version) {
  return get_last_known_version() !== current_version;
}
