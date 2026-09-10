/**
 * Graph presentation intentionally includes the ranked results plus any hard-eligible
 * pinned/hidden feedback items, even when those items fall outside the ranked window.
 * It never scores supplemental nodes.
 * @param {object} connections_list
 * @param {object} params
 * @param {Array} ranked_results
 * @returns {Array}
 */
export function get_graph_connections_results(connections_list, params, ranked_results) {
  params = connections_list._result_params.get(ranked_results) || params;
  const seen = new Set(ranked_results.map(result => `${result.item.collection_key}:${result.item.key}`));
  const supplements = connections_list.get_feedback_items(params, { states: ['pinned', 'hidden'] })
    .filter(({ item }) => !seen.has(`${item.collection_key}:${item.key}`))
    .map(({ item, feedback }) => ({ item, feedback }));
  return [...ranked_results, ...supplements];
}
