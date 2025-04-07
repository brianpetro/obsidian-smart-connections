import { render as render_muted_notices } from "./muted_notices.js";

async function build_html(scope_plugin) {
  const html = `
    <div id="smart-connections-settings">
      ${render_mobile_warning(scope_plugin)}
      ${render_info_callout()}
      ${render_brief_supporters_snippet(scope_plugin)}
      <div data-connections-settings-container>
        <h2>Connections view</h2>
      </div>
      <div data-smart-settings="env"></div>
      <div data-smart-notices></div>
      <!-- OLD -->
      ${render_mobile_toggle(scope_plugin)}
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
      scope_plugin.load_env();
      e.target.replaceWith(this.create_doc_fragment('<span>Reload settings after Smart Environment loads...</span>'));
    });
    return load_frag;
  }
  const html = await build_html.call(this, scope_plugin);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, scope_plugin, frag);
}

export async function post_process(scope_plugin, frag) {
  const muted_notices_frag = await render_muted_notices.call(this, scope_plugin.env);
  frag.querySelector('[data-smart-notices]').appendChild(muted_notices_frag);
  await this.render_setting_components(frag, { scope: scope_plugin });

  const env_settings_container = frag.querySelector('[data-smart-settings="env"]');
  if(env_settings_container){
    const env_settings_frag = await scope_plugin.env.render_component('env_settings', scope_plugin.env);
    env_settings_container.appendChild(env_settings_frag);
  }

  // wire up "Open Supporters Modal" button
  const supportersButton = frag.querySelector('[data-setting="smart_community"] button');
  if (supportersButton) {
    supportersButton.addEventListener('click', () => {
      scope_plugin.open_supporters_modal();
    });
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

  return frag;
}

function render_mobile_warning(scope_plugin) {
  if (scope_plugin.obsidian.Platform.isMobile && !scope_plugin.settings.enable_mobile) {
    return `
      <div data-callout-metadata="" data-callout-fold="" data-callout="warning" class="callout">
        <div class="callout-title">
          <div class="callout-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="svg-icon lucide-alert-triangle">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
            </svg>
          </div>
          <div class="callout-title-inner">Mobile is DISABLED.</div>
        </div>
        <div class="callout-content">
          <p>Toggle "Enable mobile" setting to activate mobile.</p>
        </div>
      </div>
    `;
  }
  return '';
}

function render_info_callout() {
  return `
    <div data-callout-metadata="" data-callout-fold="" data-callout="info" class="callout" style="mix-blend-mode: unset;">
      <div class="callout-title">
        <div class="callout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-info">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg></div>
        <div class="callout-title-inner">
          <p><strong>User Agreement:</strong> By using Smart Connections you agree to share how it helps you with at least one other person 😊🌴</p>
          <hr>
          <i>Join the next <a href="https://lu.ma/calendar/cal-ZJtdnzAdURyouM7">Lean Coffee session</a> to discuss future features & improvements.</i>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a short snippet plus a button for opening the full supporters section in a modal.
 */
function render_brief_supporters_snippet(scope_plugin) {
  return `
    <div class="sc-supporters-brief">
      <h2>Community Supporters</h2>
      <div class="setting-component"
        data-name="Smart Community"
        data-setting="smart_community"
        data-type="button"
        data-btn-text="Join us"
        data-description="Your support accelerates new features and improvements for everyone. Thank you!"
      ></div>
    </div>
  `;
}

function render_mobile_toggle(scope) {
  return `
    <hr>
    <div class="setting-component"
      data-name="Enable mobile (EXPERIMENTAL)"
      data-description="Enable mobile support for Smart Connections."
      data-type="toggle"
      data-setting="enable_mobile"
      data-callback="toggle_mobile"
    ></div>
  `;
}

