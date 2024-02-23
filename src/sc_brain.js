const { Brain } = require("../smart-collections/Brain");
// const { SmartMarkdown } = require("../smart-chunks/smart-chunks"); // local
const { SmartMarkdown } = require("smart-chunks"); // npm
const {
  SmartNotes,
  SmartBlocks,
  SmartNote,
  SmartBlock,
} = require("./smart_entities");
const { SmartSocket } = require("./smart_socket");
class DataviewSocket extends SmartSocket {
  constructor(brain, port) {
    super(port);
    this.brain = brain;
    this.dataview_api = null;
  }
  static async create(brain, port) {
    const smartSocket = new DataviewSocket(brain, port);
    await smartSocket.init();
    return smartSocket;
  }
  async init() {
    await this.get_dataview_api();
    await this.connect_to_websocket();
    console.log("DataviewSocket initialized");
  }
  unload() {
    if (this.ws) this.ws.close();
    this.ws = null;
  }
  async get_dataview_api(retries = 0) {
    this.dataview_api = window["DataviewAPI"];
    if (!this.dataview_api) {
      if (retries < 10) {
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
        return this.get_dataview_api(retries + 1);
      } else {
        this.brain.main.show_notice("Dataview API not found");
      }
    }
  }
  async handle_message(event) {
    console.log("Message from server ", event.data);
    console.log(typeof event.data);
    const data = JSON.parse(event.data);
    try{
      const resp = await this.dataview_api.queryMarkdown(data.query, data.rel_path, null);
      console.log(resp);
      this.ws.send(JSON.stringify(resp));
    }catch(err){
      console.error(err);
      this.ws.send(JSON.stringify({status: "error", message: err}));
    }
  }
  on_open() {
    console.log("Connected to websocket");
    this.brain.local_model_type = "websocket";
    // this.brain.reload();
  }
  on_close() {
    console.log("Disconnected from websocket", event.reason);
    this.brain.local_model_type = "local";
    // this.brain.reload();
    // this.reconnect_to_websocket();
  }
}
class ScBrain extends Brain {
  constructor(main, ltm_adapter) {
    super(ltm_adapter);
    this.main = main;
    this.config = this.main.settings;
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
  }
  async reload() {
    this.unload();
    await this.init();
  }
  unload() {
    if (this.smart_notes) this.smart_notes.unload();
    this.smart_notes = null;
    if (this.smart_blocks) this.smart_blocks.unload();
    this.smart_blocks = null;
    this.smart_embed_active_models = {};
    if(this.dv_ws) this.dv_ws.unload();
  }
  async init() {
    // Smart Connect
    this.dv_ws = await DataviewSocket.create(this, 37042);
    // console.log("Initializing SmartBrain");
    this.smart_markdown = new SmartMarkdown({ ...this.config, skip_blocks_with_headings_only: true }); // initialize smart markdown (before collections, b/c collections use smart markdown)
    await Promise.all(Object.values(this.collections).map(async (static_collection) => await static_collection.load(this)));
    // console.log("SmartBrain Collections Loaded");
    await this.init_import(); // refresh smart notes and init "Start embedding" notification
  }
  // initiate import of smart notes, shows notice before starting embedding
  async init_import() { if (this.smart_notes.smart_embed || this.smart_blocks.smart_embed) this.smart_notes.import({ reset: true, show_notice: true }); }

  get_tfile(file_path) { return this.main.app.vault.getAbstractFileByPath(file_path); }
  async cached_read(file) {
    const t_file = (typeof file === 'string') ? this.get_tfile(file) : file; // handle string (file_path) or Tfile input
    if (!(t_file instanceof this.main.obsidian.TFile)) return null;
    return await this.main.app.vault.cachedRead(t_file);
  }
  async force_refresh() {
    this.smart_blocks.clear();
    this.smart_notes.clear();
    this.smart_notes.import(); // trigger making new connections
  }
  // prevent saving too often (large files can cause lag)
  save() {
    if (this.save_timeout) clearTimeout(this.save_timeout); // clear save timeout
    this.save_timeout = setTimeout(async () => {
      // require minimum 1 minute since last user activity
      if (this.main.last_user_activity && ((Date.now() - this.main.last_user_activity) < 60000)) return this.save(); // reset save timeout
      await this._save();
      this.save_timeout = null;
    }, 60000); // set save timeout
  }
  async _save() { await Promise.all(Object.keys(this.collections).map(async (collection_name) => await this[collection_name]._save())); }
  // getters
  get all_files() { return this.main.app.vault.getFiles().filter((file) => (file instanceof this.main.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas")); } // no exclusions
  get files() { return this.main.app.vault.getFiles().filter((file) => (file instanceof this.main.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas") && this.is_included(file.path)); }
  is_included(file_path) { return !this.file_exclusions.some(exclusion => file_path.includes(exclusion)); }

  get file_exclusions() {
    if (this._file_exclusions) return this._file_exclusions;
    this._file_exclusions = (this.main.settings.file_exclusions?.length) ? this.main.settings.file_exclusions.split(",").map((file) => file.trim()) : [];
    return this._file_exclusions = this._file_exclusions.concat(this.folder_exclusions); // merge file exclusions with folder exclusions (parser only checks this.file_exclusions)
  }
  get folder_exclusions() {
    if (this._folder_exclusions) return this._folder_exclusions;
    return this._folder_exclusions = (this.main.settings.folder_exclusions?.length) ? this.main.settings.folder_exclusions.split(",").map((folder) => {
      folder = folder.trim();
      if (folder.slice(-1) !== "/") return folder + "/";
      return folder;
    }) : [];
  }
  get excluded_headings() {
    if (this._excluded_headings) return this._excluded_headings;
    return this._excluded_headings = (this.main.settings.excluded_headings?.length) ? this.main.settings.excluded_headings.split(",").map((heading) => heading.trim()) : [];
  }
}
exports.ScBrain = ScBrain;