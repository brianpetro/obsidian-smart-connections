
export async function build_html(view, opts = {}) {
  const top_bar_buttons = [
    { title: 'Refresh', icon: 'refresh-cw' },
    { title: 'Fold toggle', icon: view.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical' },
    { title: 'Lookup', icon: 'search' },
    { title: 'Settings', icon: 'settings' },
    { title: 'Help', icon: 'help-circle' }
  ].map(btn => `
    <button
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
      <div class="sc-settings"></div>
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

  // Add fold/unfold all functionality
  const toggle_button = frag.querySelector("[title='Fold toggle']");
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
    this.safe_inner_html(toggle_button, this.get_icon_html(view.env.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical'));
    toggle_button.setAttribute('aria-label', view.env.settings.expanded_view ? 'Fold all' : 'Unfold all');
  });

  // refresh smart view
  const refresh_button = frag.querySelector("[title='Refresh']");
  refresh_button.addEventListener("click", () => {
    view.refresh();
  });

  // lookup
  const lookup_button = frag.querySelector("[title='Lookup']");
  lookup_button?.addEventListener("click", () => {
    view.plugin.open_lookup_view();
  });

  // help documentation
  const help_button = frag.querySelector("[title='Help']");
  help_button.addEventListener("click", () => {
    window.open("https://docs.smartconnections.app/connections-pane", "_blank");
  });

  // settings
  const settings_button = frag.querySelector("[title='Settings']");
  settings_button.addEventListener("click", () => {
    view.open_settings();
  });

  if(typeof opts.post_process === "function"){
    await opts.post_process(view, frag, opts);
  }

  return frag;
}