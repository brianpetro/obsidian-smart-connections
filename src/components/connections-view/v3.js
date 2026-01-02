import styles from './v3.css' assert { type: 'css' };
import { Menu, Notice } from 'obsidian';
import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';
import { copy_to_clipboard } from 'obsidian-smart-env/utils/copy_to_clipboard.js';
import { build_connections_context_items } from '../../utils/connections_context_items.js';
import { get_context_lines } from '../../utils/context_lines.js';
import { connections_view_refresh_handler } from '../../utils/connections_view_refresh_handler.js';
import { format_connections_as_links } from '../../utils/format_connections_as_links.js';
import { filter_hidden_results } from '../../utils/filter_hidden_results.js';

/**
 * Build the main HTML structure for 'Smart Connections Pro' view.
 * @param {object} view
 * @param {object} opts
 * @returns {Promise<string>}
 */
export async function build_html(view, opts = {}) {
  const is_paused = Boolean(view.paused);
  const pause_title = is_paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
  const top_bar_buttons = [
    {
      title: pause_title,
      icon: is_paused ? 'play-circle' : 'pause-circle',
      attrs: `data-action="toggle-pause" aria-pressed="${is_paused}"`
    },
    {
      title: 'More actions',
      icon: 'menu',
      attrs: 'data-action="open-menu"'
    }
  ].map(btn => `
    <button
      aria-label="${btn.title}"
      ${btn.attrs ?? ''}
    >
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');

  const html = `<div><div class="connections-view connections-item-view sc-connections-view connections-view-early">
    <div class="sc-top-bar connections-top-bar">
      <div class="connections-actions">
        ${top_bar_buttons}
      </div>
      <p class="sc-context" data-key="">
        Loading...
      </p>
    </div>
    <div class="connections-list-container"></div>
    <div class="connections-bottom-bar"></div>
  </div></div>`;

  return html;
}

/**
 * Render the 'Smart Connections Pro' fragment, including optional ranking.
 * @param {object} view
 * @param {object} opts
 * @returns {Promise<DocumentFragment>}
 */
export async function render(view, opts = {}) {
  const html = await build_html.call(this, view, opts);
  const frag = this.create_doc_fragment(html);
  this.apply_style_sheet(styles);
  const container = frag.querySelector('.sc-connections-view');
  // Post-process UI elements
  post_process.call(this, view, container, opts);
  return frag;
}

/**
 * Post-process DOM fragment for advanced overlays or shared behavior.
 * @param {object} view
 * @param {DocumentFragment|HTMLElement} container
 * @param {object} opts
 * @returns {Promise<DocumentFragment|HTMLElement>}
 */
export async function post_process(view, container, opts = {}) {
  const list_container = container.querySelector('.connections-list-container');
  const sc_top_bar_context = container.querySelector('.sc-top-bar .sc-context');
  const env = view.env;
  let connections_item = opts.connections_item;
  if (!connections_item) {
    list_container.textContent = 'No source item detected for current active view.';
    return container;
  }
  let connections_list = connections_item.connections || env.connections_lists.new_item(connections_item);

  // register container-level listeners in render since post_process is called frequently
  // (to refresh) while these listeners remain attached
  if (!container._has_listeners) {
    container._has_listeners = true;

    const pause_button = container.querySelector('[data-action="toggle-pause"]');
    pause_button?.addEventListener('click', () => {
      view.toggle_connections_paused();
    });

    const open_help = () => {
      StoryModal.open(view.plugin, {
        title: 'Getting Started With Smart Connections',
        url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help#page=understanding-connections-1'
      });
    };

    const menu_button = container.querySelector('[data-action="open-menu"]');
    menu_button?.addEventListener('click', (event) => {
      const menu = new Menu(view.plugin.app);

      const raw_results = Array.isArray(connections_list?.results) ? connections_list.results : [];
      const connections_state = connections_list?.item?.data?.connections || {};
      const visible_results = filter_hidden_results(raw_results, connections_state);

      // Refresh
      menu.addItem((menu_item) => {
        menu_item
          .setTitle('Refresh connections')
          .setIcon('refresh-cw')
          .onClick(() => {
            connections_view_refresh_handler.call(view, { target: container });
          })
        ;
      });

      // Open as context
      menu.addItem((menu_item) => {
        const context_items = build_connections_context_items({
          source_item: connections_item,
          results: visible_results
        });
        menu_item
          .setTitle('Send results to Smart Context')
          .setIcon('briefcase')
          .setDisabled(!context_items.length)
          .onClick(async () => {
            if (!context_items.length) return new Notice('No connection results to send to Smart Context');
            const smart_context = env.smart_contexts.new_context();
            smart_context.add_items(context_items);
            smart_context.emit_event('context_selector:open');
            connections_list.emit_event('connections:sent_to_context');
          })
        ;
      });

      // Copy as list of links
      menu.addItem((menu_item) => {
        const links_payload = format_connections_as_links(visible_results);
        menu_item
          .setTitle('Copy as list of links')
          .setIcon('copy')
          .setDisabled(!links_payload)
          .onClick(async () => {
            if (!links_payload) return new Notice('No connection results to copy');
            await copy_to_clipboard(links_payload);
            new Notice('Connections links copied to clipboard');
            connections_list.emit_event('connections:copied_list');
          })
        ;
      });

      // Fold / unfold all
      menu.addItem((menu_item) => {
        const connections_settings = opts.connections_settings
          ?? connections_list?.settings
        ;
        const expanded = connections_settings?.expanded_view;
        const title = expanded ? 'Collapse all results' : 'Expand all results';
        const icon_name = expanded ? 'fold-vertical' : 'unfold-vertical';
        menu_item
          .setTitle(title)
          .setIcon(icon_name)
          .onClick(() => {
            const curr_settings = opts.connections_settings
              ?? connections_list?.settings
            ;
            const curr_expanded = curr_settings?.expanded_view;
            if (curr_settings) curr_settings.expanded_view = !curr_expanded;

            container.querySelectorAll('.sc-result').forEach((elm) => {
              curr_expanded ? elm.classList.add('sc-collapsed') : elm.classList.remove('sc-collapsed');
            });
          })
        ;
      });

      // Exclude same folder toggle
      menu.addItem((menu_item) => {
        const connections_settings = opts.connections_settings
          ?? connections_list?.settings
        ;
        const exclude_same_folder = connections_settings?.exclude_same_folder ?? false;
        const title = exclude_same_folder ? 'Show notes from same folder' : 'Hide notes from same folder';
        const icon_name = exclude_same_folder ? 'folder-check' : 'folder-x';
        menu_item
          .setTitle(title)
          .setIcon(icon_name)
          .onClick(() => {
            const curr_settings = opts.connections_settings
              ?? connections_list?.settings
            ;
            if (curr_settings) {
              curr_settings.exclude_same_folder = !exclude_same_folder;
              connections_view_refresh_handler.call(view, { target: container });
            }
          })
        ;
      });

      // Exclude rootline toggle
      menu.addItem((menu_item) => {
        const connections_settings = opts.connections_settings
          ?? connections_list?.settings
        ;
        const exclude_rootline = connections_settings?.exclude_rootline ?? false;
        const title = exclude_rootline ? 'Show notes from ancestor folders' : 'Hide notes from ancestor folders';
        const icon_name = exclude_rootline ? 'folder-tree' : 'folder-minus';
        menu_item
          .setTitle(title)
          .setIcon(icon_name)
          .onClick(() => {
            const curr_settings = opts.connections_settings
              ?? connections_list?.settings
            ;
            if (curr_settings) {
              curr_settings.exclude_rootline = !exclude_rootline;
              connections_view_refresh_handler.call(view, { target: container });
            }
          })
        ;
      });

      menu.addSeparator();

      // Settings
      menu.addItem((menu_item) => {
        menu_item
          .setTitle('Connections settings')
          .setIcon('settings')
          .onClick(() => {
            view.open_settings();
          })
        ;
      });

      // Help
      menu.addItem((menu_item) => {
        menu_item
          .setTitle('Help & getting started')
          .setIcon('help-circle')
          .onClick(open_help)
        ;
      });

      menu.showAtMouseEvent(event);
    });
  }

  // Render results
  const connections_list_component_key = opts.connections_list_component_key
    || connections_list.connections_list_component_key
    || 'connections_list_v3'
  ;
  // console.log('connections_list_component_key:', connections_list_component_key);
  const list = await env.smart_components.render_component(connections_list_component_key, connections_list, opts);
  this.empty(list_container);
  list_container.appendChild(list);

  // Top-bar context lines for current entity
  const entity = connections_list?.item || connections_item;
  const [top_line, bottom_line] = get_context_lines(entity);
  this.empty(sc_top_bar_context);
  const doc = sc_top_bar_context.ownerDocument;
  const context_spans = [
    { text: top_line, class_name: 'sc-context-line sc-context-line--parent' },
    { text: bottom_line, class_name: 'sc-context-line sc-context-line--focus' }
  ];
  context_spans.forEach((line) => {
    const span = doc.createElement('span');
    span.className = line.class_name;
    span.textContent = line.text || '\u00a0';
    sc_top_bar_context.appendChild(span);
  });
  sc_top_bar_context.dataset.key = connections_item.key;

  // Keep pause button in sync with view.paused
  const pause_btn = container.querySelector('[data-action="toggle-pause"]');
  if (pause_btn) {
    const update_pause_button = (paused) => {
      const next_title = paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
      pause_btn.title = next_title;
      pause_btn.setAttribute('aria-label', `${next_title}`);
      pause_btn.setAttribute('aria-pressed', String(paused));
      this.safe_inner_html(
        pause_btn,
        this.get_icon_html(paused ? 'play-circle' : 'pause-circle')
      );
    };
    update_pause_button(Boolean(view.paused));
    view.register_pause_controls({ update: update_pause_button });
  }

  return container;
}