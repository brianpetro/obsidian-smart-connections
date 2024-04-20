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
const { ObsAJSON } = require("smart-collections/ObsAJSON.js"); // Local
const { ObsMultiAJSON } = require("smart-collections/ObsMultiAJSON.js"); // Local
const { ScEnv } = require("./sc_env");
const { default_settings } = require("./default_settings");
// rename modules
const { ScSmartView } = require("./sc_smart_view"); // rename to sc_view.js
const { SmartSearch } = require("./smart_search.js"); // rename to sc_search.js
const { SmartNotices } = require("./smart_notices.js"); // rename to sc_notices.js (extract smart_notices.js as standard structure first)
// v2.1
const { ScChatView } = require("./sc_chat_view.js");
const { ScSettingsTab } = require("./sc_settings.js");
const embed_models = require('smart-embed-model/models.json');
const { ScActionsUx } = require("./sc_actions_ux.js");
const { open_note } = require("./open_note.js");
class SmartConnectionsPlugin extends Plugin {
  static get defaults() { return default_settings() }
  async open_note(target_path, event=null) { await open_note(this, target_path, event); }
  async load_settings() {
    Object.assign(this.settings, await this.loadData());
    this.handle_deprecated_settings(); // HANDLE DEPRECATED SETTINGS
  }
  async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("unloading plugin");
    this.brain?.unload();
    this.brain = null;
    this.notices?.unload();
  }
  async initialize() {
    console.log("Loading Smart Connections v2...");
    Object.assign(this, this.constructor.defaults);
    await this.load_settings();
    this.smart_connections_view = null;
    this.add_commands(); // add commands
    this.register_views(); // register chat view type
    this.addSettingTab(new ScSettingsTab(this.app, this, "smart_settings_21")); // add settings tab
    this.check_for_updates();
    this.add_to_gitignore("\n\n# Ignore Smart Connections folder\n.smart-connections"); 
    this.api = new SmartSearch(this);
    (window["SmartSearch"] = this.api) && this.register(() => delete window["SmartSearch"]); // register API to global window object
    addIcon("smart-connections", `<path d="M50,20 L80,40 L80,60 L50,100" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M30,50 L55,70" stroke="currentColor" stroke-width="5" fill="none"/>
    <circle cx="50" cy="20" r="9" fill="currentColor"/>
    <circle cx="80" cy="40" r="9" fill="currentColor"/>
    <circle cx="80" cy="70" r="9" fill="currentColor"/>
    <circle cx="50" cy="100" r="9" fill="currentColor"/>
    <circle cx="30" cy="50" r="9" fill="currentColor"/>`);
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this)); // code-block renderer
    this.registerMarkdownCodeBlockProcessor("sc-context", this.render_code_block_context.bind(this)); // code-block renderer
    // "AI change" dynamic code block
    this.registerMarkdownCodeBlockProcessor("sc-change", this.change_code_block.bind(this));
    this.notices = new SmartNotices(this);
    this.obsidian = require("obsidian");
    await this.load_env();
    console.log("Smart Connections v2 loaded");
  }
  async load_env() {
    this.env = new ScEnv(this, (this.settings.embedding_file_per_note ? ObsMultiAJSON : ObsAJSON));
    this.brain = this.env; // DEPRECATED (use this.env instead)
    await this.env.init();
  }

  register_views() {
    this.registerView(ScSmartView.view_type, (leaf) => (new ScSmartView(leaf, this))); // register main view type
    this.registerView(ScChatView.view_type, (leaf) => (new ScChatView(leaf, this)));
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
    window.restart_plugin(this.manifest.id);
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
      name: "Open: Random Note from Smart Connections",
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
    // generate next block using smart_instruct class stream
    this.addCommand({
      id: "generate-next-block",
      name: "Generate: Next Block",
      callback: async () => {
        const editor = this.app.workspace.getActiveViewOfType(this.app.workspace.activeLeaf.view.constructor).editor;
        if (!editor) {
          console.log("No active editor found.");
          return;
        }
        const line = editor.getCursor().line;
        const block = this.brain.smart_notes.current_note.get_block_by_line(line);
        const current = block ? await block.get_content() : editor.getLine(line);
        // insert line break and move cursor to next line
        editor.replaceRange("\n", { line: line + 1, ch: 0 });
        const cursor = editor.getCursor();
        const { SmartInstructModel } = require('smart-models/instruct');
        const instruct_model = new SmartInstructModel({
          request_adapter: requestUrl,
          api_key: this.settings.api_key_openai, // Assuming API key is stored in plugin settings
        });
        const nearest = await this.api.search(editor.getLine(cursor.line));
        // if nearest[] is not a block, return
        if(nearest.length === 0) return console.log("no nearest blocks found");
        if(!nearest[0].collection_name.includes("block")) return console.log("requires block-level embeddings to generate next block");
        let prompt = "";
        for(let i = 0; i < nearest.length; i++) {
          const block = nearest[i];
          const contents = await block.get_next_k_shot(i);
          if(!contents) continue;
          const total_tokens = instruct_model.count_tokens(prompt + contents);
          if(total_tokens < 2048){
            if(prompt.length > 0) prompt += "\n\n"; // add new line if prompt is not empty
            prompt += contents;
          } else break;
        }
        prompt += `\n\n---BEGIN CURRENT 99---\n${current}\n---END CURRENT 99---`;
        prompt += `\n---BEGIN NEXT 99---\n`;
        console.log(prompt);
        const opts = {
          prompt: prompt, 
          max_tokens: 200, // Example token limit
          stop: ["---END"],
        };
        // insert \n---\n to separate generated text
        editor.replaceRange("\n\n---\n", cursor);
        cursor.line += 4;
        cursor.ch = 0;
        await instruct_model.stream(
          opts, 
          (full_str) => {
            console.log(full_str);
            // editor.replaceRange(full_str, cursor); // Insert generated text at cursor position
          },
          (chunk) => {
            console.log(chunk);
            console.log(cursor);
            editor.replaceRange(chunk, cursor);
            if(chunk.includes("\n")){
              cursor.line += chunk.split("\n").length - 1;
              cursor.ch = chunk.split("\n").pop().length;
            }else{
              cursor.ch += chunk.length;
            }
            editor.setCursor(cursor);
            console.log(cursor);
          }
        );
      }
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
  open_view(active=true) { ScSmartView.open(this.app.workspace, active); }
  open_chat() { ScChatView.open(this.app.workspace); }
  get view() { return ScSmartView.get_view(this.app.workspace); } 
  get chat_view() { return ScChatView.get_view(this.app.workspace); }
  // get folders, traverse non-hidden sub-folders
  async get_folders(path = "/") {
    const folders = (await this.app.vault.adapter.list(path)).folders;
    let folder_list = [];
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].startsWith(".")) continue;
      folder_list.push(folders[i]);
      folder_list = folder_list.concat(await this.get_folders(folders[i] + "/"));
    }
    return folder_list;
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
    console.log(source);
    const renderer = new ScActionsUx(this, el);
    renderer.change_code_block(source);
  }

  // update smart connections folder
  async update_smart_connections_folder() {
    if(this.settings.smart_connections_folder === this.settings.smart_connections_folder_last) return; // if folder is the same as last, return
    if(!confirm("Are you sure you want to update the Smart Connections folder? This will move all Smart Connections files to the new folder and restart the plugin.")){
      this.settings.smart_connections_folder = this.settings.smart_connections_folder_last; // reset folder to last folder if user cancels
      return;
    }
    await this.app.vault.adapter.rename(this.settings.smart_connections_folder_last, this.settings.smart_connections_folder);
    // update last folder
    this.settings.smart_connections_folder_last = this.settings.smart_connections_folder;
    // save settings
    await this.save_settings();
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
  // is smart view open
  is_smart_view_open() { return ScSmartView.is_open(this.app.workspace); }
  // backwards compatibility
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
        if(this.settings.smart_chat_model.startsWith(platform)){
          const model_name = this.settings.smart_chat_model.replace(platform+"-", "");
          if(!this.settings[platform].model_name) this.settings[platform].model_name = model_name;
          delete this.settings.smart_chat_model;
        }
        delete this.settings[key];
        this.save_settings();
      }
    });
    // if excluded folders does not include smart-chats, add it
    if(!this.settings.folder_exclusions.includes("smart-chats")) {
      // if not empty, add comma
      if(this.settings.folder_exclusions.length) this.settings.folder_exclusions += ",";
      this.settings.folder_exclusions += "smart-chats";
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