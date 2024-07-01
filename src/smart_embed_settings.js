const { SmartSettings } = require("smart-setting");
const smart_embed_models = require("smart-embed-model/models.json");
// Smart Connections Specific Settings
class SmartEmbedSettings extends SmartSettings {
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
  async test_api_key_openai_embeddings() {
    const req = {
      url: `https://api.openai.com/v1/embeddings`,
      method: "POST",
      body: JSON.stringify({ model: "text-embedding-ada-002", input: "test" }),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.plugin.settings.api_key}` },
    };
    try{
      const resp = await this.plugin.obsidian.requestUrl(req);
      if(resp?.json?.data?.[0]?.embedding?.length){
        return this.plugin.notices.show('api key test pass', "Success! OpenAI API key is valid");
      }
      this.plugin.notices.show('api key test fail', "Error: OpenAI API key is invalid!");
    }catch(err){
      this.plugin.notices.show('api key test fail', "Error: OpenAI API key is invalid!");
      console.error("Smart Connections: Error testing OpenAI API key", err);
    }
  }
  reload_env() { this.env.reload(); } // DEPRECATED
  restart_plugin() { this.plugin.restart_plugin(); }
  get template() { return this.templates['smart_embed_settings']; }
  async get_view_data() {
    const view_data = {
      settings: this.plugin.settings,
      embedding_models: Object.keys(smart_embed_models).map(model_key => ({ key: model_key, ...smart_embed_models[model_key] })),
    };
    view_data.smart_embed_settings = this.ejs.render(this.template, view_data);
    return view_data;
  }
}
exports.SmartEmbedSettings = SmartEmbedSettings;