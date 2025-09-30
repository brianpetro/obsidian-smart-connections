import { PluginSettingTab } from "obsidian";
import { wait_for_env_to_load } from "obsidian-smart-env/utils/wait_for_env_to_load.js";

export class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    /**
     * @property {SmartConnectionsPlugin} plugin - Plugin instance
     */
    this.plugin = plugin;
    /**
     * @property {HTMLElement} main_settings_container - Container for main settings
     */
    this.main_settings_container = null;
  }
  get env() { return this.plugin.env; }

  /**
   * Called by Obsidian to display the settings tab
   */
  display() {
    console.log("displaying settings tab");
    this.render();
  }

  async render() {
    await wait_for_env_to_load(this, { wait_for_states: ['loading', 'loaded'] });
    this.env.smart_view.safe_inner_html(this.containerEl, '<div class="sc-loading">Loading main settings...</div>');
    this.plugin.env.render_component('main_settings', this.plugin).then(frag => {
      this.containerEl.empty();
      this.containerEl.appendChild(frag);
    });
  }
}
