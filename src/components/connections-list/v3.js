import { get_visible_connections_results } from '../../utils/get_visible_connections_results.js';
// List-only component used by configurable Connections surfaces.
/**
 * @returns {Promise<string>} A promise that resolves to the .sc-list HTML string.
 */
export async function build_html(connections_list, opts = {}) {
  return `<div><div class="connections-list sc-list" data-key="${connections_list.item.key}"></div></div>`;
}

/**
 * @param {Array} connections_list - The results array.
 * @param {Object} [opts={}] - Optional parameters, including `opts.results`.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the .sc-list fragment with appended children.
 */
export async function render(connections_list, opts = {}) {
  const html = await build_html.call(this, connections_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.connections-list');
  post_process.call(this, connections_list, container, opts);
  return container;
}

export async function post_process(connections_list, container, opts = {}) {
  container.dataset.key = connections_list.item.key;
  opts.on_visible_results?.([]);
  const connections_settings = opts.connections_settings ?? connections_list.settings ?? {};
  const score_algo_key = opts.score_algo_key ?? connections_settings.score_algo_key;
  const query_params = {
    limit: opts.limit ?? connections_settings.results_limit,
    results_collection_key: opts.results_collection_key ?? connections_settings.results_collection_key,
    score_algo_key,
    score_settings: opts.score_settings !== undefined
      ? opts.score_settings
      : connections_settings.actions?.[score_algo_key],
    connections_post_process: opts.connections_post_process ?? connections_settings.connections_post_process,
    filter: opts.filter,
    exclude_inlinks: opts.exclude_inlinks ?? connections_settings.exclude_inlinks,
    exclude_outlinks: opts.exclude_outlinks ?? connections_settings.exclude_outlinks,
    exclude_frontmatter_blocks: opts.exclude_frontmatter_blocks ?? connections_settings.exclude_frontmatter_blocks,
    rank_query: opts.rank_query,
  };
  const ranked_results = await connections_list.get_results(query_params);
  const results = await get_visible_connections_results(connections_list, query_params, ranked_results);
  if(!results || !Array.isArray(results) || results.length === 0) {
    const no_results = this.create_doc_fragment(`<p class="sc-no-results">No results found.<br><em>Try using the refresh button. If that doesn't work, try running "Clear sources data" and then "Reload sources" in the Smart Environment settings.</em></p>`);
    container.appendChild(no_results);
    return container;
  }
  const smart_components = connections_list.env.smart_components;
  const result_frags = await Promise.all(results.map(result => {
    return smart_components.render_component('connections_list_item_v3', result, { ...opts, visible_results: results });
  }));
  result_frags.forEach(result_frag => container.appendChild(result_frag));
  opts.on_visible_results?.(results);
  // Add any necessary post-processing here
  return container;
}

export const display_name = "List only";