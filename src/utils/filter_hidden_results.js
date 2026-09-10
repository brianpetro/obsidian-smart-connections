import { resolve_connection_feedback } from './connections_list_item_state.js';

/**
 * Filter out hidden-only connections so copy/context actions reflect what is visible.
 *
 * @param {Array} results
 * @param {object} target_item
 * @returns {Array}
 */
export function filter_hidden_results(results = [], target_item) {
  if (!Array.isArray(results) || !results.length) return [];
  return results.filter((result) => result?.item
    && resolve_connection_feedback(target_item, result.item).state !== 'hidden');
}
