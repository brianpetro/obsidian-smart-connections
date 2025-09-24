import { StoryModal } from 'obsidian-smart-env/modals/story.js';
import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';
import { toggle_plugin_ribbon_icon } from "../utils/toggle_plugin_ribbon_icon.js";
import { findAvailablePortRandom } from "../utils/port_utils.js";
import { Notice } from 'obsidian';

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

      <div data-mcp-settings-container>
        <h2>Claude Code Integration</h2>
        <div class="sc-mcp-settings">
          <div class="sc-mcp-status-row">
            <div class="sc-mcp-status" data-mcp-status>MCP: Loading...</div>
          </div>
          <div class="sc-mcp-port-row">
            <label class="sc-mcp-port-label">
              <span>Port:</span>
              <div class="sc-mcp-port-controls">
                <input type="number" min="8000" max="9999" data-mcp-port-input />
                <button class="sc-mcp-restart-button" data-mcp-restart>Restart Server</button>
              </div>
            </label>
          </div>
          <div class="sc-mcp-command-row">
            <label class="sc-mcp-command-label">
              <span>Add to Claude Code:</span>
              <div class="sc-mcp-command-wrapper">
                <input type="text" readonly class="sc-mcp-command" data-mcp-command />
                <button class="sc-mcp-copy-button" data-mcp-copy>Copy</button>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div data-ribbon-icons-settings>
        <h2>Ribbon icons</h2>
      </div>

      <div data-smart-settings="env"></div>
      <h2>More Smart Plugins</h2>
      <div class="sc-other-plugins">
        <button class="sc-smart-context-button">Quickly copy notes many notes to clipboard</button>
        <button class="sc-smart-chatgpt-button">Embed &amp; bookmark chat threads to notes</button>
        <button class="sc-smart-templates-button">Smart note generation with context + templates</button>
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

  const env_settings_container = frag.querySelector('[data-smart-settings="env"]');
  if (env_settings_container) {
    const env_settings_frag = await scope_plugin.env.render_component(
      'env_settings',
      scope_plugin.env
    );
    env_settings_container.appendChild(env_settings_frag);
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

  /* MCP settings */
  const mcp_container = frag.querySelector('[data-mcp-settings-container]');
  if (mcp_container) {
    await setupMCPSettings(scope_plugin, mcp_container);
  }

  /* ribbon icon settings */
  const ribbon_container = frag.querySelector('[data-ribbon-icons-settings]');
  if (ribbon_container) {
    if (!scope_plugin.env.settings.ribbon_icons) scope_plugin.env.settings.ribbon_icons = {};
    const ribbon_frag = await this.render_settings(
      {
        connections: {
          setting: 'connections',
          name: 'Open connections view',
          description: 'Show the &quot;Open connections view&quot; icon.',
          type: 'toggle',
          callback: 'toggle_plugin_ribbon_icon',
        },
        random_note: {
          setting: 'random_note',
          name: 'Open random connection',
          description: 'Show the &quot;Open random connection&quot; icon.',
          type: 'toggle',
          callback: 'toggle_plugin_ribbon_icon',
        },
      },
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

  /* supporter callout */
  const supporter_callout = await scope_plugin.env.render_component(
    'supporter_callout',
    scope_plugin
  );
  frag.appendChild(supporter_callout);

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

  frag.querySelector('.sc-smart-context-button')?.addEventListener('click', () => {
    open_url_externally(scope_plugin, 'https://obsidian.md/plugins?id=smart-context');
  });

  frag.querySelector('.sc-smart-chatgpt-button')?.addEventListener('click', () => {
    open_url_externally(scope_plugin, 'https://obsidian.md/plugins?id=smart-chatgpt');
  });

  frag.querySelector('.sc-smart-templates-button')?.addEventListener('click', () => {
    open_url_externally(scope_plugin, 'https://obsidian.md/plugins?id=smart-templates');
  });

  return frag;
}

/**
 * Setup MCP settings functionality
 */
async function setupMCPSettings(scope_plugin, container) {
  const statusEl = container.querySelector('[data-mcp-status]');
  const portInputEl = container.querySelector('[data-mcp-port-input]');
  const commandEl = container.querySelector('[data-mcp-command]');
  const copyButtonEl = container.querySelector('[data-mcp-copy]');
  const restartButtonEl = container.querySelector('[data-mcp-restart]');

  // Function to update UI with current MCP status
  function updateMCPUI() {
    const port = scope_plugin.settings?.mcp_server_port;
    const isRunning = scope_plugin.mcp_server && scope_plugin.mcp_server.transport;

    // Update status
    if (isRunning && port) {
      statusEl.textContent = `MCP: Running on port ${port}`;
      statusEl.className = 'sc-mcp-status sc-mcp-status-running';
    } else if (port) {
      statusEl.textContent = `MCP: Stopped (port ${port})`;
      statusEl.className = 'sc-mcp-status sc-mcp-status-stopped';
    } else {
      statusEl.textContent = 'MCP: Not configured';
      statusEl.className = 'sc-mcp-status sc-mcp-status-error';
    }

    // Update port input
    if (port) {
      portInputEl.value = port;
    }

    // Update command
    if (port) {
      commandEl.value = `claude mcp add --transport http smart-connections http://localhost:${port}/mcp`;
    } else {
      commandEl.value = 'MCP server not configured';
    }
  }

  // Function to restart MCP server
  async function restartMCPServer(newPort) {
    try {
      restartButtonEl.textContent = 'Restarting...';
      restartButtonEl.disabled = true;

      // Stop existing server
      if (scope_plugin.mcp_server) {
        await scope_plugin.mcp_server.stop();
      }

      // Update settings if port changed
      if (newPort && newPort !== scope_plugin.settings?.mcp_server_port) {
        scope_plugin.settings.mcp_server_port = newPort;
        await scope_plugin.saveData(scope_plugin.settings);
      }

      // Initialize new server
      await scope_plugin.initializeMCPServer();

      // Update UI
      updateMCPUI();

      new Notice('MCP server restarted successfully');
    } catch (error) {
      console.error('Failed to restart MCP server:', error);
      new Notice(`Failed to restart MCP server: ${error.message}`);
      statusEl.textContent = 'MCP: Error';
      statusEl.className = 'sc-mcp-status sc-mcp-status-error';
    } finally {
      restartButtonEl.textContent = 'Restart Server';
      restartButtonEl.disabled = false;
    }
  }

  // Copy command to clipboard
  copyButtonEl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(commandEl.value);
      copyButtonEl.textContent = 'Copied!';
      setTimeout(() => {
        copyButtonEl.textContent = 'Copy';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      new Notice('Failed to copy to clipboard');
    }
  });

  // Handle port changes
  portInputEl.addEventListener('change', async () => {
    const newPort = parseInt(portInputEl.value);
    if (newPort && newPort >= 8000 && newPort <= 9999) {
      await restartMCPServer(newPort);
    } else {
      new Notice('Port must be between 8000 and 9999');
      portInputEl.value = scope_plugin.settings?.mcp_server_port || '';
    }
  });

  // Handle restart button
  restartButtonEl.addEventListener('click', async () => {
    await restartMCPServer();
  });

  // Initial UI update
  updateMCPUI();

  // Store reference to status element for server to update
  scope_plugin.mcp_status_el = statusEl;
}
