const ScTranslations = require("./ScTranslations");
const { SmartObsidianSettings } = require("./SmartObsidianSettings");
const smart_embed_models = require("smart-embed/models");
const views = require("../build/views.json");
const { SmartView } = require("./SmartView");

// Smart Connections Specific Settings
class SmartConnectionsSettings extends SmartObsidianSettings {
  async refresh_notes() {
    if(!SmartView.is_open(this.plugin.app.workspace)){
      SmartView.open(this.plugin.app.workspace);
      // wait for this.plugin.brain.smart_notes.smart_embed or this.plugin.brain.smart_blocks.smart_embed to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.plugin.brain.smart_notes.import({ reset: true });
  }
  reload_brain() { this.plugin.brain.reload(); }
  force_refresh() { this.plugin.brain.force_refresh(); }
  sync_for_chatgpt() { this.plugin.sync_notes(); }
  update_smart_connections_folder() { this.plugin.update_smart_connections_folder(); }
  // test API key
  async test_api_key() {
    const req = {
      url: `https://api.openai.com/v1/embeddings`,
      method: "POST",
      body: JSON.stringify({ model: "text-embedding-ada-002", input: "test" }),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.plugin.settings.api_key}` },
    };
    try{
      const resp = await this.plugin.obsidian.requestUrl(req);
      if(resp?.json?.data?.[0]?.embedding?.length) return this.plugin.notices.show('api key test pass', "Success! API key is valid");
      this.plugin.notices.show('api key test fail', "Error: API key is invalid!");
    }catch(err){
      this.plugin.notices.show('api key test fail', "Error: API key is invalid!");
      console.error("Smart Connections: Error testing API key", err);
    }
  }
  refresh_smart_view() { this.plugin.smart_connections_view.render_nearest(); }
  async exclude_all_top_level_folders() {
    const folders = (await this.app.vault.adapter.list("/")).folders;
    const input = this.container.querySelector("div[data-setting='folder_exclusions'] input");
    input.value = folders.join(", ");
    input.dispatchEvent(new Event("input")); // send update event
    this.update_exclusions();
  }
  async update_language(setting, value, elm) {
    await this.update('language', value);
    const self_ref_pronouns_list = this.container.querySelector("#self-referential-pronouns");
    self_ref_pronouns_list.setText(this.self_ref_list);
  }
  async update_exclusions() {
    this.plugin.brain._file_exclusions = null; // clear file exclusions cache
    this.plugin.brain._folder_exclusions = null; // clear folder exclusions cache
    console.log("render_file_counts");
    const elm = this.container.querySelector("#file-counts");
    console.log("elm", elm);
    const total_files = this.plugin.brain.all_files.length;
    const included_files = this.plugin.brain.files.length;
    elm.setText(`Included files: ${included_files} / Total files: ${total_files}`);
  }
  get self_ref_list() { return "Current: " + ScTranslations[this.config.language].pronouns.join(", "); }
  get template() { return views["smart_settings"]; }
  get view_data() {
    return {
      embedding_models: Object.keys(smart_embed_models).map(model_key => ({ key: model_key, ...smart_embed_models[model_key] })),
      included_files: this.plugin.brain.files.length,
      total_files: this.plugin.brain.all_files.length,
      muted_notices: this.plugin.settings.muted_notices || false,
    };
  }
  unmute_notice(setting) {
    const id = setting.split(".")[1];
    console.log("unmute_notice", id);
    delete this.plugin.settings.muted_notices[id];
    this.update("muted_notices", this.plugin.settings.muted_notices);
    this.render(); // re-render settings
  }
}
exports.SmartConnectionsSettings = SmartConnectionsSettings;
