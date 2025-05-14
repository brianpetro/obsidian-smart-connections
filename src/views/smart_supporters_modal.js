
import { Modal } from 'obsidian';

/**
 * @class ScSupportersModal
 * @augments Modal
 * Displays the formerly inline supporters content in a modal.
 */
export class ScSupportersModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    this.titleEl.innerText = 'Smart Connections Supporter Community';
    this.render();
  }

  render() {
    this.modalEl.style.maxHeight = '80vh';
    this.contentEl.empty();

    const container = this.contentEl.createDiv({ cls: 'sc-supporters' });
    this.plugin.env.smart_view.safe_inner_html(container, `
      <p>The success of Smart Connections is a direct result of our community of supporters who generously fund and evaluate new features. 
        Their unwavering commitment to privacy-focused, open-source software benefits all. 
        Together, we can continue to innovate and make a positive impact on the world.</p>
      <p><b>Supporter benefits include:</b></p>
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
      <hr>
      <!-- <div class="setting-component"
        data-name="Supporter License Key"
        data-type="text"
        data-setting="license_key"
        data-description="Note: this is not required to use Smart Connections."
        data-placeholder="Enter your license_key"
      ></div> -->
      ${render_sign_in_or_open_smart_plugins(this.plugin)}
      <div class="setting-component"
        data-name="Become a Supporter"
        data-setting="become_supporter"
        data-btn-text="Become a Supporter"
        data-type="button"
      ></div>
      <div class="setting-component"
        data-setting="open_private_chat"
        data-name="Supporter Community Chat"
        data-btn-text="Join us"
        data-description='Join the supporter community chat.'
        data-type="button"
      ></div>
      <div class="setting-component"
        data-setting="open_gpt"
        data-name="Smart Connect - Obsidian GPT"
        data-btn-text="Open GPT"
        data-description='Chat with your notes in ChatGPT without uploading your notes to the cloud!'
        data-type="button"
      ></div>
    `);
    this.plugin.env.smart_view.render_setting_components(this.contentEl, { scope: this.plugin }).then(() => {
      // e.g. wire up the 'become-supporter-button' to open external link
      const become_supporter = container.querySelector('[data-setting="become_supporter"] button');
      become_supporter?.addEventListener('click', (e) => {
        e.preventDefault();
        this.plugin.open_url_externally('https://buy.stripe.com/9AQ7sWemT48u1LGcN4');
      });
      const open_private_chat = container.querySelector('[data-setting="open_private_chat"] button');
      open_private_chat?.addEventListener('click', (e) => {
        e.preventDefault();
        this.plugin.open_url_externally('https://chat.smartconnections.app/');
      });
      const open_gpt = container.querySelector('[data-setting="open_gpt"] button');
      open_gpt?.addEventListener('click', (e) => {
        e.preventDefault();
        this.plugin.open_url_externally('https://chat.openai.com/g/g-9Xb1mRJYl-smart-connections-2');
      });
    });
  }
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