import styles from './v3.css';
import { Menu } from 'obsidian';
import { get_context_lines } from '../../utils/context_lines.js';
import { filter_hidden_results } from '../../utils/filter_hidden_results.js';

const CONNECTIONS_TARGET_HISTORY_LIMIT = 10;

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
  ].map((btn) => `
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
      <p
        class="sc-context"
        data-key=""
        data-action="open-target-menu"
        role="button"
        tabindex="0"
        aria-label="Change connections target"
      >
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
  const connections_settings = opts.connections_settings
    ?? connections_list?.settings
  ;

  record_connections_target_history(view, connections_item);
  container._connections_menu_state = {
    view,
    container,
    connections_list,
    connections_settings,
  };

  // register container-level listeners in render since post_process is called frequently
  // (to refresh) while these listeners remain attached
  if (!container._has_listeners) {
    container._has_listeners = true;

    const pause_button = container.querySelector('[data-action="toggle-pause"]');
    pause_button?.addEventListener('click', () => {
      view.toggle_connections_paused();
    });

    const menu_button = container.querySelector('[data-action="open-menu"]');
    menu_button?.addEventListener('click', (event) => {
      const menu = new Menu(view.plugin.app);
      const state = container._connections_menu_state;

      env.build_menu?.('connections:list_menu', menu, state.connections_list, get_connections_menu_params(state));
      menu.showAtMouseEvent(event);
    });

    const open_target_menu = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const state = container._connections_menu_state;
      const menu = new Menu(view.plugin.app);
      env.build_menu?.('connections:target_menu', menu, state.connections_list, get_connections_menu_params(state));
      if (!(menu.items?.length > 0)) return;

      show_menu(menu, event, sc_top_bar_context);
    };

    sc_top_bar_context?.addEventListener('click', open_target_menu);
    sc_top_bar_context?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      open_target_menu(event);
    });
  }

  const connections_list_component_key = opts.connections_list_component_key
    || connections_list.connections_list_component_key
    || 'connections_list_v4'
  ;
  const list = await env.smart_components.render_component(connections_list_component_key, connections_list, {
    ...opts,
    view,
    container,
  });
  this.empty(list_container);
  list_container.appendChild(list);

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
  sc_top_bar_context.dataset.key = entity?.key || connections_item.key;
  sc_top_bar_context.title = 'Change connections target';

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

function get_connections_menu_params(state = {}) {
  const raw_results = Array.isArray(state.connections_list?.results) ? state.connections_list.results : [];
  const connections_state = state.connections_list?.item?.data?.connections || {};
  const visible_results = filter_hidden_results(raw_results, connections_state);

  return {
    view: state.view,
    container: state.container,
    connections_settings: state.connections_settings,
    visible_results,
  };
}

function record_connections_target_history(view, target_item) {
  const source_key = String(target_item?.key || '').split('#')[0];
  if (!view || !source_key) return;

  const history = Array.isArray(view.connections_target_history)
    ? view.connections_target_history
    : []
  ;
  view.connections_target_history = [
    source_key,
    ...history.filter((key) => key !== source_key),
  ].slice(0, CONNECTIONS_TARGET_HISTORY_LIMIT);
}

function show_menu(menu, event, anchor_el) {
  if (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) {
    menu.showAtMouseEvent(event);
    return;
  }

  const rect = anchor_el.getBoundingClientRect();
  if (typeof menu.showAtPosition === 'function') {
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
    return;
  }

  menu.showAtMouseEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left,
    clientY: rect.bottom,
  }));
}
