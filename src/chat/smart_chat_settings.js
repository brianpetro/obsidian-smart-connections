import ScTranslations from "./ScTranslations.json" assert { type: "json" };
import { SmartSettings } from "smart-setting";

// Smart Connections Specific Settings
export class SmartChatSettings extends SmartSettings {
  get settings() { return this.main.env.settings; }
  set settings(settings) { this.main.env.settings = settings; }
  update_smart_chat_folder() { this.plugin.update_smart_chat_folder(); }
  async changed_smart_chat_model(render = true){
    console.log(this.settings.chat_model_platform_key);
    // await this.plugin.save_settings();
    this.env.chat_model = null;
    this.env.smart_connections_plugin.init_chat_model(this.settings.chat_model_platform_key);
    const platform_config = this.env.chat_model.platforms[this.settings.chat_model_platform_key];
    let smart_chat_model_config = this.settings[this.settings.chat_model_platform_key] || {};
    if(smart_chat_model_config.model_name){
      const platform_models = await this.env.chat_model.get_models();
      const model_config = platform_models.find(m => m.model_name === smart_chat_model_config.model_name);
      // console.log("model_config", model_config);
      smart_chat_model_config = {
        ...(smart_chat_model_config || {}),
        ...(platform_config || {}),
        ...(model_config || {}),
      };
      // console.log("smart_chat_model_config", smart_chat_model_config);
      this.settings[this.settings.chat_model_platform_key] = smart_chat_model_config;
    }
    // await this.plugin.save_settings();
    if(render) this.render();
  }
  async test_chat_api_key(){
    await this.changed_smart_chat_model();
    const resp = await this.env.chat_model.test_api_key();
    if(resp) return this.plugin.notices.show('api key test pass', "Success! API key is valid");
    this.plugin.notices.show('api key test fail', "Error: API key is invalid!");
  }
  get self_ref_list() { return "Current: " + ScTranslations[this.settings.language].pronouns.join(", "); }
  get template() { return this.templates['smart_chat_settings']; }
  async get_view_data() {
    const view_data = {
      settings: this.settings,
      chat_platform: this.env.chat_model?.platforms[this.settings.chat_model_platform_key],
      chat_platforms: this.env.chat_model?.platforms ? Object.keys(this.env.chat_model.platforms).map(platform_key => ({ key: platform_key, ...(this.env.chat_model?.platforms[platform_key] || {}) })) : [],
    };
    view_data.platform_chat_models = await this.env.chat_model?.get_models();
    view_data.smart_chat_settings = this.ejs.render(this.template, view_data);
    return view_data;
  }
  async update(setting, value) {
    let settings = {...this.settings};
    if (setting.includes(".")) {
      let parts = setting.split(".");
      let obj = settings;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = (typeof value === "string") ? value.trim() : value;
    } else {
      settings[setting] = (typeof value === "string") ? value.trim() : value;
    }
    this.settings = settings;
    await this.main.save_settings();
  }
  update_language(setting, value, elm) {
    const self_ref_pronouns_list = this.container.querySelector("#self-referential-pronouns");
    self_ref_pronouns_list?.setText(this.self_ref_list);
  }
}
