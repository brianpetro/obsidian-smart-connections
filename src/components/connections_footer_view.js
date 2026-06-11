// import styles from './connections-view/v3.css';
import styles from './connections_footer_view.css';

const FOOTER_FOLDED_STORAGE_KEY = 'sc_footer_connections_folded';
const FOOTER_LIST_COLLAPSED_CLASS = 'sc-footer-list-collapsed';

function get_footer_connections_folded() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(FOOTER_FOLDED_STORAGE_KEY) === 'true';
}

function set_footer_connections_folded(folded) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FOOTER_FOLDED_STORAGE_KEY, String(folded));
}

function apply_footer_fold_state(header_container, list_container, folded) {
  if (!header_container || !list_container) return;
  list_container.classList.toggle(FOOTER_LIST_COLLAPSED_CLASS, Boolean(folded));
  if (folded) {
    header_container.setAttribute('aria-label', 'Click to expand');
    header_container.classList.add('is-collapsed');
    return;
  }
  header_container.setAttribute('aria-label', 'Click to collapse');
  header_container.classList.remove('is-collapsed');
}

/**
 * Build the main HTML structure for the footer connections view.
 * @param {object} view
 * @param {object} opts
 * @returns {Promise<string>}
 */
export async function build_html(view, opts = {}) {
  // Previous footer wrapper kept the legacy "connections-view-early" class:
  // <div class="connections-view connections-footer-view sc-connections-view connections-view-early">
  const html = `<div class="embedded-backlinks">
    <div class="backlink-pane sc-footer-backlink-pane">
      <div class="tree-item-self is-clickable" aria-label="Click to collapse">
        <div class="tree-item-inner">Smart Connections</div>
      </div>
      <div class="search-result-container">
        <div class="sc-connections-wrapper">
          <div class="connections-view connections-footer-view connections-footer-view-shell sc-connections-view">
            <div class="connections-list-container"></div>
            <div class="connections-bottom-bar"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  return html;
}

/**
 * Render the footer connections fragment.
 * @param {object} view
 * @param {object} opts
 * @returns {Promise<HTMLElement>}
 */
export async function render(view, opts = {}) {
  const html = await build_html.call(this, view, opts);
  const frag = this.create_doc_fragment(html);
  this.apply_style_sheet(styles);
  const container = frag.firstElementChild;
  await post_process.call(this, view, container, opts);
  return container;
}

/**
 * Post-process DOM fragment for footer connections behavior.
 * @param {object} view
 * @param {HTMLElement} container
 * @param {object} opts
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(view, container, opts = {}) {
  const list_container = container.querySelector('.connections-list-container');
  const header_container = container.querySelector('.is-clickable');
  const env = view.env;
  const connections_item = opts.connections_item;

  if (!list_container) return container;

  header_container?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next_folded = !get_footer_connections_folded();
    set_footer_connections_folded(next_folded);
    apply_footer_fold_state(header_container, list_container, next_folded);
  });

  apply_footer_fold_state(header_container, list_container, get_footer_connections_folded());

  if (!connections_item) {
    return container;
  }

  const connections_list = connections_item.connections || env.connections_lists.new_item(connections_item);
  const connections_list_component_key = opts.connections_list_component_key
    || connections_list.connections_list_component_key
    || 'connections_list_v4'
  ;
  const list = await env.smart_components.render_component(connections_list_component_key, connections_list, { ...opts });

  this.empty(list_container);
  list_container.appendChild(list);
  return container;
}

