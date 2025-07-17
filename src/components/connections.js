import { StoryModal } from 'obsidian-smart-env/modals/story.js';
import { SmartNoteInspectModal } from "obsidian-smart-env/views/source_inspector.js";

function build_top_bar_buttons(view_env) {
  const expanded_view =
    view_env.settings.smart_view_filter.expanded_view ??
    view_env.settings.expanded_view; /* @deprecated */

  const buttons = [
    { title: 'Refresh', icon: 'refresh-cw' },
    { title: 'Fold all toggle', icon: expanded_view ? 'fold-vertical' : 'unfold-vertical' },
    { title: 'Lookup', icon: 'search' },
    { title: 'Settings', icon: 'settings' },
    { title: 'Help', icon: 'help-circle' }
  ];

  return buttons
    .map(
      (btn) => `
    <button title="${btn.title}" aria-label="${btn.title} button">
      ${this.get_icon_html(btn.icon)}
    </button>`
    )
    .join('');
}

export async function build_html(entity, opts = {}) {
  const top_bar_buttons = build_top_bar_buttons.call(this, entity.env);
  return `<div><div class="sc-connections-view">
    <div class="sc-top-bar">
      <p class="sc-context" data-key="">Loading…</p>
      ${top_bar_buttons}
    </div>
    <div class="sc-list"></div>
    <div class="sc-bottom-bar">
      <span class="sc-context" data-key="" title="Loading context…">Loading context…</span>
      ${opts.attribution || ''}
    </div>
  </div></div>`;
}

export async function render(entity, opts = {}) {
  const html = await build_html.call(this, entity, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.sc-connections-view');
  post_process.call(this, entity, container, opts);
  return container;
}

export async function post_process(entity, container, opts = {}) {
  const plugin = entity.env.smart_connections_plugin;
  const list_el = container.querySelector('.sc-list');
  const header_ctx = container.querySelector('.sc-top-bar .sc-context');
  const footer_ctx = container.querySelector('.sc-bottom-bar .sc-context');
  const filter_settings = entity.env.settings.smart_view_filter;

  const render_results = async () => {
    const exclude_keys = Object.keys(entity.data.hidden_connections || {});
    const results = await entity.find_connections({
      exclude_key_ends_with: '---frontmatter---',
      exclude_blocks_from_source_connections: filter_settings.exclude_blocks_from_source_connections ?? false,
      exclude_keys,
      ...(opts.filter || {}),
    });

    const results_frag = await entity.env.render_component(
      'connections_results',
      results,
      opts
    );

    this.empty(list_el);
    Array.from(results_frag.children).forEach((el) => list_el.appendChild(el));

    /* update context labels */
    header_ctx.innerText = entity.path.split('/').pop();
    footer_ctx.innerText = entity.path.split('/').pop();
    header_ctx.dataset.key = entity.key;
    footer_ctx.dataset.key = entity.key;
    list_el.dataset.key = entity.key;
  };

  if(entity.vec) {
    await render_results(); /* initial fetch */
  }else{
    // if no vectorization, show warning
    list_el.createEl('p', {
      text: 'This source is not embedded. Check your Smart Environment settings. For example, the current content may be less than the minimum embedding size.',
      cls: 'sc-warning'
    });
    // button to show source inspector
    const inspect_btn = list_el.createEl('button', {
      text: 'Inspect Source',
      cls: 'sc-inspect-source-btn',
      title: 'Inspect source details'
    });
    inspect_btn.addEventListener('click', async () => {
      new SmartNoteInspectModal(plugin, entity).open();
    });
  }

  const toggle_btn = container.querySelector('[title="Fold all toggle"]');
  toggle_btn.addEventListener('click', () => {
    const expanded =
      entity.env.settings.smart_view_filter.expanded_view ??
      entity.env.settings.expanded_view;

    entity.env.settings.smart_view_filter.expanded_view = !expanded;

    list_el.querySelectorAll('.sc-result').forEach((elm) =>
      expanded ? elm.classList.add('sc-collapsed') : elm.classList.remove('sc-collapsed')
    );

    this.safe_inner_html(
      toggle_btn,
      this.get_icon_html(expanded ? 'unfold-vertical' : 'fold-vertical')
    );
  });

  const refresh_btn = container.querySelector('[title="Refresh"]');
  refresh_btn.addEventListener('click', async () => {
    await entity.read();
    entity.queue_import();
    await entity.collection.process_source_import_queue?.();
    await render_results();
  });

  /* Lookup opens Smart Lookup view */
  container
    .querySelector('[title="Lookup"]')
    ?.addEventListener('click', () => plugin.open_lookup_view());

  /* Help */
  container.querySelector('[title="Help"]')?.addEventListener('click', () =>
    StoryModal.open(plugin, {
      title: 'Getting Started With Smart Connections',
      url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help#page=understanding-connections-1'
    })
  );

  /* Settings */
  container.querySelector('[title="Settings"]')?.addEventListener('click', async () => {
    await app.setting.open();
    await app.setting.openTabById('smart-connections');
  });

  /* make plaintext vs markdown toggle persist */
  if (!filter_settings.render_markdown) list_el.classList.add('sc-result-plaintext');


  container.querySelectorAll(".sc-context").forEach(el => {
    el.addEventListener("click", (event) => {
      new SmartNoteInspectModal(plugin, entity).open();
    });
  });

  return container;
}
