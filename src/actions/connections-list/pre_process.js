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

  if (!params.filter.frontmatter) params.filter.frontmatter = {};
  if (params.filter.frontmatter.include === undefined) {
    params.filter.frontmatter.include = this.collection.frontmatter_inclusions;
  }
  if (params.filter.frontmatter.exclude === undefined) {
    params.filter.frontmatter.exclude = this.collection.frontmatter_exclusions;
  }

  get_connections_feedback_items(this, params);

  // Exclude self.
  const exclude_keys = new Set(params.filter.exclude_keys || []);
  exclude_keys.add(this.item.key);
  params.filter.exclude_keys = Array.from(exclude_keys);

  // Block results also exclude descendants of self.
  if (params.results_collection_key === 'smart_blocks') {
    const exclude_starts = new Set(params.filter.exclude_key_starts_with_any || []);
    exclude_starts.add(this.item.key);
    params.filter.exclude_key_starts_with_any = Array.from(exclude_starts);

    if (params.exclude_frontmatter_blocks ?? this.collection.settings.exclude_frontmatter_blocks) {
      const exclude_ends = new Set(Array.isArray(params.filter.exclude_key_ends_with_any)
        ? params.filter.exclude_key_ends_with_any
        : []);
      exclude_ends.add('---frontmatter---');
      params.filter.exclude_key_ends_with_any = Array.from(exclude_ends);
    }
  }
}

/**
 * Populate params.hidden / params.pinned for downstream scoring only.
 * @param {import('../../items/connections_list.js').ConnectionsList} connections_list
 * @param {object} params
 */
function get_connections_feedback_items(connections_list, params) {
  params.hidden = [];
  params.pinned = [];

  const connections_state = connections_list.item.data?.connections || {};

  Object.entries(connections_state).forEach(([key, state]) => {
    if (!state || (state.hidden == null && state.pinned == null)) return;

    const [collection_key, ...item_key_parts] = key.split(':');
    if (!collection_key || !item_key_parts.length) return;

    const collection = connections_list.env[collection_key];
    if (!collection) return;

    const item = collection.get(item_key_parts.join(':'));
    if (!item) return;

    if (state.pinned != null) {
      params.pinned.push(item);
    } else if (state.hidden != null) {
      params.hidden.push(item);
    }
  });
}
