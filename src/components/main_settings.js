import { StoryModal } from 'obsidian-smart-env/modals/story.js';
import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';

async function build_html(scope_plugin) {
  const html = `
    <div id="smart-connections-settings">
      <div data-user-agreement></div>
      <div id="smart-connections-getting-started-container">
        <button class="sc-getting-started-button">Getting started guide</button>
      </div>
      <div data-connections-settings-container>
        <h2>Connections view</h2>
      </div>
      <div data-smart-settings="env"></div>
      ${render_sign_in_or_open_smart_plugins(scope_plugin)}
    </div>
  `;
  return html;
}

export async function render(scope_plugin) {
  if(!scope_plugin.env){
    const load_frag = this.create_doc_fragment(`
      <div><button>Load Smart Environment</button></div>
    `);
    load_frag.querySelector('button').addEventListener('click', (e) => {
      scope_plugin.env.load(true);
      e.target.replaceWith(this.create_doc_fragment('<span>Reload settings after Smart Environment loads...</span>'));
    });
    return load_frag;
  }
  const html = await build_html.call(this, scope_plugin);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, scope_plugin, frag);
}

export async function post_process(scope_plugin, frag) {
  // Render user agreement callout
  const user_agreement_container = frag.querySelector('[data-user-agreement]');
  if (user_agreement_container) {
    const user_agreement = await scope_plugin.env.render_component('user_agreement_callout', scope_plugin);
    user_agreement_container.appendChild(user_agreement);
  }

  const env_settings_container = frag.querySelector('[data-smart-settings="env"]');
  if(env_settings_container){
    const env_settings_frag = await scope_plugin.env.render_component('env_settings', scope_plugin.env);
    env_settings_container.appendChild(env_settings_frag);
  }

  const connections_settings = frag.querySelector('[data-connections-settings-container]');
  if (connections_settings) {
    const connections_settings_frag = await this.render_settings(scope_plugin.env.smart_sources.connections_filter_config, {
      scope: {
        settings: scope_plugin.env.settings,
        // re_render: scope_plugin.re_render.bind(scope_plugin),
        // re_render_settings: render_connections_settings.bind(this),
      }
    });
    connections_settings.appendChild(connections_settings_frag);
  }

  // open links externally
  const header_btn = frag.querySelector('#header-callout a');
  if(header_btn){
    header_btn.addEventListener('click', (e) => {
      e.preventDefault();
      open_url_externally(scope_plugin, header_btn.href);
    });
  }

  // Render supporter callout
  const supporter_callout = await scope_plugin.env.render_component('supporter_callout', scope_plugin);
  frag.appendChild(supporter_callout);

  // getting started button
  const getting_started_button = frag.querySelector('.sc-getting-started-button');
  if(getting_started_button){
    getting_started_button.addEventListener('click', (e) => {
      StoryModal.open(scope_plugin, {
        title: 'Getting Started With Smart Connections',
        url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-settings',
      });
    });
  }

  return frag;
}

function render_sign_in_or_open_smart_plugins(scope_plugin) {
  const oauth_storage_prefix = scope_plugin.app.vault.getName().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_smart_plugins_oauth_';
  const isLoggedIn = !!localStorage.getItem(oauth_storage_prefix+'token');
  const buttonLabel = isLoggedIn ? 'Open Smart Plugins' : 'Sign in';
  const buttonCallback = isLoggedIn ? 'open_smart_plugins_settings' : 'initiate_smart_plugins_oauth';

  return `
    <div class="setting-component"
      data-name="Smart Plugins - Early Access"
      data-type="button"
      data-btn-text="${buttonLabel}"
      data-description="Supporters can sign in to access early-release Smart Plugins"
      data-callback="${buttonCallback}"
    ></div>
  `;
}