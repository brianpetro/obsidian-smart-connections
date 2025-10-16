import { StoryModal } from 'obsidian-smart-env/modals/story.js';
import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';
import { toggle_plugin_ribbon_icon } from "../utils/toggle_plugin_ribbon_icon.js";

async function build_html(scope_plugin) {
  return `
    <div id="smart-connections-settings">
      <div data-user-agreement></div>

      <div id="smart-connections-getting-started-container">
        <button class="sc-getting-started-button">Getting started guide</button>
        <button class="sc-report-bug-button">Report a bug</button>
        <button class="sc-request-feature-button">Request a feature</button>
        <button class="sc-share-workflow-button">Share workflow ⭐</button>
      </div>

      <div data-connections-settings-container>
        <h2>Connections view</h2>
      </div>

      <div data-ribbon-icons-settings>
        <h2>Ribbon icons</h2>
      </div>

    </div>
  `;
}

export async function render(scope_plugin) {
  if (!scope_plugin.env) {
    const load_frag = this.create_doc_fragment(`
      <div><button>Load Smart Environment</button></div>
    `);
    load_frag.querySelector('button').addEventListener('click', (e) => {
      scope_plugin.env.load(true);
      e.target.replaceWith(
        this.create_doc_fragment('<span>Reload settings after Smart Environment loads…</span>')
      );
    });
    return load_frag;
  }
  const html = await build_html.call(this, scope_plugin);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, scope_plugin, frag);
}

export async function post_process(scope_plugin, frag) {
  /* user agreement & env settings */
  const user_agreement_container = frag.querySelector('[data-user-agreement]');
  if (user_agreement_container) {
    const user_agreement = await scope_plugin.env.render_component(
      'user_agreement_callout',
      scope_plugin
    );
    user_agreement_container.appendChild(user_agreement);
  }

  /* connections‑view settings */
  const connections_settings = frag.querySelector('[data-connections-settings-container]');
  if (connections_settings) {
    const connections_settings_frag = await this.render_settings(
      scope_plugin.env.smart_sources.connections_filter_config,
      { scope: { settings: scope_plugin.env.settings } }
    );
    connections_settings.appendChild(connections_settings_frag);
  }

  /* ribbon icon settings */
  const ribbon_container = frag.querySelector('[data-ribbon-icons-settings]');
  if (ribbon_container) {
    if (!scope_plugin.env.settings.ribbon_icons) scope_plugin.env.settings.ribbon_icons = {};
    const ribbon_frag = await this.render_settings(
      (scope_plugin.ribbon_icon_settings_config || {}),
      {
        scope: {
          settings: scope_plugin.env.settings.ribbon_icons,
          toggle_plugin_ribbon_icon: (setting_path, value) => {
            toggle_plugin_ribbon_icon(scope_plugin, setting_path, value);
          },
        } 
      }
    );
    ribbon_container.appendChild(ribbon_frag);
  }

  /* header external links */
  const header_link = frag.querySelector('#header-callout a');
  if (header_link) {
    header_link.addEventListener('click', (e) => {
      e.preventDefault();
      open_url_externally(scope_plugin, header_link.href);
    });
  }

  /* buttons */
  frag.querySelector('.sc-getting-started-button')?.addEventListener('click', () => {
    StoryModal.open(scope_plugin, {
      title: 'Getting Started With Smart Connections',
      url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-settings'
    });
  });

  frag.querySelector('.sc-report-bug-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/issues/new?template=bug_report.yml'
    );
  });

  frag.querySelector('.sc-request-feature-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/issues/new?template=feature_request.yml'
    );
  });

  frag.querySelector('.sc-share-workflow-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/discussions/new?category=showcase'
    );
  });

  return frag;
}
