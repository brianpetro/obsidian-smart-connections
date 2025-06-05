/**
 * Utilities for new user state management.
 * Stores and retrieves whether the user is new or not.
 */
export function is_new_user() {
  return localStorage.getItem('smart_connections_new_user') !== 'false';
}
export function set_new_user(value) {
  localStorage.setItem('smart_connections_new_user', value ? 'true' : 'false');
}