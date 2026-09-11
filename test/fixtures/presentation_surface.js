import fs from 'node:fs';
import vm from 'node:vm';
import { post_process as results_presenter } from '../../src/components/connections_results.js';
import { post_process as base_list } from '../../src/components/connections_list.js';
import { get_graph_connections_results } from '../../src/utils/get_graph_connections_results.js';
import { filter_hidden_results } from '../../src/utils/filter_hidden_results.js';
import { get_context_lines } from '../../src/utils/context_lines.js';
import { copy_connections_filter } from '../../src/utils/copy_connections_filter.js';
import { parse_frontmatter_filter_lines } from 'smart-entities/utils/frontmatter_filter.js';

/** Execute the actual component body with explicit simulated host capabilities. */
export function load_component(url, export_names = ['post_process'], globals = {}) {
  const source = fs.readFileSync(url, 'utf8').replaceAll('\r\n', '\n')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '');
  const context = vm.createContext({
    module: { exports: {} }, console, setTimeout, clearTimeout,
    get_graph_connections_results,
    filter_hidden_results, get_context_lines,
    copy_connections_filter, parse_frontmatter_filter_lines,
    Menu: class {
      constructor() { this.items = []; }
      addSeparator() { this.items.push({ separator: true }); }
      showAtMouseEvent() {}
    },
    Notice: class {},
    ...globals,
  });
  new vm.Script(source + `\nmodule.exports = { ${export_names.join(', ')} };`).runInContext(context);
  return context.module.exports;
}

/** Minimal DOM surface; this does not emulate a browser or Obsidian. */
export function create_node(classes = []) {
  const names = new Set(classes);
  const attributes = {};
  const node = {
    children: [], dataset: {}, selectors: {}, listeners: {}, textContent: '', innerHTML: '',
    classList: {
      add(...values) { values.forEach(value => names.add(value)); },
      remove(...values) { values.forEach(value => names.delete(value)); },
      contains(value) { return names.has(value); },
      toggle(value, enabled = !names.has(value)) { if (enabled) names.add(value); else names.delete(value); return enabled; },
    },
    ownerDocument: { createElement() { return create_node(); } },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    setAttribute(key, value) { attributes[key] = value; },
    getAttribute(key) { return attributes[key]; },
    removeAttribute(key) { delete attributes[key]; if (key === 'data-hidden') delete this.dataset.hidden; if (key === 'data-pinned') delete this.dataset.pinned; },
    matches(selector) { return selector.startsWith('.') && selector.slice(1).split('.').every(name => names.has(name)); },
    querySelector(selector) {
      if (this.selectors[selector]) return this.selectors[selector];
      for (const child of this.children) {
        if (child.matches?.(selector)) return child;
        const found = child.querySelector?.(selector);
        if (found) return found;
      }
      return null;
    },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.matches?.(selector) ? [child] : []),
        ...(child.querySelectorAll?.(selector) || []),
      ]);
    },
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); },
    remove() {},
    scrollIntoView() {},
  };
  return node;
}

export const presenter = {
  empty(node) { node.children = []; },
  create_doc_fragment(html = '') { const fragment = create_node(); fragment.innerHTML = html; return fragment; },
  safe_inner_html() {},
  get_icon_html() { return ''; },
};

export function install_components(fixture, processors = {}) {
  const calls = [];
  const component_processors = {
    connections_results: results_presenter,
    connections_list: base_list,
    ...processors,
  };
  fixture.env.config.components = {
    connections_graph_v1: {},
    ...fixture.env.config.components,
  };
  fixture.env.smart_components = {
    async render_component(key, scope, options) {
      calls.push({ key, scope, options });
      if (component_processors[key]) {
        const root = create_node();
        if (key === 'connections_results') {
          root.appendChild(create_node(['connections-graph-container']));
          root.appendChild(create_node(['connections-results-list']));
        } else {
          root.classList.add('connections-list', 'sc-list');
        }
        await component_processors[key].call(presenter, scope, root, options);
        return root;
      }
      const node = create_node();
      if (key.startsWith('connections_graph_')) {
        node.entries = await get_graph_connections_results(scope, options, options.results);
      } else if (scope.item) {
        node.classList.add('sc-result');
        node.dataset.collection = scope.item.collection_key;
        node.dataset.key = scope.item.key;
      }
      return node;
    },
  };
  return calls;
}
