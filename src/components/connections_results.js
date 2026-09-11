/**
 * Shared graph/list presenter for the Connections view, code blocks, and footers.
 * @param {object} connections_list
 * @param {object} opts
 * @returns {Promise<string>}
 */
export async function build_html(connections_list, opts = {}) {
  return `<div class="connections-results">
    <div class="connections-graph-container"></div>
    <div class="connections-results-list"></div>
  </div>`;
}

export async function render(connections_list, opts = {}) {
  const html = await build_html.call(this, connections_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.firstElementChild;
  post_process.call(this, connections_list, container, opts);
  return container;
}

/**
 * Retrieve once and pass the same ranked snapshot to both child components.
 * Each child retains its own presentation of pinned and hidden results.
 * @param {object} connections_list
 * @param {HTMLElement} container
 * @param {object} opts
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(connections_list, container, opts = {}) {
  const env = connections_list.env;
  const graph_container = container.querySelector('.connections-graph-container');
  const list_container = container.querySelector('.connections-results-list');
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
  const ranked_results = opts.results ?? await connections_list.get_results(query_params);
  const list = await env.smart_components.render_component('connections_list', connections_list, {
    ...opts,
    ...query_params,
    connections_settings,
    results: ranked_results,
  });
  this.empty(list_container);
  list_container.appendChild(list);
  this.empty(graph_container);

  const show_key = opts.footer ? 'footer_show_connections_graph' : 'show_connections_graph';
  const graph_key = opts.footer ? 'footer_connections_graph_component_key' : 'connections_graph_component_key';
  const show_connections_graph = opts.show_connections_graph
    ?? connections_settings[show_key]
    ?? connections_list.settings?.[show_key]
    ?? !opts.footer;
  if (show_connections_graph) {
    const requested_graph_key = opts.connections_graph_component_key
      ?? connections_settings[graph_key]
      ?? connections_list.settings?.[graph_key]
      ?? 'connections_graph_v1';
    const graph_component_key = env.config.components?.[requested_graph_key]
      ? requested_graph_key
      : 'connections_graph_v1';
    try {
      const graph = await env.smart_components.render_component(graph_component_key, connections_list, {
        ...query_params, connections_settings, results: ranked_results,
      });
      graph_container.appendChild(graph);
      register_graph_events(graph, list_container);
    } catch (_err) {
      this.empty(graph_container);
      const error_message = this.create_doc_fragment(`<p class="sc-graph-error">Unable to load graph visualization: ${typeof _err?.message === 'string' ? _err.message : 'Unknown error'}</p>`);
      graph_container.appendChild(error_message);
    }
  }
  return container;
}

const GRAPH_FOCUS_CLASS = 'sc-result-graph-focus';
const GRAPH_FOCUS_TIMEOUT_MS = 2400;

function register_graph_events(graph, list_container) {
  if (!graph || !list_container) return;
  graph.addEventListener('connections:result', (event) => {
    focus_result_from_graph(list_container, event?.detail || {});
  });
}

function focus_result_from_graph(list_container, detail = {}) {
  const target = find_result_element(list_container, detail);
  if (!target) return;
  if (target.classList.contains('sc-collapsed')) target.classList.remove('sc-collapsed');
  target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  target.classList.add(GRAPH_FOCUS_CLASS);
  window.setTimeout?.(() => target.classList.remove(GRAPH_FOCUS_CLASS), GRAPH_FOCUS_TIMEOUT_MS);
}

function find_result_element(list_container, detail = {}) {
  if (!list_container) return null;
  const { collection_key, item_key } = detail;
  if (!collection_key || !item_key) return null;
  return Array.from(list_container.querySelectorAll('.sc-result')).find((node) => {
    return node.dataset.collection === collection_key && node.dataset.key === item_key;
  }) || null;
}
