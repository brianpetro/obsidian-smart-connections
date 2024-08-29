import { PluginSettingTab } from "obsidian";

export class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    // this.config = plugin.settings; // can this be removed?
  }
  display() {
    this.smart_settings = new this.plugin.env.opts.smart_settings_class(this.plugin.env, this.containerEl);
    return this.smart_settings.render();
  }
}