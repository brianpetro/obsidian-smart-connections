import { render as render_results } from "smart-entities/components/results.js";

export async function build_html(scope, opts = {}) {
  const context_name = (scope.path).split('/').pop();
  const html = `<div class="sc-connections-view">
    <div class="sc-top-bar">
      <p class="sc-context" data-key="${scope.path}">
        ${scope.env.smart_sources.keys.length} (${scope.env.smart_blocks.keys.length})
      </p>
      <button class="sc-refresh">${this.get_icon_html('refresh-cw')}</button>
      <button class="sc-fold-toggle">${this.get_icon_html(scope.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical')}</button>
      <button class="sc-filter">${this.get_icon_html('sliders-horizontal')}</button>
      <button class="sc-search">${this.get_icon_html('search')}</button>
      <button class="sc-help" 
              aria-label="Open help documentation"
              title="Open help documentation">
        ${this.get_icon_html('help-circle')}
      </button>
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

export async function render(source, opts = {}) {
  let html = await build_html.call(this, source, opts);
  const frag = this.create_doc_fragment(html);
  const results = source.find_connections({ ...opts, exclude_source_connections: source.env.smart_blocks.settings.embed_blocks });
  
  const sc_list = frag.querySelector('.sc-list');
  const results_frag = await render_results.call(this, results, opts);
  Array.from(results_frag.children).forEach((elm) => sc_list.appendChild(elm));
  return await post_process.call(this, source, frag, opts);
}

export async function post_process(source, frag, opts = {}) {
  const container = frag.querySelector('.sc-list');
  const overlay_container = frag.querySelector(".sc-overlay");
  const render_filter_settings = async () => {
    if(!overlay_container) throw new Error("Container is required");
    overlay_container.innerHTML = '';
    const filter_frag = await this.render_settings(source.collection.connections_filter_config, {
      scope: {
        settings: source.env.settings,
        refresh_smart_view: opts.refresh_smart_view,
        refresh_smart_view_filter: render_filter_settings.bind(this),
      }
    });
    overlay_container.innerHTML = '';
    overlay_container.appendChild(filter_frag);
    this.on_open_overlay(overlay_container);
  }

  // Add fold/unfold all functionality
  const toggle_button = frag.querySelector(".sc-fold-toggle");
  toggle_button.addEventListener("click", () => {
    const expanded = source.env.settings.expanded_view;
    container.querySelectorAll(".sc-result").forEach((elm) => {
      if (expanded) {
        elm.classList.add("sc-collapsed");
      } else {
        elm.classList.remove("sc-collapsed");
        const collection_key = elm.dataset.collection;
        const entity = source.env[collection_key].get(elm.dataset.path);
        entity.render_item(elm.querySelector("li"));
      }
    });
    source.env.settings.expanded_view = !expanded;
    toggle_button.innerHTML = this.get_icon_html(source.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical');
    toggle_button.setAttribute('aria-label', source.env.settings.expanded_view ? 'Fold all' : 'Unfold all');
  });

  const filter_button = frag.querySelector(".sc-filter");
  filter_button.addEventListener("click", () => {
    render_filter_settings();
  });

  // refresh smart view
  const refresh_button = frag.querySelector(".sc-refresh");
  refresh_button.addEventListener("click", () => {
    opts.refresh_smart_view();
  });

  // search
  const search_button = frag.querySelector(".sc-search");
  search_button.addEventListener("click", () => {
    opts.open_lookup_view();
  });

  // help documentation
  const help_button = frag.querySelector(".sc-help");
  help_button.addEventListener("click", () => {
    window.open("https://docs.smartconnections.app/connections-pane", "_blank");
  });

  return frag;
}