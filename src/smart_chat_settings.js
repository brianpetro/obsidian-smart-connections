const ScTranslations = require("./ScTranslations");
const { SmartSettings } = require("./smart_settings");
// Smart Connections Specific Settings
class SmartChatSettings extends SmartSettings {
  update_smart_chat_folder() { this.plugin.update_smart_chat_folder(); }
  async changed_smart_chat_model(render = true){
    console.log(this.plugin.settings.chat_model_platform_key);
    const platform_config = this.plugin.env.chat_model.platforms[this.plugin.settings.chat_model_platform_key];
    let smart_chat_model_config = this.plugin.settings[this.plugin.settings.chat_model_platform_key];
    if(smart_chat_model_config.model_name){
      const platform_models = await this.plugin.env.chat_model.get_models();
      const model_config = platform_models.find(m => m.model_name === smart_chat_model_config.model_name);
      // console.log("model_config", model_config);
      smart_chat_model_config = {
        ...(smart_chat_model_config || {}),
        ...(platform_config || {}),
        ...(model_config || {}),
      };
      // console.log("smart_chat_model_config", smart_chat_model_config);
      this.plugin.settings[this.plugin.settings.chat_model_platform_key] = smart_chat_model_config;
    }
    await this.plugin.save_settings(true);
    this.plugin.env.chat_model = null;
    this.plugin.env.init_chat_model(this.plugin.settings.chat_model_platform_key);
    if(render) this.render();
  }
  async test_chat_api_key(){
    await this.changed_smart_chat_model();
    const resp = await this.plugin.env.chat_model.test_api_key();
    if(resp) return this.plugin.notices.show('api key test pass', "Success! API key is valid");
    this.plugin.notices.show('api key test fail', "Error: API key is invalid!");
  }
  get self_ref_list() { return "Current: " + ScTranslations[this.config.language].pronouns.join(", "); }
  get template() { return this.templates['smart_chat_settings']; }
  async get_view_data() {
    const view_data = {
      settings: this.plugin.settings,
      chat_platform: this.env.chat_model?.platforms[this.plugin.settings.chat_model_platform_key],
      chat_platforms: this.env.chat_model?.platforms ? Object.keys(this.env.chat_model.platforms).map(platform_key => ({ key: platform_key, ...(this.env.chat_model?.platforms[platform_key] || {}) })) : [],
    };
    view_data.platform_chat_models = await this.plugin.env.chat_model?.get_models();
    view_data.smart_chat_settings = this.ejs.render(this.template, view_data);
    return view_data;
  }
}
exports.SmartChatSettings = SmartChatSettings;