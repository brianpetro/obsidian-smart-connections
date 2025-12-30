import styles from './connections_codeblock.css' assert { type: 'css' };
import { Notice } from 'obsidian';
import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';
import { copy_to_clipboard } from 'obsidian-smart-env/utils/copy_to_clipboard.js';

import { build_connections_context_items } from '../utils/connections_context_items.js';
import { format_connections_as_links } from '../utils/format_connections_as_links.js';
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
      icon: 'briefcase',
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
  const app = env.plugin.app || window.app;

  const render_list = async () => {
    console.log('Rendering connections list in codeblock view');
    const connections_list_component_key = opts.connections_list_component_key
      || connections_list.connections_list_component_key
      || 'connections_list_v3'
    ;
    const list = await env.smart_components.render_component(
      connections_list_component_key,
      connections_list,
      opts
    );
    this.empty(list_container);
    list_container.appendChild(list);
  };

  if (!container._has_listeners) {
    container._has_listeners = true;

    const refresh_button = container.querySelector('[data-action="refresh-connections"]');
    refresh_button?.addEventListener('click', async () => {
      const refresh_entity = connections_list.item;
      if (refresh_entity) {
        await refresh_entity.read();
        refresh_entity.queue_import();
        await refresh_entity.collection.process_source_import_queue?.();
        render_list();
      } else {
        console.warn('No entity found for refresh');
      }
    });

    const expand_all_button = container.querySelector('[data-action="expand-all"]');
    expand_all_button?.addEventListener('click', () => {
      container.querySelectorAll('.sc-result').forEach((elm) => {
        elm.classList.remove('sc-collapsed');
      });
    });

    const collapse_all_button = container.querySelector('[data-action="collapse-all"]');
    collapse_all_button?.addEventListener('click', () => {
      container.querySelectorAll('.sc-result').forEach((elm) => {
        elm.classList.add('sc-collapsed');
      });
    });

    const context_button = container.querySelector('[data-action="send-to-smart-context"]');
    context_button?.addEventListener('click', async () => {
      const raw_results = await get_results_fallback(connections_list, opts);
      if (!raw_results.length) return new Notice('No connection results to send to Smart Context');

      const connections_state = connections_list?.item?.data?.connections || {};
      const visible_results = filter_hidden_results(raw_results, connections_state);

      const context_items = build_connections_context_items({
        source_item: connections_list?.item,
        results: visible_results
      });

      if (!context_items.length) return new Notice('No visible connection results to send to Smart Context');

      const smart_context = env.smart_contexts.new_context();
      smart_context.add_items(context_items);
      smart_context.emit_event('context_selector:open');
      connections_list.emit_event('connections:sent_to_context');
    });

    const copy_links_button = container.querySelector('[data-action="copy-as-links"]');
    copy_links_button?.addEventListener('click', async () => {
      const raw_results = await get_results_fallback(connections_list, opts);
      if (!raw_results.length) return new Notice('No connection results to copy');

      const connections_state = connections_list?.item?.data?.connections || {};
      const visible_results = filter_hidden_results(raw_results, connections_state);

      const links_payload = format_connections_as_links(visible_results);
      if (!links_payload) return new Notice('No visible connection results to copy');

      await copy_to_clipboard(links_payload);
      new Notice('Copied connections as list of links');
      connections_list.emit_event('connections:copied_list');
    });

    const settings_button = container.querySelector('[data-action="open-settings"]');
    settings_button?.addEventListener('click', () => {
      app.setting.open();
      app.setting.openTabById('smart-connections');
    });

    const open_help = () => {
      StoryModal.open(env.plugin, {
        title: 'Getting Started With Smart Connections',
        url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help#page=understanding-connections-1'
      });
    };

    const help_button = container.querySelector('[data-action="open-help"]');
    help_button?.addEventListener('click', open_help);
  }

  render_list();
  return container;
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


