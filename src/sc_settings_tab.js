import { PluginSettingTab } from "obsidian";

export class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    // this.config = plugin.settings; // can this be removed?
  }
  display() {
    this.plugin.env.render_settings({
      container: this.containerEl,
      html: this.ejs.render(this.plugin.env.opts.templates.smart_settings, {
        env: this.plugin.env,
        // temp for back compat
        included_files: this.included_files,
        total_files: this.total_files,
      })
    })
  }
  get ejs() { return this.plugin.env.opts.ejs; }
  // get included files count
  get included_files() {
    return this.plugin.app.vault.getFiles()
      .filter((file) => {
        if(!(file instanceof this.plugin.obsidian.TFile) || !(file.extension === "md" || file.extension === "canvas")) return false;
        if(this.plugin.env.fs.is_excluded(file.path)) return false;
        return true;
      })
      .length
    ;
  }
  // get all files count, no exclusions
  get total_files() {
    return this.plugin.app.vault.getFiles()
      .filter((file) => (file instanceof this.plugin.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas"))
      .length
    ;
  }
}