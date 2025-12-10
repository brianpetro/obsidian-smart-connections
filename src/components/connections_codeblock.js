import styles from './connections_codeblock.css' assert { type: 'css' };
import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';

/**
 * Build the main HTML structure for 'Smart Connections Pro' view.
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
  // Post-process UI elements
  post_process.call(this, connections_list, container, opts);
  return frag;
}

/**
 * Post-process DOM fragment for advanced overlays or shared behavior.
 * @param {object} connections_list
 * @param {DocumentFragment|HTMLElement} container
 * @param {object} opts
 * @returns {Promise<DocumentFragment|HTMLElement>}
 */
export async function post_process(connections_list, container, opts = {}) {
  const list_container = container.querySelector('.connections-list-container');
  const env = connections_list.env;
  const app = env.plugin.app || window.app;
  // Render results
  const render_list = async () => {
    console.log('Rendering connections list in codeblock view');
    const connections_list_component_key = opts.connections_list_component_key
      || connections_list.connections_list_component_key
      || 'connections_list_v3'
    ;
    const list = await env.smart_components.render_component(connections_list_component_key, connections_list, opts);
    this.empty(list_container);
    list_container.appendChild(list);
  }

  // register container-level listeners in render since post_process is called frequently
  // (to refresh) while these listeners remain attached
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
      const results = Array.isArray(connections_list.results) ? connections_list.results : [];
      if (!results.length) return new Notice('No connection results to send to Smart Context');
      const smart_context = env.smart_contexts.new_context();
      smart_context.add_items(results.map((r) => ({ key: r.item.key, score: r.score })));
      smart_context.emit_event('context_selector:open');
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

  // Initial
  render_list();

  return container;
}

