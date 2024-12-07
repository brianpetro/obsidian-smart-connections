
export async function build_html(view, opts = {}) {
  const top_bar_buttons = [
    { title: 'Refresh', icon: 'refresh-cw' },
    { title: 'Fold toggle', icon: view.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical' },
    { title: 'Filter', icon: 'sliders-horizontal' },
    { title: 'Search', icon: 'search' },
    { title: 'Help', icon: 'help-circle' }
  ].map(btn => `
    <button
      class="sc-${btn.title.toLowerCase().replace(' ', '-')}"
      title="${btn.title}"
      aria-label="${btn.title} button"
      ${btn.style ? `style="${btn.style}"` : ''}
    >
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');
  const html = `<div class="sc-connections-view">
    <div class="sc-top-bar">
      <p class="sc-context" data-key="">
        Loading...
      </p>
      ${top_bar_buttons}
    </div>
    <div id="settings" class="sc-overlay"></div>
    <div class="sc-advanced-overlay smart-chat-overlay" style="display: none;">
      <div class="sc-advanced-overlay-header">
        <button class="sc-advanced-overlay-close">
          ${this.get_icon_html('x')}
        </button>
      </div>
      <div class="settings-container"></div>
    </div>
    <div class="sc-list">
    </div>
    <div class="sc-bottom-bar">
      <span class="sc-context" data-key="" title="Loading context...">
        Loading context...
      </span>
      ${opts.attribution || ''}
    </div>
  </div>`;

  return html;
}


export async function render(view, opts = {}) {
  let html = await build_html.call(this, view, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, view, frag, opts);
}

export async function post_process(view, frag, opts = {}) {
  const container = frag.querySelector('.sc-list');
  const overlay_container = frag.querySelector(".sc-overlay");
  const render_filter_settings = async () => {
    if(!overlay_container) throw new Error("Container is required");
    overlay_container.innerHTML = '';
    const filter_frag = await this.render_settings(view.env.smart_sources.connections_filter_config, {
      scope: {
        settings: view.env.settings,
        re_render: opts.re_render,
        re_render_settings: render_filter_settings.bind(this),
      }
    });
    overlay_container.innerHTML = '';
    overlay_container.appendChild(filter_frag);
    this.on_open_overlay(overlay_container);
  }

  // Add fold/unfold all functionality
  const toggle_button = frag.querySelector(".sc-fold-toggle");
  toggle_button.addEventListener("click", () => {
    const expanded = view.env.settings.expanded_view;
    container.querySelectorAll(".sc-result").forEach((elm) => {
      if (expanded) {
        elm.classList.add("sc-collapsed");
      } else {
        elm.classList.remove("sc-collapsed");
        const collection_key = elm.dataset.collection;
        const entity = view.env[collection_key].get(elm.dataset.path);
        entity.render_item(elm.querySelector("li"));
      }
    });
    view.env.settings.expanded_view = !expanded;
    toggle_button.innerHTML = this.get_icon_html(view.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical');
    toggle_button.setAttribute('aria-label', view.env.settings.expanded_view ? 'Fold all' : 'Unfold all');
  });

  const filter_button = frag.querySelector(".sc-filter");
  filter_button.addEventListener("click", () => {
    render_filter_settings();
  });

  // refresh smart view
  const refresh_button = frag.querySelector(".sc-refresh");
  refresh_button.addEventListener("click", () => {
    opts.re_render();
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