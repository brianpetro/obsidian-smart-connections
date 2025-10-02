import { SmartPluginSettingsTab } from "obsidian-smart-env";

export class ScSettingsTab extends SmartPluginSettingsTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async render_plugin_settings(container) {
    if (!container) return;
    const main_settings_fragment = await this.render_component('main_settings', this.plugin);
    if (main_settings_fragment) container.appendChild(main_settings_fragment);
  }
}
