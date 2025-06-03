import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';
/**
 * Build the top bar button markup.
 * @param {Object} view
 * @returns {string}
 */
export function build_top_bar_buttons(view) {
  const expanded_view = view.env.settings.smart_view_filter.expanded_view
    ?? view.env.settings.expanded_view // @deprecated
  ;
  const buttons = [
    { title: 'Refresh', icon: 'refresh-cw' },
    { title: 'Fold all toggle', icon: expanded_view ? 'fold-vertical' : 'unfold-vertical' },
    { title: 'Lookup', icon: 'search' },
    { title: 'Settings', icon: 'settings' },
    { title: 'Help', icon: 'help-circle' }
  ];
  return buttons.map(btn => `
    <button
      title="${btn.title}"
      aria-label="${btn.title} button"
    >
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');
}

/**
 * Build the main HTML structure for the connections view.
 * @param {Object} view
 * @param {Object} [opts]
 * @returns {Promise<string>}
 */
export async function build_html(view, opts = {}) {
  const top_bar_buttons = build_top_bar_buttons.call(this, view);
  const html = `<div class="sc-connections-view">
    <div class="sc-top-bar">
      <p class="sc-context" data-key="">
        Loading...
      </p>
      ${top_bar_buttons}
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


/**
 * Render the connections fragment.
 * @param {Object} view
 * @param {Object} [opts]
 * @returns {Promise<DocumentFragment>}
 */
export async function render(view, opts = {}) {
  const html = await build_html.call(this, view, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, view, frag, opts);
}

/**
 * Attach event listeners to the rendered fragment.
 * @param {Object} view
 * @param {DocumentFragment} frag
 * @param {Object} [opts]
 * @returns {Promise<DocumentFragment>}
 */
export async function post_process(view, frag, opts = {}) {
  const container = frag.querySelector('.sc-list');

  // Add fold/unfold all functionality
  const toggle_button = frag.querySelector("[title='Fold all toggle']");
  toggle_button.addEventListener("click", () => {
    const expanded = view.env.settings.smart_view_filter.expanded_view
      ?? view.env.settings.expanded_view // @deprecated
    ;
    if(!view.env.settings.smart_view_filter) view.env.settings.smart_view_filter = {};
    view.env.settings.smart_view_filter.expanded_view = !expanded;
    container.querySelectorAll(".sc-result").forEach(async (elm) => {
      if (expanded) {
        elm.classList.add("sc-collapsed");
      } else {
        elm.classList.remove("sc-collapsed"); // classchange listener will render the result in connected_result.js
      }
    });
    const updated_expanded_view = view.env.settings.smart_view_filter.expanded_view;
    this.safe_inner_html(toggle_button, this.get_icon_html(updated_expanded_view ? 'fold-vertical' : 'unfold-vertical'));
    toggle_button.setAttribute('aria-label', updated_expanded_view ? 'Fold all' : 'Unfold all');
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
  help_button?.addEventListener("click", () => {
    open_url_externally("https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help");
  });

  // settings
  const settings_button = frag.querySelector("[title='Settings']");
  settings_button?.addEventListener("click", () => {
    view.open_settings();
  });

  if(typeof opts.post_process === "function"){
    await opts.post_process(view, frag, opts);
  }

  return frag;
}