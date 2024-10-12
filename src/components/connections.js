import { render as render_results } from "./results.js";

export async function build_html(scope, opts = {}) {
  const context_name = (scope.link || scope.path).split('/').pop();
  const html = `<div class="sc-connections-view">
    <div class="sc-top-bar">
      <p class="sc-context" data-key="${scope.path}">
        ${scope.env.smart_sources.keys.length} (${scope.env.smart_blocks.keys.length})
      </p>
      <button class="sc-refresh">${this.get_icon_html('refresh-cw')}</button>
      <button class="sc-fold-toggle">${this.get_icon_html(scope.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical')}</button>
      <button class="sc-filter">${this.get_icon_html('sliders-horizontal')}</button>
      <button class="sc-search">${this.get_icon_html('search')}</button>
    </div>
    <div id="settings" class="sc-overlay"></div>
    <div class="sc-list">
    </div>
    <div class="sc-bottom-bar">
      <span class="sc-context" data-key="${scope.path}" title="${scope.path}">
        ${context_name}${opts.re_ranked ? ' (re-ranked)' : ''}
      </span>
      ${opts.attribution || ''}
    </div>
  </div>`;

  return html;
}

export async function render(scope, opts = {}) {
  let html = await build_html.call(this, scope, opts);
  const frag = this.create_doc_fragment(html);
  const results = scope.find_connections(opts);
  
  const sc_list = frag.querySelector('.sc-list');
  const results_frag = await render_results.call(this, scope, { ...opts, results });
  Array.from(results_frag.children).forEach((elm) => sc_list.appendChild(elm));
  return await post_process.call(this, scope, frag, opts);
}

export async function post_process(scope, frag, opts = {}) {
  const container = frag.querySelector('.sc-list');

  // Add fold/unfold all functionality
  const toggle_button = frag.querySelector(".sc-fold-toggle");
  toggle_button.addEventListener("click", () => {
    const expanded = scope.env.settings.expanded_view;
    container.querySelectorAll(".search-result").forEach((elm) => {
      if (expanded) {
        elm.classList.add("sc-collapsed");
      } else {
        elm.classList.remove("sc-collapsed");
        const collection_key = elm.dataset.collection;
        const entity = scope.env[collection_key].get(elm.dataset.path);
        entity.render_item(elm.querySelector("li"));
      }
    });
    scope.env.settings.expanded_view = !expanded;
    toggle_button.innerHTML = this.get_icon_html(scope.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical');
    toggle_button.setAttribute('aria-label', scope.env.settings.expanded_view ? 'Fold all' : 'Unfold all');
  });

  return frag;
}