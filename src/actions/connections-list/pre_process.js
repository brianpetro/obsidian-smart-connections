import { resolve_connection_feedback } from '../../utils/connections_list_item_state.js';
import { copy_connections_filter } from '../../utils/copy_connections_filter.js';

export function pre_process(params) {
  if (!params.limit) params.limit = this.settings?.results_limit ?? 20;
  if (!params.results_collection_key) {
    params.results_collection_key = this.collection.results_collection_key;
  }
  params.filter = copy_connections_filter(params.filter);
  if (!params.score_algo_key) params.score_algo_key = this.collection.score_algo_key;
  // Scoring settings belong to this retrieval, not to the candidate's collection.
  if (params.score_settings == null) {
    params.score_settings = this.settings?.actions?.[params.score_algo_key] || {};
  }

  // Always treat this.item as the scoring target.
  // NOTE: This mutates params intentionally.
  params.to_item = this.item;

  if (!params.filter.exclude_keys) params.filter.exclude_keys = [];
  if (!params.filter.exclude_key_starts_with_any) {
    params.filter.exclude_key_starts_with_any = [];
  }

  if (!params.filter.frontmatter) params.filter.frontmatter = {};
  if (params.filter.frontmatter.include === undefined) {
    params.filter.frontmatter.include = this.collection.frontmatter_inclusions;
  }
  if (params.filter.frontmatter.exclude === undefined) {
    params.filter.frontmatter.exclude = this.collection.frontmatter_exclusions;
  }

  get_connections_feedback_items(this, params);

  // Exclusions
  // exclude exact (faster than starts_with)
  const exclude_keys_set = new Set(params.filter.exclude_keys);
  if (params.filter.exclude_key) {
    exclude_keys_set.add(params.filter.exclude_key);
  }
  exclude_keys_set.add(this.item.key); // always exclude self
  params.filter.exclude_keys = Array.from(exclude_keys_set);

  // lower-level exclusions (only applies to blocks since may be nested)
  if (params.results_collection_key === 'smart_blocks') {
    // also exclude self from block-level matches
    const exclude_starts_set = new Set(params.filter.exclude_key_starts_with_any);
    exclude_starts_set.add(this.item.key);
    params.filter.exclude_key_starts_with_any = Array.from(exclude_starts_set);
    // handle frontmatter block exclusion
    if (params.exclude_frontmatter_blocks ?? this.collection.settings.exclude_frontmatter_blocks) {
      if(!params.filter.exclude_key_ends_with_any || !Array.isArray(params.filter.exclude_key_ends_with_any)) {
        params.filter.exclude_key_ends_with_any = [];
      }
      if (!params.filter.exclude_key_ends_with_any.includes('---frontmatter---')) {
        params.filter.exclude_key_ends_with_any.push('---frontmatter---');
      }
    }
  }

}

/**
 * Populate params.hidden / params.pinned for downstream
 * scoring only; feedback does not change candidate eligibility.
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
  params.pinned = [];

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

    const feedback = resolve_connection_feedback(connections_list.item, item);
    // Hidden-only: participate as "hidden" but not "pinned".
    if (feedback.state === 'hidden') {
      params.hidden.push(item);
    }

    // Any pinned (pinned-only or hidden+pinned) participates as "pinned".
    if (feedback.state === 'pinned') {
      params.pinned.push(item);
    }
  });
}
