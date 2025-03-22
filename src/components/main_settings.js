import { render as render_muted_notices } from "./muted_notices.js";

async function build_html(scope_plugin) {
  const html = `
    <div id="smart-connections-settings">
      ${render_mobile_warning(scope_plugin)}
      ${render_info_callout()}
      ${render_supporters_section(scope_plugin)}
      <h2>Smart Environment</h2>
      <div data-smart-settings="env"></div>
      <p>Notes about embedding models:</p>
      <ul>
        <li>IMPORTANT: make sure local <code>BGE-micro-v2</code> embedding model works before trying other local models.</li>
        <li>Local model compatibility depends on available CPU and RAM. Try reducing the max tokens (context) if a local model if failing.</li>
        <li>API models are not dependent on local compute, but they require an API key and send your notes to third-party servers for processing.</li>
      </ul>
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
      // replace button with "reload settings after smart environment loads"
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
  const smart_settings_containers = frag.querySelectorAll('[data-smart-settings]');
  for(const container of smart_settings_containers) {
    const sub_scope = container.dataset.smartSettings.split('.').reduce((acc, key) => acc[key], scope_plugin);
    await sub_scope.render_settings(container);
  }
  const supporter_container = frag.querySelector('.sc-supporters');
  if(supporter_container){
    // make .sc-supporters 100% max-height when clicking anywhere in it
    const expand_container = (e) => {
      e.currentTarget.style.maxHeight = '100%';
      e.currentTarget.removeEventListener('click', expand_container);
      e.currentTarget.removeEventListener('scroll', expand_container);
    };
    supporter_container.addEventListener('click', expand_container);
    supporter_container.addEventListener('scroll', expand_container);
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
        <div class="callout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-info">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg></div>
        <div class="callout-title-inner"><p><strong>User Agreement:</strong> By using Smart Connections you agree to share how it helps you with at least one other person 😊🌴</p></div>
      </div>
    </div>
  `;
}

function render_supporters_section(scope_plguin) {
  // Implement the supporters section here
  const stable_release_html = scope_plguin.EARLY_ACCESS ? '' : `<p>The success of Smart Connections is a direct result of our community of supporters who generously fund and evaluate new features. Their unwavering commitment to our privacy-focused, open-source software benefits all. Together, we can continue to innovate and make a positive impact on the world.</p>`
    + render_supporter_benefits_html()
  ;
  const become_supporter_html = `
    ${render_sign_in_or_open_smart_plugins(scope_plguin)}
    <div class="setting-component"
      data-name="Become a Supporter"
      data-description="Become a Supporter"
      data-type="button"
      data-href="https://buy.stripe.com/9AQ7sWemT48u1LGcN4"
    ></div>`
  ;
  return `<div class="sc-supporters">
    <h1>Smart Connections Supporter Community</h1>
    <i>Join the next <a href="https://lu.ma/calendar/cal-ZJtdnzAdURyouM7">Lean Coffee session</a> to discuss future features & improvements.</i>
    <hr>
    ${stable_release_html}
    <div class="setting-component"
      data-name="Supporter License Key"
      data-type="text"
      data-setting="license_key"
      data-description="Note: this is not required to use Smart Connections."
      data-placeholder="Enter your license_key"
    ></div>
    <div class="setting-component"
      data-name="Smart Connect - Obsidian GPT"
      data-btn-text="Open GPT"
      data-description='Chat with your notes in ChatGPT without uploading your notes to the cloud!'
      data-type="button"
      data-href="https://chat.openai.com/g/g-9Xb1mRJYl-smart-connections-2"
    ></div>
    <div class="setting-component"
      data-name="Supporter Community Chat"
      data-btn-text="Join us"
      data-description='Join the supporter community chat.'
      data-type="button"
      data-href="https://chat.smartconnections.app"
    ></div>
    ${become_supporter_html}
  </div>`;
}

function render_supporter_benefits_html() {
  return `<p><b>Supporter benefits include:</b></p>
    <ul>
      <li>Early access to new &amp; experimental features:
        <ul>
          <li>Early access to new versions enables supporters to help ensure new features are ready for the broader community.</li>
          <li><i>Current Early Access Features:</i><ul>
            <li>🖼️ Add images to Smart Chat (multimodal chat)</li>
            <li>Re-ranking model in the Smart Connections View</li>
            <li>Smart Chat History in canvas format</li>
          </ul></li>
          <li><i>Coming soon to Early Access:</i><ul>
            <li>PDF Support in Smart Connections view</li>
            <li>Edit notes in Smart Chat</li>
            <li>New retrieval methods in Smart Chat</li>
            <li>Review retrieved context before sending in Smart Chat</li>
            <li>Audio files in Smart Connections view</li>
          </ul></li>
          <li><i>Past Early Access Features:</i><ul>
            <li>ChatGPT integration with your Obsidian Vault</li>
            <li>Mobile support for Smart Connections</li>
          </ul></li>
        </ul>
      </li>
      <li>Access to the supporter-only <a href="https://chat.smartconnections.app">private chat</a>:
        <ul>
          <li><i>Community:</i>
            <ul>
              <li>Ask questions and share insights with other supporters.</li>
            </ul>
          </li>
          <li><i>Help &amp; Support (priority):</i>
            <ul>
              <li>Swift, top-priority support in the <a href="https://chat.smartconnections.app">Supporter Chat</a>.</li>
            </ul>
          </li>
          <li><i>Feature Requests (priority):</i>
            <ul>
              <li>Influence the future of Smart Connections with priority feature requests in the <a href="https://chat.smartconnections.app">Supporter Chat</a>.</li>
            </ul>
          </li>
          <li><i>Insider Updates:</i>
            <ul>
              <li>Learn about the latest features &amp; improvements before they are announced.</li>
            </ul>
          </li>
        </ul>
      </li>
      <li><b>For a very limited time:</b> Early access to Smart Connect: Use ChatGPT with your notes <i>without</i> uploading your notes to the cloud using <a href="https://chat.openai.com/g/g-9Xb1mRJYl-smart-connect-obsidian">Smart Connect - Obsidian</a> GPT.</li>
    </ul>
  `;
}

function render_mobile_toggle(scope) {
  return `
    <hr>
    <div class="setting-component"
      data-name="Enable Mobile (EXPERIMENTAL)"
      data-description="Enable mobile support for Smart Connections."
      data-type="toggle"
      data-setting="enable_mobile"
      data-callback="toggle_mobile"
    ></div>
  `;
}

function render_sign_in_or_open_smart_plugins(scope) {
  const isLoggedIn = !!localStorage.getItem('smart_plugins_oauth_token');
  const buttonLabel = isLoggedIn ? 'Open Smart Plugins' : 'Sign in';
  const buttonCallback = isLoggedIn ? 'open_smart_plugins_settings' : 'initiate_smart_plugins_oauth';

  return `
    <div class="setting-component"
      data-name="Smart Plugins - Early Access"
      data-type="button"
      data-btn-text="${buttonLabel}"
      data-description="Sign in to access early-release Smart Plugins"
      data-callback="${buttonCallback}"
    ></div>
  `;
}
