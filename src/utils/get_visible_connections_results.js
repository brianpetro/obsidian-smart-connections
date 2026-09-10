import { resolve_connection_feedback } from './connections_list_item_state.js';

/**
 * Default list presentation: eligible pins first, then ordinary ranked rows.
 * Hidden/pinned rows consume their raw retrieval slots; there is no backfill.
 * Use the preparation retained for a retrieved snapshot, not a joining caller's
 * unprocessed params. Other supplied snapshots require prepared params.
 * @param {object} connections_list
 * @param {object} [params={}]
 * @param {Array} [ranked_results]
 * @returns {Promise<Array>}
 */
export async function get_visible_connections_results(connections_list, params = {}, ranked_results) {
  let query_params = ranked_results ? params : { ...params };
  const results = ranked_results || await connections_list.get_results(query_params);
  query_params = connections_list._result_params.get(results) || query_params;
  // Resolve live presentation feedback once, without changing the raw snapshot.
  const ranked_by_key = new Map(results.map(result => {
    const feedback = resolve_connection_feedback(connections_list.item, result.item);
    return [
      `${result.item.collection_key}:${result.item.key}`,
      feedback.state === result.feedback.state ? result : { ...result, feedback },
    ];
  }));
  const pins = connections_list.get_feedback_items(query_params, { states: ['pinned'] })
    .map(({ item, feedback }) => {
      const ranked = ranked_by_key.get(`${item.collection_key}:${item.key}`);
      return ranked || {
        ...item.score(query_params), item, feedback, connections_list,
      };
    });
  return [...pins, ...[...ranked_by_key.values()].filter(result => result.feedback.state === 'default')];
}
