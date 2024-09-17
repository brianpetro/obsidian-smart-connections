import { PluginSettingTab } from "obsidian";

export class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    // this.config = plugin.settings; // can this be removed?
  }
  display() {
    console.log('displaying settings tab');
    this.plugin.env.render_settings({
      container: this.containerEl,
      html: this.ejs.render(this.plugin.smart_env_config.templates.smart_settings, {
        env: this.plugin.env,
        // temp for back compat
        included_files: this.plugin.included_files,
        total_files: this.plugin.total_files,
      })
    })
  }
  get ejs() { return this.plugin.smart_env_config.ejs; }
}