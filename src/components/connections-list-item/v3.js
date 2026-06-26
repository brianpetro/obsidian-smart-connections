import { Menu } from 'obsidian';
import styles_css from './v3.css';

import {
  build_prefixed_connection_key,
  is_connection_hidden,
  is_connection_pinned,
} from '../../utils/connections_list_item_state.js';
import { DISPLAY_SEPARATOR, get_item_display_name } from 'obsidian-smart-env/src/utils/get_item_display_name.js';
import { register_item_hover_popover } from 'obsidian-smart-env/src/utils/register_item_hover_popover.js';
import { register_item_drag } from 'obsidian-smart-env/src/utils/register_item_drag.js';
import { open_source } from "obsidian-smart-env/src/utils/open_source.js";
import { filter_hidden_results } from '../../utils/filter_hidden_results.js';

const SC_RESULT_HIDDEN_CLASS = 'sc-result-hidden-by-feedback';

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
  const score_display = result.score_display ?? score;
  const connections_settings = params.connections_settings
    ?? env.connections_lists.settings
  ;
  const component_settings = connections_settings.components?.connections_list_item_v3 || {};
  const header_html = get_result_header_html(score_display, item, component_settings);
  const all_expanded = connections_settings.expanded_view;
  
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
    container.classList.add(SC_RESULT_HIDDEN_CLASS);
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

    const connections_list = result_scope.connections_list;
    const raw_results = Array.isArray(connections_list?.results) ? connections_list.results : [];
    const visible_results = filter_hidden_results(raw_results, source_item.data.connections);
    const list_container = container.closest('.connections-list') || container;
    const target_name = get_item_display_name(item, component_settings) || item.key;
    const menu = new Menu(app);

    env.build_menu?.('connections:list_item_menu', menu, connections_list, {
      container,
      prefixed_key,
      target_item: item,
      target_name,
      view: params.view,
    });

    menu.addSeparator();

    env.build_menu?.('connections:list_menu', menu, connections_list, {
      container: list_container,
      connections_settings,
      visible_results,
      view: params.view,
    });

    menu.showAtMouseEvent(event);
  });

  if(!container.classList.contains('sc-collapsed')) {
    render_result(container);
  }

  return container;
}

function get_result_header_html(score, item, component_settings = {}) {
  const raw_parts = get_item_display_name(item, component_settings).split(DISPLAY_SEPARATOR).filter(Boolean);
  const parts = format_item_parts(raw_parts, item?.lines);
  const name = parts.pop();
  const formatted_score = typeof score === 'number' ? score.toFixed(2) : score;
  const separator = '<small class="sc-breadcrumb-separator"> &gt; </small>';
  const parts_html = parts
    .map(part => (`<small class="sc-breadcrumb">${part}</small>`))
    .join(separator)
  ;
  return [
    `<small class="sc-breadcrumb sc-score">${formatted_score}</small>`,
    `${parts_html}${separator}`,
    `<small class="sc-breadcrumb sc-title">${name.endsWith('.md') ? name.replace(/\.md$/, '') : name}</small>`,
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
    // default: true,
    group: "Connections list item"
  },
  "render_markdown": {
    name: "Render markdown",
    type: "toggle",
    description: "Turn off to prevent rendering markdown and display connection results as plain text.",
    // default: true,
    group: "Connections list item"
  },
};
