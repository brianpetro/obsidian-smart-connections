const { PluginSettingTab } = require("obsidian");

class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.config = plugin.settings;
  }
  display() {
    this.smart_settings = new this.plugin.ScSettings(this.plugin.env, this.containerEl);
    return this.smart_settings.render();
  }
}
exports.ScSettingsTab = ScSettingsTab;
