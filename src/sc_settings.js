const { SmartSettings } = require("./smart_settings");
const smart_embed_models = require("smart-embed-model/models.json");
const { PluginSettingTab } = require("obsidian");
const { SmartChatSettings } = require("./smart_chat_settings");

class ScSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.config = plugin.settings;
  }
  display() {
    this.smart_settings = new ScSettings(this.plugin.env, this.containerEl);
    return this.smart_settings.render();
  }
}
exports.ScSettingsTab = ScSettingsTab;

// Smart Connections Specific Settings
class ScSettings extends SmartSettings {
  constructor(env, container, template_name = "smart_settings") {
    super(env, container, template_name);
    this.chat_settings = new SmartChatSettings(env, container, template_name);
  }
  update_smart_chat_folder() { this.chat_settings.update_smart_chat_folder(); }
  async changed_smart_chat_model(){
    await this.chat_settings.changed_smart_chat_model(false);
    this.render();
  }
  async test_chat_api_key(){ await this.chat_settings.test_chat_api_key(); }
  get self_ref_list() { return this.chat_settings.self_ref_list; }


  async refresh_notes() {
    if(!this.plugin.is_smart_view_open()){
      this.plugin.open_view();
      // wait for this.plugin.env.smart_notes.smart_embed or this.plugin.env.smart_blocks.smart_embed to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.plugin.env.smart_notes.import({ reset: true });
  }
  reload_env() { this.plugin.env.reload(); } // DEPRECATED
  restart_plugin() { this.plugin.restart_plugin(); }
  force_refresh() { this.plugin.env.force_refresh(); }
  sync_for_chatgpt() { this.plugin.sync_notes(); }
  update_smart_connections_folder() { this.plugin.update_smart_connections_folder(); }
  refresh_smart_view() { this.plugin.smart_connections_view.render_nearest(); }
  async connect_to_smart_connect(){
    // check if already is connected
    if(this.plugin.env.smart_notes?.smart_embed?.is_smart_connect){
      this.plugin.notices.show('smart connect already connected', 'Already connected to local Smart Connect for embedding.');
      return;
    }
    // check if http://localhost:37420/embed is available
    // console.log('Checking for local Smart Connect server...');
    try{
      await this.plugin.obsidian.requestUrl({url: 'http://localhost:37421/', method: 'GET'});
      this.plugin.notices.show('smart connect found', 'Local Smart Connect server found. Connecting...');
      // restart env if available but smart_embed is not set to use SmartConnect
      this.plugin.restart_plugin();
    }catch(err){
      this.plugin.notices.show('smart connect not found', 'Could not connect to local Smart Connect server');
    }
  }
  // test API key
  async test_api_key_openai_embeddings() {
    const req = {
      url: `https://api.openai.com/v1/embeddings`,
      method: "POST",
      body: JSON.stringify({ model: "text-embedding-ada-002", input: "test" }),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.plugin.settings.api_key_openai}` },
    };
    try{
      const resp = await this.plugin.obsidian.requestUrl(req);
      if(resp?.json?.data?.[0]?.embedding?.length){
        await this.changed_smart_chat_model();
        return this.plugin.notices.show('api key test pass', "Success! OpenAI API key is valid");
      }
      this.plugin.notices.show('api key test fail', "Error: OpenAI API key is invalid!");
    }catch(err){
      this.plugin.notices.show('api key test fail', "Error: OpenAI API key is invalid!");
      console.error("Smart Connections: Error testing OpenAI API key", err);
    }
  }
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
      // chat_platform: this.env.chat_model.platforms[this.plugin.settings.chat_model_platform_key],

    };
    // view_data.platform_chat_models = await this.plugin.env.chat_model.get_models();
    // view_data.smart_chat_settings = this.ejs.render(this.templates['smart_chat_settings'], view_data);
    // const platforms = this.env.chat_model?.platforms;
    // if(!platforms) setTimeout(() => this.render(), 3000); // if no smart_chat_models, set timeout to re render the settings
    // view_data.chat_platforms = platforms ? Object.keys(platforms).map(platform_key => ({ key: platform_key, ...platforms[platform_key] })) : [];
    return view_data;
  }
  unmute_notice(setting) {
    const id = setting.split(".")[1];
    console.log("unmute_notice", id);
    delete this.plugin.settings.muted_notices[id];
    this.update("muted_notices", this.plugin.settings.muted_notices);
    this.render(); // re-render settings
  }

  // DO: REMOVE FROM STABLE RELEASE
  revert_to_v20() {
    this.plugin.revert_to_v20();
  }
}
exports.ScSettings = ScSettings;

