export function pre_process(params) {
  if (!params.limit) params.limit = this.settings?.results_limit ?? 20;
  if (!params.results_collection_key) {
    params.results_collection_key = this.collection.results_collection_key;
  }
  if (!params.filter) params.filter = {};
  if (!params.score_algo_key) params.score_algo_key = this.collection.score_algo_key;

  // Always treat this.item as the scoring target.
  // NOTE: This mutates params intentionally.
  params.to_item = this.item;

  if (!params.filter.exclude_keys) params.filter.exclude_keys = [];
  if (!params.filter.exclude_key_starts_with_any) {
    params.filter.exclude_key_starts_with_any = [];
  }

  get_connections_feedback_items(this, params);

  // Exclusions
  // exclude exact (faster than starts_with)
  const exclude_keys_set = new Set(params.filter.exclude_keys);
  exclude_keys_set.add(this.item.key); // always exclude self
  params.hidden_keys.forEach((key) => exclude_keys_set.add(key)); // always exclude hidden
  params.pinned_keys.forEach((key) => exclude_keys_set.add(key)); // always exclude pinned (always included in post_process)
  params.filter.exclude_keys = Array.from(exclude_keys_set);

  // lower-level exclusions (only applies to blocks since may be nested)
  if (params.results_collection_key === 'smart_blocks') {
    // also exclude self and feedback ranges from block-level matches
    const exclude_starts_set = new Set(params.filter.exclude_key_starts_with_any);
    exclude_starts_set.add(this.item.key);
    params.hidden_keys.forEach((key) => exclude_starts_set.add(key));
    params.pinned_keys.forEach((key) => exclude_starts_set.add(key));
    params.filter.exclude_key_starts_with_any = Array.from(exclude_starts_set);
    // handle frontmatter block exclusion
    if (this.collection.settings.exclude_frontmatter_blocks) {
      if(!params.filter.exclude_key_ends_with_any || !Array.isArray(params.filter.exclude_key_ends_with_any)) {
        params.filter.exclude_key_ends_with_any = [];
      }
      params.filter.exclude_key_ends_with_any.push('---frontmatter---');
    }
  }

}

/**
 * Populate params.hidden / params.pinned and their key lists for downstream
 * scoring and post-processing.
 *
 * Arrays are rebuilt on every call so repeated get_results invocations with
 * the same params object do not accumulate duplicates.
 *
 * Rules:
 * - If a connection is hidden and not pinned → counts as "hidden" only.
 * - If a connection is pinned (with or without hidden) → counts as "pinned".
 *
 * @param {import('../../items/connections_list.js').ConnectionsList} connections_list
 * @param {object} params
 */
function get_connections_feedback_items(connections_list, params) {
  // Always rebuild derived arrays to avoid duplicates.
  params.hidden = [];
  params.hidden_keys = [];
  params.pinned = [];
  params.pinned_keys = [];

  const connections_state = connections_list.item.data?.connections || {};

  Object.entries(connections_state).forEach(([key, state]) => {
    if (!state || (state.hidden == null && state.pinned == null)) return;

    const [collection_key, ...item_key_parts] = key.split(':');
    if (!collection_key || !item_key_parts.length) return;

    const item_key = item_key_parts.join(':');
    const collection = connections_list.env[collection_key];
    if (!collection) return;

    const item = collection.get(item_key);
    if (!item) return;

    // Hidden-only: participate as "hidden" but not "pinned".
    if (state.hidden && !state.pinned) {
      params.hidden.push(item);
      params.hidden_keys.push(item_key);
    }

    // Any pinned (pinned-only or hidden+pinned) participates as "pinned".
    if (state.pinned) {
      params.pinned.push(item);
      params.pinned_keys.push(item_key);
    }
  });
}
