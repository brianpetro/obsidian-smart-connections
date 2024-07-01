const { SmartSettings } = require("smart-setting");
const smart_embed_models = require("smart-embed-model/models.json");
const { SmartChatSettings } = require("./smart_chat_settings");
const { SmartEmbedSettings } = require("./smart_embed_settings");

// Smart Connections Specific Settings
class ScSettings extends SmartSettings {
  constructor(env, container, template_name = "smart_settings") {
    super(env, container, template_name);
    this.chat_settings = new SmartChatSettings(env, container, template_name);
    this.embed_settings = new SmartEmbedSettings(env, container, template_name);
  }
  update_smart_chat_folder() { this.chat_settings.update_smart_chat_folder(); }
  async changed_smart_chat_model(){
    await this.chat_settings.changed_smart_chat_model(false);
    this.render();
  }
  async test_chat_api_key(){ await this.chat_settings.test_chat_api_key(); }
  get self_ref_list() { return this.chat_settings.self_ref_list; }

  async refresh_notes() {
    this.env.smart_notes.import(this.env.files, { reset: true });
  }
  reload_env() { this.env.reload(); } // DEPRECATED
  restart_plugin() { this.plugin.restart_plugin(); }
  force_refresh() { this.env.force_refresh(); }
  sync_for_chatgpt() { this.plugin.sync_notes(); }
  update_smart_connections_folder() { this.plugin.update_smart_connections_folder(); }
  refresh_smart_view() { this.embed_settings.refresh_smart_view(); }
  async connect_to_smart_connect(){ await this.embed_settings.connect_to_smart_connect(); }
  // test API key
  async test_api_key_openai_embeddings() { await this.embed_settings.test_api_key_openai_embeddings(); }
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
    this.plugin.env._file_exclusions = null; // clear file exclusions cache
    this.plugin.env._folder_exclusions = null; // clear folder exclusions cache
    console.log("render_file_counts");
    const elm = this.container.querySelector("#file-counts");
    console.log("elm", elm);
    const total_files = this.plugin.env.all_files.length;
    const included_files = this.plugin.env.files.length;
    elm.setText(`Included files: ${included_files} / Total files: ${total_files}`);
  }
  get template() { return this.templates['smart_settings']; }
  async get_view_data() {
    const view_data = {
      settings: this.plugin.settings,
      embedding_models: Object.keys(smart_embed_models).map(model_key => ({ key: model_key, ...smart_embed_models[model_key] })),
      included_files: this.plugin.env.files.length,
      total_files: this.plugin.env.all_files.length,
      muted_notices: this.plugin.settings.muted_notices || false,
      ...((await this.chat_settings.get_view_data()) || {}),
      ...((await this.embed_settings.get_view_data()) || {}),
    };
    return view_data;
  }
  unmute_notice(setting) {
    const id = setting.split(".")[1];
    console.log("unmute_notice", id);
    delete this.plugin.settings.muted_notices[id];
    this.update("muted_notices", this.plugin.settings.muted_notices);
    this.render(); // re-render settings
  }
  // upgrade to early access
  async upgrade_to_early_access() {
    await this.plugin.update_early_access();
  }
}
exports.ScSettings = ScSettings;

