import { build_prefixed_connection_key } from './connections_list_item_state.js';

/**
 * Filter out "hidden-only" connections (hidden && !pinned) so copy/context actions
 * reflect what is visible.
 *
 * @param {Array} results
 * @param {Record<string, Record<string, number>>} connections_state
 * @returns {Array}
 */
export function filter_hidden_results(results = [], connections_state = {}) {
  if (!Array.isArray(results) || !results.length) return [];
  if (!connections_state || typeof connections_state !== 'object') return results;

  return results.filter((result) => {
    const item = result?.item;
    if (!item) return false;

    const prefixed_key = build_prefixed_connection_key(item.collection_key, item.key);
    const state = connections_state[prefixed_key];

    if (!state || typeof state !== 'object') return true;

    const hidden = state.hidden !== undefined && state.hidden !== null;
    const pinned = state.pinned !== undefined && state.pinned !== null;

    return !(hidden && !pinned);
  });
}
