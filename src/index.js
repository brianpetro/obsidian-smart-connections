const {
  addIcon,
  Keymap,
  MarkdownRenderer,
  Notice,
  Plugin,
  request,
  requestUrl,
  TAbstractFile,
  TFile,
} = require("obsidian");
const { ScEnv } = require("./sc_env");
const { default_settings } = require("./default_settings");
// rename modules
const { ScSmartView } = require("./sc_smart_view"); // rename to sc_view.js
const { SmartSearch } = require("./smart_search.js"); // rename to sc_search.js
const { SmartNotices } = require("./smart_notices.js"); // rename to sc_notices.js (extract smart_notices.js as standard structure first)
// v2.1
const { ScChatView } = require("./sc_chat_view.js");
const { ScSettings } = require("./sc_settings.js");
const { ScSettingsTab } = require("./sc_settings_tab.js");
const embed_models = require('smart-embed-model/models.json');
const { ScActionsUx } = require("./sc_actions_ux.js");
const { open_note } = require("./open_note.js");
const { ObsidianAdapter } = require("smart-collections/adapters/obsidian");
const { SmartChatGPTView } = require("./sc_chatgpt_view.js");

class SmartConnectionsPlugin extends Plugin {
  static get defaults() { return default_settings() }
  get item_views() {
    return {
      ScSmartView,
      ScChatView,
      SmartChatGPTView,
    }
  }
  get ScEnv() { return ScEnv };
  get sc_adapter_class() { return ObsidianAdapter; }
  get ScSettings() { return ScSettings };
  get api() { return this._api; }
  async load_settings() {
    Object.assign(this, this.constructor.defaults); // set defaults
    Object.assign(this.settings, await this.loadData()); // overwrites defaults with saved settings
    this.handle_deprecated_settings(); // HANDLE DEPRECATED SETTINGS
  }
  async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("unloading plugin");
    this.env?.unload();
    this.env = null;
    this.brain = null;
    this.notices?.unload();
  }
  async initialize() {
    this.obsidian = require("obsidian");
    this.notices = new SmartNotices(this);
    console.log("Loading Smart Connections v2...");
    await this.load_settings();
    this.smart_connections_view = null;
    this.add_commands(); // add commands
    this.register_views(); // register chat view type
    this.addSettingTab(new ScSettingsTab(this.app, this)); // add settings tab
    await this.check_for_updates();
    this._api = new SmartSearch(this);
    (window["SmartSearch"] = this._api) && this.register(() => delete window["SmartSearch"]); // register API to global window object
    this.addRibbonIcon("smart-connections", "Open: View Smart Connections", () => { this.open_view(); });
    this.addRibbonIcon("message-square", "Open: Smart Chat Conversation", () => { this.open_chat(); });
    this.register_code_blocks();
    this.new_user();
    await this.load_env();
    console.log("Smart Connections v2 loaded");
  }
  register_code_blocks() {
    this.register_code_block("smart-connections", "render_code_block"); // code-block renderer
    this.register_code_block("sc-context", "render_code_block_context"); // code-block renderer
    // "AI change" dynamic code block
    this.register_code_block("sc-change", "change_code_block"); // DEPRECATED
    this.register_code_block("smart-change", "change_code_block");
  }
  register_code_block(name, callback_name) {
    try{
      this.registerMarkdownCodeBlockProcessor(name, this[callback_name].bind(this));
    } catch (error) {
      console.warn(`Error registering code block: ${name}`, error);
    }
  }

  async load_env() {
    this.env = new this.ScEnv(this, {sc_adapter_class: this.sc_adapter_class});
    this.brain = this.env; // DEPRECATED (use this.env instead)
    await this.env.init();
  }
  new_user() {
    if(!this.settings.new_user) return;
    this.settings.new_user = false;
    this.settings.version = this.manifest.version;
    this.open_view();
    this.open_chat();
    if(this.app.workspace.rightSplit.collapsed) this.app.workspace.rightSplit.toggle();
    this.add_to_gitignore("\n\n# Ignore Smart Connections folder\n.smart-connections"); 
    this.save_settings();
  }
  register_views() {
    this.obsidian.addIcon("smart-connections", `<path d="M50,20 L80,40 L80,60 L50,100" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M30,50 L55,70" stroke="currentColor" stroke-width="5" fill="none"/>
    <circle cx="50" cy="20" r="9" fill="currentColor"/>
    <circle cx="80" cy="40" r="9" fill="currentColor"/>
    <circle cx="80" cy="70" r="9" fill="currentColor"/>
    <circle cx="50" cy="100" r="9" fill="currentColor"/>
    <circle cx="30" cy="50" r="9" fill="currentColor"/>`);
    Object.values(this.item_views).forEach(View => {
      this.registerView(View.view_type, (leaf) => (new View(leaf, this)));
    });
  }
  async check_for_updates() {
    if(this.settings.version !== this.manifest.version){
      this.settings.version = this.manifest.version; // update version
      await this.save_settings(); // save settings
    }
    setTimeout(this.check_for_update.bind(this), 3000); // run after 3 seconds
    setInterval(this.check_for_update.bind(this), 10800000); // run check for update every 3 hours
  }
  // check for update
  async check_for_update() {
    // fail silently, ex. if no internet connection
    try {
      // get latest release version from github
      const {json: response} = await requestUrl({
        url: "https://api.github.com/repos/brianpetro/obsidian-smart-connections/releases/latest",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        contentType: "application/json",
      });
      // get version number from response
      const latest_release = response.tag_name;
      // console.log(`Latest release: ${latest_release}`);
      // if latest_release is newer than current version, show message
      if(latest_release !== this.manifest.version) {
        new Notice(`[Smart Connections] A new version is available! (v${latest_release})`);
        this.update_available = true;
      }
    } catch (error) {
      console.log(error);
    }
  }
  async restart_plugin() {
    await this.saveData(this.settings); // save settings
    await new Promise(r => setTimeout(r, 3000));
    window.restart_plugin = async (id) => {
      console.log("restarting plugin", id);
      await window.app.plugins.disablePlugin(id);
      await window.app.plugins.enablePlugin(id);
      console.log("plugin restarted", id);
    };
    await window.restart_plugin(this.manifest.id);
  }

  add_commands() {
    // make connections command
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      editorCallback: (editor) => {
        if(editor.somethingSelected()) this.view.render_nearest(editor.getSelection());
        else if(editor.getCursor()?.line){ // if cursor is on a line greater than 0
          const line = editor.getCursor().line;
          const block = this.brain.smart_notes.current_note.get_block_by_line(line);
          console.log(block);
          console.log(line);
          this.view.render_nearest(block);
        }
        else this.view.render_nearest();
      }
    });
    // make connections command
    this.addCommand({
      id: "sc-refresh-connections",
      name: "Refresh & Make Connections",
      icon: "pencil_icon",
      hotkeys: [],
      editorCallback: async (editor) => {
        // get current note
        const curr_file = this.app.workspace.getActiveFile();
        // const curr_note = this.env?.smart_notes.get(curr_file.path);
        // delete note entity from cache
        delete this.view?.nearest_cache[curr_file.path];
        // delte note entity from collection
        this.env.smart_notes.delete(curr_file.path);
        // import note
        await this.env.smart_notes.import([curr_file]);
        setTimeout(() => {
          // refresh view
          this.view.render_nearest();
        }, 1000);
      }
    });
    // open view command
    this.addCommand({
      id: "smart-connections-view",
      name: "Open: View Smart Connections",
      callback: () => { this.open_view(); }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => { this.open_chat(); }
    });
    // open random note from nearest cache
    this.addCommand({
      id: "smart-connections-random",
      name: "Random Note",
      callback: () => {
        const curr_file = this.app.workspace.getActiveFile();
        const curr_note = this.brain?.smart_notes.get(curr_file.path);
        const nearest = curr_note.find_connections();
        const rand = Math.floor(Math.random() * nearest.length/2); // divide by 2 to limit to top half of results
        const rand_entity = nearest[rand]; // get random from nearest cache
        // rand_entity.note ? rand_entity.note.open() : rand_entity.open(); // open random file
        this.open_note(rand_entity.path);
      }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chatgpt",
      name: "Open: Smart ChatGPT",
      callback: () => { this.open_chatgpt(); }
    });
  }
  async make_connections(selected_text=null) {
    if(!this.view) await this.open_view(); // open view if not open
    await this.view.render_nearest(selected_text);
  }
  async save_settings(rerender=false) {
    await this.saveData(this.settings); // Obsidian API->saveData
    await this.load_settings(); // re-load settings into memory
    // re-render view if set to true (for example, after adding API key)
    if(rerender) {
      this.nearest_cache = {};
      console.log("rerendering view");
      await this.make_connections();
    }
  }
  // utils
  async add_to_gitignore(ignore, message=null) {
    if(!(await this.app.vault.adapter.exists(".gitignore"))) return; // if .gitignore skip
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(ignore) < 0) {
      await this.app.vault.adapter.append(".gitignore", `\n\n${message ? "# " + message + "\n" : ""}${ignore}`);
      console.log("Added to .gitignore: " + ignore);
    }
  }
  show_notice(message, opts={}) {
    console.log("old showing notice");
    const notice_id = typeof message === 'string' ? message : message[0];
    return this.notices.show(notice_id, message, opts);
  }
  get chat_view() { return ScChatView.get_view(this.app.workspace); }
  open_chat() { ScChatView.open(this.app.workspace); }
  get view() { return ScSmartView.get_view(this.app.workspace); } 
  open_view(active=true) { ScSmartView.open(this.app.workspace, active); }

  open_chatgpt() { SmartChatGPTView.open(this.app.workspace); }
  async open_note(target_path, event=null) { await open_note(this, target_path, event); }
  // get folders, traverse non-hidden sub-folders
  async get_folders(path = "/") {
    try {
      const folders = (await this.app.vault.adapter.list(path)).folders;
      let folder_list = [];
      for (let i = 0; i < folders.length; i++) {
        if (folders[i].startsWith(".")) continue;
        folder_list.push(folders[i]);
        folder_list = folder_list.concat(await this.get_folders(folders[i] + "/"));
      }
      return folder_list;
    } catch (error) {
      console.warn("Error getting folders", error);
      return [];
    }
  }
  // SUPPORTERS
  async sync_notes() {
    // if license key is not set, return
    if(!this.settings.license_key){
      new Notice("Smart Connections: Supporter license key is required to sync notes to the ChatGPT Plugin server.");
      return;
    }
    console.log("syncing notes");
    const files = this.brain.files;
    const notes = await this.build_notes_object(files);
    // POST notes object to server
    const response = await requestUrl({
      url: "https://sync.smartconnections.app/sync",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      contentType: "application/json",
      body: JSON.stringify({
        license_key: this.settings.license_key,
        notes: notes
      })
    });
    console.log(response);
  }
  async build_notes_object(files) {
    let output = {};
    for(let i = 0; i < files.length; i++) {
      let file = files[i];
      let parts = file.path.split("/");
      let current = output;
      for (let ii = 0; ii < parts.length; ii++) {
        let part = parts[ii];
        if (ii === parts.length - 1) {
          // This is a file
          current[part] = await this.app.vault.cachedRead(file);
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
    return output;
  }
  async render_code_block(contents, container, ctx) {
    console.log(container);
    return this.view.render_nearest((contents.trim().length? contents : ctx.sourcePath), container);
  }
  async render_code_block_context(results, container, ctx) {
    results = this.get_entities_from_context_codeblock(results);
    console.log(results);
    container.innerHTML = this.view.render_template("smart_connections", { current_path: "context", results });
    container.querySelectorAll(".search-result").forEach((elm, i) => this.view.add_link_listeners(elm, results[i]));
    container.querySelectorAll(".search-result:not(.sc-collapsed) ul li").forEach(this.view.render_result.bind(this.view));
  }
  get_entities_from_context_codeblock(results) {
    return results.split("\n").map(key => {
      // const key = line.substring(line.indexOf('[[') + 2, line.indexOf(']]'));
      const entity = key.includes("#") ? this.brain.smart_blocks.get(key) : this.brain.smart_notes.get(key);
      return entity ? entity : { name: "Not found: " + key };
    });
  }
  // change code block
  async change_code_block(source, el, ctx) {
    const el_class = el.classList[0];
    const codeblock_type = el_class.replace("block-language-", "");
    const renderer = new ScActionsUx(this, el, codeblock_type);
    renderer.change_code_block(source);
  }

  // update smart connections folder
  async update_smart_connections_folder() {
    if(this.settings.smart_connections_folder === this.settings.smart_connections_folder_last) return; // if folder is the same as last, return
    const last_folder = this.settings.smart_connections_folder_last + '/';
    if(!confirm("Are you sure you want to update the Smart Connections folder? This will move all Smart Connections files to the new folder and restart the plugin.")){
      this.settings.smart_connections_folder = this.settings.smart_connections_folder_last; // reset folder to last folder if user cancels
      return;
    }
    await this.app.vault.adapter.rename(this.settings.smart_connections_folder_last, this.settings.smart_connections_folder);
    // update last folder
    this.settings.smart_connections_folder_last = this.settings.smart_connections_folder;
    // save settings
    await this.save_settings();
    // add folder to .obsidian/app.json userIgnoreFilters[]
    const app_json = await this.app.vault.adapter.read(".obsidian/app.json");
    const app_json_obj = JSON.parse(app_json);
    app_json_obj.userIgnoreFilters = app_json_obj.userIgnoreFilters || [];
    app_json_obj.userIgnoreFilters = app_json_obj.userIgnoreFilters.filter(folder => folder !== last_folder);
    let smart_connections_folder = this.settings.smart_connections_folder + '/';
    app_json_obj.userIgnoreFilters.push(smart_connections_folder);
    await this.app.vault.adapter.write(".obsidian/app.json", JSON.stringify(app_json_obj, null, 2));
    // reload plugin
    this.restart_plugin();
  }
  // update smart chat folder
  async update_smart_chat_folder() {
    if(this.settings.smart_chat_folder === this.settings.smart_chat_folder_last) return; // if folder is the same as last, return
    if(!confirm("Are you sure you want to update the Smart Chats folder? This will move all Smart Chat files to the new folder.")){
      this.settings.smart_chat_folder = this.settings.smart_chat_folder_last; // reset folder to last folder if user cancels
      return;
    }
    await this.app.vault.adapter.rename(this.settings.smart_chat_folder_last, this.settings.smart_chat_folder);
    // update last folder
    this.settings.smart_chat_folder_last = this.settings.smart_chat_folder;
    // save settings
    await this.save_settings();
    // update chat history conversation folder
    this.env.chats.folder = this.settings.smart_chat_folder; 
  }
  
  async update_early_access() {
    // // if license key is not set, return
    if(!this.settings.license_key) return this.show_notice("Supporter license key required for early access update");
    const v2 = await this.obsidian.requestUrl({
      url: "https://sync.smartconnections.app/download_v2",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        license_key: this.settings.license_key,
      })
    });
    if(v2.status !== 200) return console.error("Error downloading early access update", v2);
    console.log(v2.json);
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/main.js", v2.json.main); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", v2.json.manifest); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/styles.css", v2.json.styles); // add new
    await window.app.plugins.loadManifests();
    await this.restart_plugin();
  }

  // BEGIN BACKWARD COMPATIBILITY (DEPRECATED: remove before 2.2 stable release)
  async handle_deprecated_settings() {
    // move api keys (api_key_PLATFORM) to PLATFORM.api_key
    Object.entries(this.settings).forEach(([key, value]) => {
      if(key.includes('-')) {
        // replace with underscore
        const new_key = key.replace(/-/g, "_");
        this.settings[new_key] = value;
        delete this.settings[key];
        this.save_settings();
      }
      if(key.startsWith("api_key_")){
        const platform = key.replace(/^api_key_/, "");
        if(!this.settings[platform]) this.settings[platform] = {};
        if(!this.settings[platform].api_key) this.settings[platform].api_key = value;
        if(this.settings.smart_chat_model?.startsWith(platform)){
          const model_name = this.settings.smart_chat_model.replace(platform+"-", "");
          if(!this.settings[platform].model_name) this.settings[platform].model_name = model_name;
          delete this.settings.smart_chat_model;
        }
        delete this.settings[key];
        this.save_settings();
      }
    });
    // if excluded files does not include Untitled, add it
    if(!this.settings.file_exclusions.includes("Untitled")) {
      // if not empty, add comma
      if(this.settings.file_exclusions.length) this.settings.file_exclusions += ",";
      this.settings.file_exclusions += "Untitled";
      this.save_settings();
    }
    // if no smart notes model, set to default
    if(this.settings.smart_notes_embed_model === "None"){
      this.settings.smart_notes_embed_model = "TaylorAI/bge-micro-v2";
      this.save_settings();
    }
    // handle deprecated smart-embed models
    if(!embed_models[this.settings.smart_notes_embed_model]) {
      this.settings.smart_notes_embed_model = this.constructor.defaults.smart_notes_embed_model;
      this.save_settings();
    }
    if(!embed_models[this.settings.smart_blocks_embed_model] && this.settings.smart_blocks_embed_model !== "None") {
      this.settings.smart_blocks_embed_model = this.constructor.defaults.smart_blocks_embed_model;
      this.save_settings();
    }
    // V1 relics
    if (this.settings.header_exclusions) {
      this.settings.excluded_headings = this.settings.header_exclusions;
      delete this.settings.header_exclusions;
    }
  }
}
module.exports = SmartConnectionsPlugin;