import styles from './connections_codeblock.css';
import { filter_hidden_results } from '../utils/filter_hidden_results.js';

/**
 * Build a Smart Connections codeblock view toolbar + list container.
 * @param {object} connections_list
 * @param {object} opts
 * @returns {Promise<string>}
 */
export async function build_html(connections_list, opts = {}) {
  const top_bar_buttons = [
    {
      title: 'Refresh connections',
      icon: 'refresh-cw',
      attrs: 'data-action="refresh-connections"'
    },
    {
      title: 'Expand all',
      icon: 'unfold-vertical',
      attrs: 'data-action="expand-all"'
    },
    {
      title: 'Collapse all',
      icon: 'fold-vertical',
      attrs: 'data-action="collapse-all"'
    },
    {
      title: 'Send results to Smart Context',
      icon: 'smart-context-builder',
      attrs: 'data-action="send-to-smart-context"'
    },
    {
      title: 'Copy as list of links',
      icon: 'copy',
      attrs: 'data-action="copy-as-links"'
    },
    {
      title: 'Connections settings',
      icon: 'settings',
      attrs: 'data-action="open-settings"'
    },
    {
      title: 'Help & getting started',
      icon: 'help-circle',
      attrs: 'data-action="open-help"'
    }
  ].map(btn => `
    <button
      aria-label="${btn.title}"
      ${btn.attrs ?? ''}
    >
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');

  const html = `<div class="connections-codeblock connections-item-view sc-connections-view">
    <div class="connections-top-bar">
      <div class="connections-actions">
        ${top_bar_buttons}
        <span>Smart Connections</span>
      </div>
    </div>
    <div class="connections-list-container"></div>
    <div class="connections-bottom-bar"></div>
  </div>`;

  return html;
}

export async function render(connections_list, opts = {}) {
  const html = await build_html.call(this, connections_list, opts);
  const frag = this.create_doc_fragment(html);
  this.apply_style_sheet(styles);
  const container = frag.firstElementChild;
  post_process.call(this, connections_list, container, opts);
  return frag;
}

/**
 * Post-process DOM fragment for codeblock behavior.
 * @param {object} connections_list
 * @param {DocumentFragment|HTMLElement} container
 * @param {object} opts
 * @returns {Promise<DocumentFragment|HTMLElement>}
 */
export async function post_process(connections_list, container, opts = {}) {
  const list_container = container.querySelector('.connections-list-container');
  const env = connections_list.env;

  const render_list = async () => {
    // console.log('Rendering connections list in codeblock view');
    const connections_list_component_key = opts.connections_list_component_key
      || connections_list.connections_list_component_key
      || 'connections_list_v4'
    ;
    const list = await env.smart_components.render_component(
      connections_list_component_key,
      connections_list,
      opts
    );
    this.empty(list_container);
    list_container.appendChild(list);
  };

  const run_action = (action_key, params = {}) => {
    const action = connections_list.actions?.[action_key];
    if (typeof action !== 'function') {
      console.warn(`Connections action unavailable: ${action_key}`);
      return false;
    }
    return action(params);
  };

  if (!container._has_listeners) {
    container._has_listeners = true;

    const refresh_button = container.querySelector('[data-action="refresh-connections"]');
    refresh_button?.addEventListener('click', async () => {
      const refreshed = await run_action('connections_list_refresh', {
        event_source: 'connections_codeblock.refresh_connections',
      });
      if (refreshed) await render_list();
    });

    const expand_all_button = container.querySelector('[data-action="expand-all"]');
    expand_all_button?.addEventListener('click', async () => {
      await run_action('connections_list_toggle_expanded', {
        connections_settings: connections_list.settings,
        container,
        expanded: true,
        event_source: 'connections_codeblock.expand_all',
      });
    });

    const collapse_all_button = container.querySelector('[data-action="collapse-all"]');
    collapse_all_button?.addEventListener('click', async () => {
      await run_action('connections_list_toggle_expanded', {
        connections_settings: connections_list.settings,
        container,
        expanded: false,
        event_source: 'connections_codeblock.collapse_all',
      });
    });

    const context_button = container.querySelector('[data-action="send-to-smart-context"]');
    context_button?.addEventListener('click', async () => {
      const visible_results = await get_visible_results_fallback(connections_list, opts);
      await run_action('connections_list_send_to_context', {
        visible_results,
        event_source: 'connections_codeblock.send_to_smart_context',
      });
    });

    const copy_links_button = container.querySelector('[data-action="copy-as-links"]');
    copy_links_button?.addEventListener('click', async () => {
      const visible_results = await get_visible_results_fallback(connections_list, opts);
      await run_action('connections_list_copy_as_links', {
        visible_results,
        event_source: 'connections_codeblock.copy_as_links',
      });
    });

    const settings_button = container.querySelector('[data-action="open-settings"]');
    settings_button?.addEventListener('click', async () => {
      await run_action('connections_list_open_settings', {
        event_source: 'connections_codeblock.open_settings',
      });
    });

    const help_button = container.querySelector('[data-action="open-help"]');
    help_button?.addEventListener('click', async () => {
      await run_action('connections_list_open_help', {
        event_source: 'connections_codeblock.open_help',
      });
    });
  }

  render_list();
  return container;
}

async function get_visible_results_fallback(connections_list, opts = {}) {
  const raw_results = await get_results_fallback(connections_list, opts);
  const connections_state = connections_list?.item?.data?.connections || {};
  return filter_hidden_results(raw_results, connections_state);
}

async function get_results_fallback(connections_list, opts = {}) {
  const cached = Array.isArray(connections_list?.results) ? connections_list.results : [];
  if (cached.length) return cached;

  try {
    const results = await connections_list.get_results({ ...opts });
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.error('Failed to fetch connections results', err);
    return [];
  }
}
