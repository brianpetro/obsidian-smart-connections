import { copy_connections_filter } from './copy_connections_filter.js';
import { parse_frontmatter_filter_lines } from 'smart-entities/utils/frontmatter_filter.js';

const query_setting_keys = {
  limit: 'results_limit',
  results_collection_key: 'results_collection_key',
  score_algo_key: 'score_algo_key',
  connections_post_process: 'connections_post_process',
  exclude_inlinks: 'exclude_inlinks',
  exclude_outlinks: 'exclude_outlinks',
  exclude_frontmatter_blocks: 'exclude_frontmatter_blocks',
};

/**
 * Adapt component options into sparse, canonical retrieval overrides.
 * Explicit query operands win over local settings. Saved defaults belong to
 * preprocessing, not to presenters; never merge them into connections_settings.
 * @param {object} connections_list
 * @param {object} [opts={}]
 * @returns {import('smart-types').ConnectionsQueryParams}
 */
export function build_connections_query_params(connections_list, opts = {}) {
  const local_settings = opts.connections_settings ?? {};
  const params = {};
  for (const [query_key, setting_key] of Object.entries(query_setting_keys)) {
    const value = opts[query_key] ?? local_settings[setting_key];
    if (value !== undefined) params[query_key] = value;
  }

  // Resolve the key only to select local action settings; do not echo a default
  // algorithm into the request. An explicit empty settings object is an override.
  const score_algo_key = params.score_algo_key || connections_list.collection.score_algo_key;
  const score_settings = opts.score_settings !== undefined
    ? opts.score_settings
    : local_settings.actions?.[score_algo_key];
  if (score_settings !== undefined) params.score_settings = score_settings;
  if (opts.rank_query !== undefined) params.rank_query = opts.rank_query;

  const filter = copy_connections_filter(opts.filter);
  for (const [filter_key, setting_key] of [
    ['key_includes_any', 'include_filter'],
    ['exclude_key_includes_any', 'exclude_filter'],
  ]) {
    if (filter[filter_key] === undefined && local_settings[setting_key] !== undefined) {
      filter[filter_key] = parse_csv(local_settings[setting_key]);
    }
  }
  for (const [filter_key, setting_key] of [
    ['include', 'frontmatter_filter_include'],
    ['exclude', 'frontmatter_filter_exclude'],
  ]) {
    if (filter.frontmatter?.[filter_key] === undefined && local_settings[setting_key] !== undefined) {
      filter.frontmatter ||= {};
      filter.frontmatter[filter_key] = parse_frontmatter_filter_lines(local_settings[setting_key]);
    }
  }
  if (opts.filter !== undefined || Object.keys(filter).length) params.filter = filter;
  return params;
}

function parse_csv(value = '') {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
