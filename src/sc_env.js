const { Brain } = require("smart-collections/Brain");
const { SmartMarkdown } = require("smart-chunks"); // npm
const {
  SmartNotes,
  SmartBlocks,
  SmartNote,
  SmartBlock,
} = require("./sc_entities.js");
const { DataviewSocket } = require("./dataview_socket");
const templates = require("../build/views.json");
const ejs = require("../ejs.min");
const { ScChatModel } = require("./sc_chat_model");
const { ScChatsUI } = require("./sc_chats_ui");
const { ScChats } = require("./sc_chats");
const { ScActions } = require("./sc_actions");
class ScEnv extends Brain {
  constructor(plugin, ltm_adapter) {
    super(ltm_adapter);
    this.plugin = plugin;
    this.main = this.plugin; // DEPRECATED
    this.config = this.plugin.settings;
    this.data_path = this.config.smart_connections_folder;
    this.collections = {
      smart_notes: SmartNotes,
      smart_blocks: SmartBlocks,
    };
    this.item_types = {
      SmartNote,
      SmartBlock,
    };
    this.save_timeout = null;
    this.smart_embed_active_models = {};
    this.local_model_type = 'Web';
    this.dv_ws = null;
    this.chat = null;
    // references
    this.ejs = ejs;
    this.templates = templates;
  }
  async reload() {
    this.unload();
    this.config = this.plugin.settings;
    await this.init();
  }
  unload() {
    this.unload_entities();
    this.smart_embed_active_models = {};
    if(this.dv_ws) this.dv_ws.unload();
  }
  unload_entities() {
    if (this.smart_notes) this.smart_notes.unload();
    this.smart_notes = null;
    if (this.smart_blocks) this.smart_blocks.unload();
    this.smart_blocks = null;
  }
  async reload_entities() {
    this.unload_entities();
    if(this.plugin.is_initializing_entities) this.plugin.is_initializing_entities = false; // reset flag
    await this.init_entities();
  }
  async init() {
    DataviewSocket.create(this, 37042); // Smart Connect
    this.smart_markdown = new SmartMarkdown({ ...this.config, skip_blocks_with_headings_only: true }); // initialize smart markdown (before collections, b/c collections use smart markdown)
    await this.init_entities();
    await this.init_import(); // refresh smart notes and init "Start embedding" notification
    this.init_chat_model();
    await this.init_chat();
  }
  // load one at a time to re-use embed models
  async init_entities() {
    if(this.plugin.is_initializing_entities) return console.log('already init entities'); // Check if already initializing
    this.plugin.is_initializing_entities = true; // Set flag to true to indicate initialization has started
    if(this.config.embedding_file_per_note) {
      this.smart_notes = new SmartNotes(this);
      this.smart_blocks = new SmartBlocks(this);
      this.smart_notes.merge_defaults();
      this.smart_blocks.merge_defaults();
      await this.smart_blocks.load_smart_embed();
      await this.smart_notes.load(); // also loads smart blocks
    }else{
      await Promise.all(Object.values(this.collections).map(async (static_collection) => await static_collection.load(this)));
    }
    this.plugin.is_initializing_entities = false; // Reset flag after initialization is complete
  }
  // initiate import of smart notes, shows notice before starting embedding
  async init_import() { if (this.smart_notes.smart_embed || this.smart_blocks.smart_embed) this.smart_notes.import(this.files, { reset: true, show_notice: true }); }
  init_chat_model() {
    let chat_model_config = {};
    if(this.config.chat_model_platform_key === 'open_router' && !this.config[this.config.chat_model_platform_key]?.api_key) chat_model_config.api_key = process.env.DEFAULT_OPEN_ROUTER_API_KEY;
    else chat_model_config = this.config[this.config.chat_model_platform_key] ?? {};
    this.chat_model = new ScChatModel(this, this.config.chat_model_platform_key, {...chat_model_config });
    this.chat_model._request_adapter = this.plugin.obsidian.requestUrl;
  }
  async init_chat(){
    this.actions = new ScActions(this);
    this.actions.init();
    // wait for chat_view containerEl to be available
    while (!this.plugin.chat_view?.containerEl) await new Promise(r => setTimeout(r, 300));
    this.chat_ui = new ScChatsUI(this, this.plugin.chat_view.containerEl);
    this.chats = new ScChats(this);
    await this.chats.load_all();
  }
  get_tfile(file_path) { return this.plugin.app.vault.getAbstractFileByPath(file_path); }
  async cached_read(file) {
    const t_file = (typeof file === 'string') ? this.get_tfile(file) : file; // handle string (file_path) or Tfile input
    if (!(t_file instanceof this.plugin.obsidian.TFile)) return null;
    return await this.plugin.app.vault.cachedRead(t_file);
  }
  async force_refresh() {
    this.smart_blocks.clear();
    this.smart_notes.clear();
    this.smart_notes.import(this.files); // trigger making new connections
  }
  // prevent saving too often (large files can cause lag)
  save() {
    if (this.save_timeout) clearTimeout(this.save_timeout); // clear save timeout
    this.save_timeout = setTimeout(async () => {
      // require minimum 1 minute since last user activity
      if (this.plugin.last_user_activity && ((Date.now() - this.plugin.last_user_activity) < 60000)) return this.save(); // reset save timeout
      await this._save();
      this.save_timeout = null;
    }, 20000); // set save timeout
  }
  async _save() { await Promise.all(Object.keys(this.collections).map(async (collection_name) => await this[collection_name]._save())); }
  // getters
  get all_files() { return this.plugin.app.vault.getFiles().filter((file) => (file instanceof this.plugin.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas")); } // no exclusions
  get files() { return this.plugin.app.vault.getFiles().filter((file) => (file instanceof this.plugin.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas") && this.is_included(file.path)); }
  is_included(file_path) { return !this.file_exclusions.some(exclusion => file_path.includes(exclusion)); }

  get file_exclusions() {
    if (this._file_exclusions) return this._file_exclusions;
    this._file_exclusions = (this.plugin.settings.file_exclusions?.length) ? this.plugin.settings.file_exclusions.split(",").map((file) => file.trim()) : [];
    return this._file_exclusions = this._file_exclusions.concat(this.folder_exclusions); // merge file exclusions with folder exclusions (parser only checks this.file_exclusions)
  }
  get folder_exclusions() {
    if (this._folder_exclusions) return this._folder_exclusions;
    return this._folder_exclusions = (this.plugin.settings.folder_exclusions?.length) ? this.plugin.settings.folder_exclusions.split(",").map((folder) => {
      folder = folder.trim();
      if (folder.slice(-1) !== "/") return folder + "/";
      return folder;
    }) : [];
  }
  get excluded_headings() {
    if (this._excluded_headings) return this._excluded_headings;
    return this._excluded_headings = (this.plugin.settings.excluded_headings?.length) ? this.plugin.settings.excluded_headings.split(",").map((heading) => heading.trim()) : [];
  }
  get system_prompts() { return this.plugin.app.vault.getMarkdownFiles().filter(file => file.path.includes(this.config.system_prompts_folder) || file.path.includes('.prompt') || file.path.includes('.sp')); }
}
exports.ScEnv = ScEnv;