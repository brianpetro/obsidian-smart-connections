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
const { SmartChunks } = require('smart-chunks/smart_chunks');
// class ScEnv extends Brain {
class ScEnv {
  constructor(plugin, opts={}) {
    this.sc_adapter_class = opts.sc_adapter_class;
    this.ltm_adapter = opts.sc_adapter_class; // DEPRECATED in v2.2
    this.plugin = plugin;
    this.main = this.plugin; // DEPRECATED
    this.config = this.plugin.settings;
    this.data_path = this.config.smart_connections_folder;
    this.collections = {
      smart_notes: SmartNotes,
      smart_blocks: SmartBlocks,
    };
    this.collection_types = {
      SmartNotes,
      SmartBlocks,
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
  get chat_classes() { return { ScActions, ScChatsUI, ScChats, ScChatModel }; }
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
    this.entities_loaded = false;
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
    this.smart_chunks = new SmartChunks(this, {...this.config, skip_blocks_with_headings_only: true});
    this.init_chat_model();
    DataviewSocket.create(this, 37042); // Smart Connect
    // this.smart_markdown = new SmartMarkdown({ ...this.config, skip_blocks_with_headings_only: true }); // initialize smart markdown (before collections, b/c collections use smart markdown)
    await this.init_entities();
    await this.init_import(); // refresh smart notes and init "Start embedding" notification
    await this.init_chat();
  }
  // load one at a time to re-use embed models (smart-entities-2)
  async init_entities() {
    if(this.plugin.is_initializing_entities) return console.log('already init entities'); // Check if already initializing
    this.plugin.is_initializing_entities = true; // Set flag to true to indicate initialization has started
    this.smart_notes = new this.collection_types.SmartNotes(this, { adapter_class: this.sc_adapter_class });
    this.smart_blocks = new this.collection_types.SmartBlocks(this, { adapter_class: this.sc_adapter_class });
    this.smart_notes.merge_defaults();
    this.smart_blocks.merge_defaults();
    await this.smart_blocks.load_smart_embed();
    await this.smart_notes.load(); // also loads smart blocks
    this.plugin.is_initializing_entities = false; // Reset flag after initialization is complete
    this.entities_loaded = true;
  }
  // initiate import of smart notes, shows notice before starting embedding
  async init_import() { if (this.smart_notes.smart_embed || this.smart_blocks.smart_embed) this.smart_notes.import(this.files, { reset: true, show_notice: true }); }
  init_chat_model(chat_model_platform_key=null) {
    let chat_model_config = {};
    chat_model_platform_key = chat_model_platform_key ?? this.config.chat_model_platform_key;
    if(chat_model_platform_key === 'open_router' && !this.plugin.settings[chat_model_platform_key]?.api_key) chat_model_config.api_key = process.env.DEFAULT_OPEN_ROUTER_API_KEY;
    else chat_model_config = this.plugin.settings[chat_model_platform_key] ?? {};
    this.chat_model = new this.chat_classes.ScChatModel(this, chat_model_platform_key, {...chat_model_config });
    this.chat_model._request_adapter = this.plugin.obsidian.requestUrl;
  }
  async init_chat(){
    this.actions = new this.chat_classes.ScActions(this);
    this.actions.init();
    // wait for chat_view containerEl to be available
    while (!this.plugin.chat_view?.containerEl) await new Promise(r => setTimeout(r, 300));
    this.chat_ui = new this.chat_classes.ScChatsUI(this, this.plugin.chat_view.container);
    this.chats = new this.chat_classes.ScChats(this);
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
  // from deprecated env (brain)
  get_ref(ref) { return this[ref.collection_name].get(ref.key); }
}
exports.ScEnv = ScEnv;