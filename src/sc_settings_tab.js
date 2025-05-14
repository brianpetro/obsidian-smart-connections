import { PluginSettingTab } from "obsidian";
import { render as main_settings_component } from "./components/main_settings.js";

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

  /**
   * Called by Obsidian to display the settings tab
   */
  display() {
    console.log("displaying settings tab");
    this.render_settings(this.containerEl);
  }

  get smart_view() {
    if(!this._smart_view){
      this._smart_view = new this.plugin.smart_env_config.modules.smart_view.class({
        adapter: this.plugin.smart_env_config.modules.smart_view.adapter
      });
    }
    return this._smart_view;
  }

  async render_settings(container=this.main_settings_container, opts = {}) {
    if(!this.main_settings_container || container !== this.main_settings_container) {
      this.main_settings_container = container;
    }
    if(!container) throw new Error("Container is required");

    this.smart_view.safe_inner_html(container, '<div class="sc-loading">Loading main settings...</div>');
    const frag = await main_settings_component.call(this.smart_view, this.plugin, opts);
    this.smart_view.empty(container);
    container.appendChild(frag);
    return container;
  }
}
