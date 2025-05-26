async function build_html(scope_plugin) {
  const html = `
    <div id="smart-connections-settings">
      ${render_header_callout()}
      <div data-connections-settings-container>
        <h2>Connections view</h2>
      </div>
      <div data-smart-settings="env"></div>
      <div data-smart-notices></div>
      ${render_footer_callout()}
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
  const muted_notices_frag = await scope_plugin.env.render_component('muted_notices', scope_plugin.env);
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

function render_footer_callout() {
  return `
    <div data-callout-metadata="" data-callout-fold="" data-callout="info" class="callout" style="mix-blend-mode: unset;">
      <div class="callout-title">
        <div class="callout-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-info">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </div>
        <div class="callout-title-inner">
          <p><strong>Fuel the circle of empowerment</strong></p>
          <p>Your support shapes the future.</p>
          <a href="https://smartconnections.app/community-supporters" class="button">Become a Supporter</a>
        </div>
      </div>
    </div>
  `;
}

function render_header_callout() {
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