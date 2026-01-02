import { Menu, Notice } from 'obsidian';
import { copy_to_clipboard } from 'obsidian-smart-env/utils/copy_to_clipboard.js';
import styles_css from './v3.css' with { type: 'css' };

import {
  apply_hidden_state,
  apply_pinned_state,
  build_prefixed_connection_key,
  count_hidden_connections,
  count_pinned_connections,
  is_connection_hidden,
  is_connection_pinned,
  remove_all_hidden_states,
  remove_all_pinned_states,
  remove_pinned_state,
} from '../../utils/connections_list_item_state.js';
import { get_item_display_name } from '../../utils/get_item_display_name.js';
import { format_connections_as_links } from '../../utils/format_connections_as_links.js';
import { register_item_hover_popover } from 'obsidian-smart-env/src/utils/register_item_hover_popover.js';
import { register_item_drag } from 'obsidian-smart-env/src/utils/register_item_drag.js';
import { open_source } from "obsidian-smart-env/src/utils/open_source.js";


/**
 * Builds the HTML string for the result component.
 * .temp-container is used so listeners can be added to .sc-result (otherwise does not persist) 
 * @param {Object} result - The results a <Result> object 
 * @param {Object} [params={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(result, params = {}) {
  const item = result.item;
  const env = item.env;
  const score = result.score; // Extract score from opts
  const connections_settings = params.connections_settings
    ?? env.connections_lists.settings
  ;
  const component_settings = connections_settings.components?.connections_list_item_v3 || {};
  const header_html = get_result_header_html(score, item, component_settings);
  const all_expanded = connections_settings.expanded_view;
  
  const show_path_and_tags = connections_settings?.show_path_and_tags ?? false;
  const metadata_html = show_path_and_tags ? get_metadata_html(item) : '';
  
  return `<div class="temp-container">
    <div
      class="sc-result ${all_expanded ? '' : 'sc-collapsed'}"
      data-path="${item.path.replace(/"/g, '&quot;')}"
      data-link="${item.link?.replace(/"/g, '&quot;') || ''}"
      data-collection="${item.collection_key}"
      data-score="${score}"
      data-key="${item.key}"
      draggable="true"
    >
      <span class="header">
        ${this.get_icon_html('right-triangle')}
        <a class="sc-result-file-title" href="#" title="${item.path.replace(/"/g, '&quot;')}" draggable="true">
          ${header_html}
        </a>
      </span>
      ${metadata_html}
      <ul draggable="true">
        <li class="sc-result-file-title" title="${item.path.replace(/"/g, '&quot;')}" data-collection="${item.collection_key}" data-key="${item.key}"></li>
      </ul>
    </div>
  </div>`;
}

/**
 * Renders the result component by building the HTML and post-processing it.
 * @param {Object} result_scope - The result object containing component data.
 * @param {Object} [params={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(result_scope, params = {}) {
  this.apply_style_sheet(styles_css);
  let html = await build_html.call(this, result_scope, params);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.sc-result');
  post_process.call(this, result_scope, container, params);
  return container;
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @param {Object} result_scope - The result object containing component data.
 * @param {Source|Block} result_scope.item - The item data within the result object.
 * @param {DocumentFragment} container - The document fragment to be post-processed.
 * @param {Object} [params={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(result_scope, container, params = {}) {
  const { item } = result_scope;
  const env = item.env;
  const plugin = env.smart_connections_plugin;
  const app = plugin.app;
  const connections_settings = params.connections_settings
    ?? env.connections_lists.settings
  ;
  const component_settings = connections_settings.components?.connections_list_item_v3 || {};
  const should_render_markdown = component_settings?.render_markdown ?? true;
  if (!should_render_markdown) container.classList.add('sc-result-plaintext');

  const source_item = result_scope.connections_list?.item;
  const prefixed_key = build_prefixed_connection_key(item.collection_key, item.key);
  container.dataset.prefixedKey = prefixed_key;
  const connection_state = source_item?.data?.connections;
  if (is_connection_hidden(connection_state, prefixed_key)) {
    container.style.display = 'none';
    container.dataset.hidden = 'true';
  }
  if (is_connection_pinned(connection_state, prefixed_key)) {
    container.classList.add('sc-result-pinned');
    container.dataset.pinned = 'true';
  }

  const render_result = async (_result_elm) => {
    if (!_result_elm.querySelector('li').innerHTML) {
      const collection_key = _result_elm.dataset.collection;
      const entity = env[collection_key].get(_result_elm.dataset.path);
      let markdown;
      if (should_render_embed(entity)) markdown = `${entity.embed_link}\n\n${await entity.read()}`;
      else markdown = process_for_rendering(await entity.read());
      let entity_frag;
      if (should_render_markdown) entity_frag = await this.render_markdown(markdown, entity);
      else entity_frag = this.create_doc_fragment(markdown);
      container.querySelector('li').appendChild(entity_frag);
    }
  };


  const toggle_fold_elm = container.querySelector('.header .svg-icon.right-triangle');
  toggle_fold_elm.addEventListener('click', toggle_result);
  const event_key_domain = params.event_key_domain || 'connections';
  const drag_event_key = `${event_key_domain}:drag_result`;
  register_item_drag(container, item, { drag_event_key });
  register_item_hover_popover(container, item, { event_key_domain });
  container.addEventListener('click', (event) => {
    open_source(item, event);
    item.emit_event(`${event_key_domain}:open_result`, { event_source: 'connections-list-item-v3' });
  });

  const observer = new MutationObserver((mutations) => {
    const has_expansion_change = mutations.some((mutation) => {
      const target = mutation.target;
      return mutation.attributeName === 'class' &&
        mutation.oldValue?.includes('sc-collapsed') !== target.classList.contains('sc-collapsed');
    });

    if (has_expansion_change && !mutations[0].target.classList.contains('sc-collapsed')) {
      render_result(mutations[0].target);
    }
  });
  observer.observe(container, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class']
  });

  plugin.registerDomEvent(container, 'contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(!source_item) return;
    source_item.data.connections ||= {};
    const prefixed_key = build_prefixed_connection_key(
      item.collection_key,
      item.key
    );
    const pinned = is_connection_pinned(source_item.data.connections, prefixed_key);
    const hidden_count = count_hidden_connections(source_item.data.connections);
    const pinned_count = count_pinned_connections(source_item.data.connections);
    const results = result_scope.connections_list?.results || [];
    const target_name = get_item_display_name(item, component_settings) || item.key;
    console.log({target_name, item});
    const menu = new Menu(app);
    menu.addItem((menu_item) => {
      menu_item
        .setTitle(`Hide ${target_name}`)
        .setIcon('eye-off')
        .onClick(() => {
          try {
            apply_hidden_state(source_item.data.connections, prefixed_key, Date.now());
            if (source_item.data.hidden_connections) {
              delete source_item.data.hidden_connections[item.key];
              if (!Object.keys(source_item.data.hidden_connections).length) delete source_item.data.hidden_connections;
            }
            source_item.queue_save();
            container.style.display = 'none'; // hide the result element
            container.dataset.hidden = 'true';
            source_item.collection.save();
          } catch (err) {
            new Notice('Hide failed – check console');
            console.error(err);
          }
        })
      ;
    });
    menu.addItem((menu_item) => {
      const title_prefix = pinned ? 'Unpin' : 'Pin';
      menu_item
        .setTitle(`${title_prefix} ${target_name}`)
        .setIcon(pinned ? 'pin-off' : 'pin')
        .onClick(() => {
          try {
            if (pinned) {
              remove_pinned_state(source_item.data.connections, prefixed_key);
              container.classList.remove('sc-result-pinned');
              container.removeAttribute('data-pinned');
            } else {
              apply_pinned_state(source_item.data.connections, prefixed_key, Date.now());
              container.classList.add('sc-result-pinned');
              container.dataset.pinned = 'true';
            }
            source_item.queue_save();
            source_item.collection.save();
          } catch (err) {
            new Notice(`${title_prefix} failed – check console`);
            console.error(err);
          }
        })
      ;
    });
    // separator
    menu.addSeparator();
    const links_payload = format_connections_as_links(results);
    if (links_payload) {
      menu.addItem((menu_item) => {
        menu_item
          .setTitle('Copy as list of links')
          .setIcon('copy')
          .onClick(async () => {
            await copy_to_clipboard(links_payload);
            new Notice('Connections links copied to clipboard');
            result_scope.connections_list.emit_event('connections:copied_list');
          })
        ;
      });
    }
    menu.addSeparator();
    // unhide-all
    menu.addItem((menu_item) => {
      menu_item
        .setTitle(`Unhide All (${hidden_count})`)
        .setIcon('eye')
        .setDisabled(!hidden_count)
        .onClick(() => {
          try {
            if(!source_item.data.connections) return;
            const changed = remove_all_hidden_states(source_item.data.connections);
            if (!changed) return;
            if (source_item.data.hidden_connections) delete source_item.data.hidden_connections;
            source_item.queue_save();
            container.closest('.sc-connections-view')?.querySelector('[title="Refresh"]')?.click(); // refresh the results
            source_item.collection.save();
          } catch (err) {
            new Notice('Unhide failed – check console');
            console.error(err);
          }
        })
      ;
    });
    menu.addItem((menu_item) => {
      menu_item
        .setTitle(`Unpin All (${pinned_count})`)
        .setIcon('pin-off')
        .setDisabled(!pinned_count)
        .onClick(() => {
          try {
            if(!source_item.data.connections) return;
            const changed = remove_all_pinned_states(source_item.data.connections);
            if (!changed) return;
            const list_root = container.closest('.connections-list');
            list_root?.querySelectorAll('.sc-result[data-pinned]')
              .forEach((result_el) => {
                result_el.classList.remove('sc-result-pinned');
                result_el.removeAttribute('data-pinned');
              });
            source_item.queue_save();
            source_item.collection.save();
          } catch (err) {
            new Notice('Unpin failed – check console');
            console.error(err);
          }
        })
      ;
    });
    menu.showAtMouseEvent(event);
  });

  if(!container.classList.contains('sc-collapsed')) {
    render_result(container);
  }

  return container;
}

/**
 * Builds the metadata HTML line (path + tags) for a result item.
 * @param {Object} item - The item (Source or Block)
 * @returns {string} HTML string for the metadata line
 */
function get_metadata_html(item) {
  if (!item) return '';
  
  const parts = [];
  
  if (item.path) {
    parts.push(`<span class="sc-meta-path" title="Path: ${item.path.replace(/"/g, '&quot;')}">${item.path}</span>`);
  }
  
  const tags = get_item_tags(item);
  if (tags.length > 0) {
    const tags_html = tags
      .map(tag => `<span class="sc-meta-tag">#${tag}</span>`)
      .join(' ');
    parts.push(`<span class="sc-meta-tags">${tags_html}</span>`);
  }
  
  if (parts.length === 0) return '';
  
  return `<div class="sc-result-metadata">${parts.join(' • ')}</div>`;
}

/**
 * Extracts tags from an item (Source or Block).
 * @param {Object} item - The item
 * @returns {string[]} Array of tag names (without #)
 */
function get_item_tags(item) {
  if (!item) return [];
  
  const tags = item.tags 
    || item.data?.tags
    || item.data?.frontmatter?.tags
    || [];
  
  if (!Array.isArray(tags)) return [];
  
  return tags.map(tag => {
    if (typeof tag !== 'string') return String(tag);
    return tag.startsWith('#') ? tag.substring(1) : tag;
  });
}

function get_result_header_html(score, item, component_settings = {}) {
  const raw_parts = get_item_display_name(item, component_settings).split(' > ').filter(Boolean);
  const parts = format_item_parts(raw_parts, item?.lines);
  const name = parts.pop();
  const formatted_score = typeof score === 'number' ? score.toFixed(2) : '';
  const separator = '<small class="sc-breadcrumb-separator"> &gt; </small>';
  const parts_html = parts
    .map(part => (`<small class="sc-breadcrumb">${part}</small>`))
    .join(separator)
  ;
  return [
    `<small class="sc-breadcrumb sc-score">${formatted_score}</small>`,
    `${parts_html}${separator}`,
    `<small class="sc-breadcrumb sc-title">${name}</small>`,
  ].join('');
}

function format_item_parts(parts, lines = []) {
  if (!Array.isArray(parts) || !parts.length) return [];
  const has_line_marker = Array.isArray(lines) && lines.length;
  return parts.map((part) => {
    if (has_line_marker && part.startsWith('{')) {
      return `Lines: ${lines.join('-')}`;
    }
    return part;
  });
}

export function should_render_embed(entity) {
  if (!entity) return false;
  if (entity.is_media) return true;
  return false;
}

export function process_for_rendering(content) {
  // prevent dataview rendering
  if (content.includes('```dataview')) content = content.replace(/```dataview/g, '```\\dataview');
  if (content.includes('```smart-context')) content = content.replace(/```smart-context/g, '```\\smart-context');
  if (content.includes('```smart-chatgpt')) content = content.replace(/```smart-chatgpt/g, '```\\smart-chatgpt');
  // prevent link embedding
  if (content.includes('![[')) content = content.replace(/\!\[\[/g, '! [[');
  return content;
}

function toggle_result(event) {
  event.preventDefault();
  event.stopPropagation();
  const _result_elm = event.target.closest('.sc-result');
  _result_elm.classList.toggle('sc-collapsed');
};

export const settings_config = {
  "show_full_path": {
    name: "Show full path",
    type: "toggle",
    description: "Turning on will include the folder path in the connections results.",
    default: true,
  },
  "render_markdown": {
    name: "Render markdown",
    type: "toggle",
    description: "Turn off to prevent rendering markdown and display connection results as plain text.",
    default: true,
  },
  "show_path_and_tags": {
    name: "Show path and tags",
    type: "toggle",
    description: "Show the file path and tags below each connection result.",
    default: false,
  },
};