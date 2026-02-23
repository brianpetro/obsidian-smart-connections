/**
 * @returns {Promise<string>} A promise that resolves to the .sc-list HTML string.
 */
export async function build_html(connections_list, opts = {}) {
  return `<div>
      <div class="connections-graph-container"></div>
      <div class="connections-list sc-list" data-key="${connections_list.item.key}"></div>
  </div>`;
}

/**
 * @param {Array} connections_list - The results array.
 * @param {Object} [opts={}] - Optional parameters, including `opts.results`.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the .sc-list fragment with appended children.
 */
export async function render(connections_list, opts = {}) {
  const html = await build_html.call(this, connections_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.firstElementChild;
  post_process.call(this, connections_list, container, opts);
  return container;
}

export async function post_process(connections_list, container, opts = {}) {
  const env = connections_list.env;
  const graph_container = container.querySelector('.connections-graph-container');
  const list_container = container.querySelector('.connections-list.sc-list');
  container.dataset.key = connections_list.item.key;
  const results = await connections_list.get_results(opts);
  const connections_settings = opts.connections_settings
    ?? env.connections_lists.settings
  ;
  const component_settings = connections_settings.components?.connections_list_v4 || {};
  const show_graph = component_settings.show_graph;
  if(show_graph) {
    try {
      const graph = await env.smart_components.render_component('connections_graph_v1', connections_list, opts);
      this.empty(graph_container);
      graph_container.appendChild(graph);
      register_graph_events(graph, list_container);
    } catch (_err) {
      this.empty(graph_container);
    }
  }

  if (!results || !Array.isArray(results) || results.length === 0) {
    const no_results = this.create_doc_fragment(`<p class="sc-no-results">No results found.<br><em>Try using the refresh button. If that doesn't work, try running "Clear sources data" and then "Reload sources" in the Smart Environment settings.</em></p>`);
    list_container.appendChild(no_results);
    return container;
  }

  const smart_components = connections_list.env.smart_components;
  const result_frags = await Promise.all(results.map(result => {
    return smart_components.render_component('connections_list_item_v3', result, { ...opts });
  }));
  result_frags.forEach(result_frag => list_container.appendChild(result_frag));
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
  const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  schedule?.(() => target.classList.remove(GRAPH_FOCUS_CLASS), GRAPH_FOCUS_TIMEOUT_MS);
}

function find_result_element(list_container, detail = {}) {
  if (!list_container) return null;
  const { collection_key, item_key } = detail;
  if (!collection_key || !item_key) return null;
  return Array.from(list_container.querySelectorAll('.sc-result')).find((node) => {
    return node.dataset.collection === collection_key && node.dataset.key === item_key;
  }) || null;
}

export const display_name = 'Version 4.0 (Graph + List)';

export const settings_config = {
  "show_graph": {
    name: "Show graph",
    type: "toggle",
    description: "Show a graph visualization of the connections above the list.",
    // default: true,
    group: "Connections lists"
  },
};
