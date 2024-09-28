export async function render(scope) {
  const html = `
    <div id="smart-connections-settings">
      ${render_mobile_warning(scope)}
      ${render_info_callout()}
      ${render_supporters_section(scope)}
      <h2>Smart Environment</h2>
      <div data-smart-settings="env"></div>
      <p>Notes about embedding models:</p>
      <ul>
        <li>IMPORTANT: make sure local <code>BGE-micro-v2</code> embedding model works before trying other local models.</li>
        <li>Local model compatibility depends on available CPU and RAM. Try reducing the max tokens (context) if a local model if failing.</li>
        <li>API models are not dependent on local compute, but they require an API key and send your notes to third-party servers for processing.</li>
      </ul>
      <!-- OLD -->
      ${render_muted_notices_section(scope)}
      ${render_mobile_toggle(scope)}
      ${render_version_revert_button(scope)}
    </div>
  `;
  const frag = this.create_doc_fragment(html);
  return post_process.call(this, scope, frag);
}

export async function post_process(scope, frag) {
  await this.render_setting_components(frag, { scope });
  const smart_settings_containers = frag.querySelectorAll('[data-smart-settings]');
  for(const container of smart_settings_containers) {
    const sub_scope = container.dataset.smartSettings.split('.').reduce((acc, key) => acc[key], scope);
    await sub_scope.render_settings(container);
  }
  return frag;
}

function render_mobile_warning(scope) {
  if (scope.obsidian.Platform.isMobile && !scope.settings.enable_mobile) {
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

function render_supporters_section(scope) {
  // Implement the supporters section here
  const stable_release_html = scope.EARLY_ACCESS ? '' : `<p>The success of Smart Connections is a direct result of our community of supporters who generously fund and evaluate new features. Their unwavering commitment to our privacy-focused, open-source software benefits all. Together, we can continue to innovate and make a positive impact on the world.</p>`
    + render_supporter_benefits_html()
  ;
  const become_supporter_html = scope.EARLY_ACCESS ? '' : `<div class="setting-component"
      data-name="Upgrade to Early Access Version (v2.2)"
      data-description="Upgrade to v2.2 (Early Access) to access new features and improvements."
      data-type="button"
      data-btn-text="Upgrade to v2.2"
      data-callback="smart_connections_plugin.update_early_access"
    ></div>
    <div class="setting-component"
      data-name="Become a Supporter"
      data-description="Become a Supporter"
      data-type="button"
      data-href="https://buy.stripe.com/9AQ7sWemT48u1LGcN4"
    ></div>`
  ;
  return `<div class="sc-supporters">
    <h1>Smart Connections Supporter Community</h1>
    ${stable_release_html}
    <div class="setting-component"
      data-name="Supporter License Key"
      data-type="text"
      data-setting="smart_connections_plugin.license_key"
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

function render_muted_notices_section(scope) {
  let html = `
    <h1>Muted Notices</h1>
  `;
  
  if (Object.keys(scope.settings.smart_notices.muted).length) {
    for (const notice in scope.settings.smart_notices.muted) {
      html += `
        <div class="setting-component"
          data-name="${notice}"
          data-setting="smart_notices.muted.${notice}"
          data-type="remove"
          data-btn-text="Unmute"
          data-callback="remove_setting_elm"
        ></div>
      `;
    }
  } else {
    html += `<p>No muted notices.</p>`;
  }
  
  return html;
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

function render_version_revert_button(scope) {
  if (scope.EARLY_ACCESS) {
    return `
      <hr>
      <div class="setting-component"
        data-name="Revert to Stable Release"
        data-btn-text="Revert"
        data-description='Revert to the stable release of Smart Connections. Requires "Check for Updates" and then "Update Plugin" to complete the process.'
        data-type="button"
        data-callback="revert_to_stable_release"
      ></div>
    `;
  }
  return '';
}