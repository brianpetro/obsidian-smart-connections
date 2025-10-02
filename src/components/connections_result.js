import { Keymap, Menu, Notice } from 'obsidian';
import { register_block_hover_popover } from 'obsidian-smart-env/utils/register_block_hover_popover.js';
import { handle_drag_result } from '../utils/drag.js';
import { get_block_display_name } from 'smart-blocks/utils/get_block_display_name.js';
import { get_item_display_name } from 'smart-collections/utils/get_item_display_name.js';

/**
 * Builds the HTML string for the result component.
 * .temp-container is used so listeners can be added to .sc-result (otherwise does not persist) 
 * @param {Object} result - The results a <Result> object 
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(result, opts = {}) {
  const item = result.item;
  const score = result.score; // Extract score from opts
  const item_html = get_item_html(score, item, opts);
  
  return `<div class="temp-container">
    <div
      class="sc-result sc-collapsed"
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
          ${item_html}
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
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(result_scope, opts = {}) {
  let html = await build_html.call(this, result_scope, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, result_scope, frag, opts);
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(result_scope, frag, opts = {}) {
  const { item } = result_scope;
  const env = item.env;
  const plugin = env.smart_connections_plugin;
  const app = plugin.app;
  const connections_settings = opts.connections_settings
    ?? env.settings.smart_view_filter
  ;
  const result_elm = frag.querySelector('.sc-result');
  if (!connections_settings.render_markdown) result_elm.classList.add('sc-result-plaintext');

  const render_result = async (_result_elm) => {
    if (!_result_elm.querySelector('li').innerHTML) {
      const collection_key = _result_elm.dataset.collection;
      const entity = env[collection_key].get(_result_elm.dataset.path);
      let markdown;
      if (should_render_embed(entity)) markdown = `${entity.embed_link}\n\n${await entity.read()}`;
      else markdown = process_for_rendering(await entity.read());
      let entity_frag;
      if (connections_settings.render_markdown) entity_frag = await this.render_markdown(markdown, entity);
      else entity_frag = this.create_doc_fragment(markdown);
      result_elm.querySelector('li').appendChild(entity_frag);
    }
  };

  const toggle_result = (_result_elm) => {
    _result_elm.classList.toggle('sc-collapsed');
  };

  const handle_result_click = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    const _result_elm = target.closest('.sc-result');
    if (target.classList.contains('svg-icon')) {
      toggle_result(_result_elm);
      return;
    }

    const link = _result_elm.dataset.link || _result_elm.dataset.path;
    if (_result_elm.classList.contains('sc-collapsed')) {
      if (Keymap.isModEvent(event)) {
        plugin.open_note(link, event);
      } else {
        toggle_result(_result_elm);
      }
    } else {
      plugin.open_note(link, event);
    }
  };

  result_elm.addEventListener('click', handle_result_click.bind(plugin));

  const key = result_elm.querySelector('li').dataset.key;
  result_elm.addEventListener('dragstart', (event) => {
    handle_drag_result(app, event, key);
  });

  /* ---------- hover preview ---------- */
  if (key.indexOf('{') === -1) {
    result_elm.addEventListener('mouseover', (event) => {
      const linktext_path = key.replace(/#$/, ''); // remove trailing hash if present
      app.workspace.trigger('hover-link', {
        event,
        source: 'smart-connections-view',
        hoverParent: result_elm.parentElement,
        targetEl: result_elm,
        linktext: linktext_path
      });
    });
  } else {
    register_block_hover_popover(result_elm.parentElement, result_elm, env, key, plugin);
  }

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

  observer.observe(result_elm, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class']
  });

  plugin.registerDomEvent(result_elm, 'contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const curr_key = result_elm.closest('.sc-list')?.dataset.key;
    if(!curr_key) {
      return;
    }
    const curr_collection = curr_key.includes('#')
      ? env.smart_blocks
      : env.smart_sources
    ;
    const curr_item = curr_collection.get(curr_key);
    if(!curr_item) return;
    const menu = new Menu(app);
    menu.addItem((menu_item) => {
      menu_item
        .setTitle(`Hide ${get_item_name(item, opts)}`)
        .setIcon('eye-off')
        .onClick(() => {
          try {
            if(!curr_item.data.hidden_connections) curr_item.data.hidden_connections = {};
            curr_item.data.hidden_connections[result_elm.dataset.key] = Date.now();
            curr_item.queue_save();
            result_elm.style.display = 'none'; // hide the result element
            curr_item.collection.save();
          } catch (err) {
            new Notice('Hide failed – check console');
            console.error(err);
          }
        })
      ;
    });
    // separator
    menu.addSeparator();
    // unhide-all
    menu.addItem((menu_item) => {
      menu_item
        .setTitle(`Unhide All (${Object.keys(curr_item.data.hidden_connections || {}).length})`)
        .setIcon('eye')
        .onClick(() => {
          try {
            if(!curr_item.data.hidden_connections) return;
            delete curr_item.data.hidden_connections;
            curr_item.queue_save();
            result_elm.closest('.sc-connections-view')?.querySelector('[title="Refresh"]')?.click(); // refresh the results
            curr_item.collection.save();
          } catch (err) {
            new Notice('Unhide failed – check console');
            console.error(err);
          }
        })
      ;
    });
    menu.showAtMouseEvent(event);
  });

  if (!connections_settings.expanded_view) return result_elm;

  // render if already expanded
  toggle_result(result_elm);
  return result_elm;
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

function get_item_html(score, item, opts) {
  const show_full_path = opts.connections_settings?.show_full_path
    ?? item.env.settings.smart_view_filter.show_full_path
  ;
  const [path, name, parts] = parse_item(item, show_full_path);
  const separator = "<small class=\"sc-breadcrumb-separator\"> &gt; </small>"
  return `
    <small class="sc-breadcrumb sc-score">${score?.toFixed(2)}</small>
    <small class="sc-breadcrumb sc-title">${path + name}</small>
  `.trim() + (parts.length ? separator : '') + parts.map((p, i) =>
    `<small class="sc-breadcrumb">${p}</small>` + ( (i + 1 < parts.length) ? separator : '')
  ).join("");
}


/**
 * @example
 * parse_item('title.md')  // => ['', 'title', []]
 * parse_item('title.md#') // => ['', 'title', []]
 *
 * parse_item('folder/path/title.md')       // => ['',             'title', []]
 * parse_item('folder/path/title.md', true) // => ['folder/path/', 'title', []]
 *
 * parse_item('folder/path/title.md#Heading')       // => ['', 'title', ['Heading']]
 * parse_item('folder/path/title.md###Heading#{2}') // => ['', 'title', ['Heading', '{2}']]
 */
function parse_item(item, show_full_path) {
  let name = item.key.replace(/#+$/, '');

  let [path, parts] = name.split(".md#");
  parts = (parts ?? '').split("#").filter(Boolean);

  [path, name] = parse_name(path);

  if (show_full_path)
    return [path, name, parts];
  return ['', name, parts];
}


/**
 * @example
 * parse_name('title.md')      // => ['',      'title']
 * parse_name('path/title.md') // => ['path/', 'title']
 */
function parse_name(key) {
  const path = key.split("/")
  const name = path.pop().replace(/\.md$/, "");
  return [path.length ? path.join("/") + "/" : "", name]
}


function get_item_name(item, opts) {
  const get_display_name = (item.key.includes('#') && !item.key.endsWith('#'))
    ? get_block_display_name
    : get_item_display_name
  ;
  const show_full_path = opts.connections_settings?.show_full_path
    ?? item.env.settings.smart_view_filter.show_full_path
  ;
  return get_display_name(item.key, show_full_path);
}
