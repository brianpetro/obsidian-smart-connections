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
// const { ObsidianAJSON } = require("smart-collections"); // NPM
const { ObsAJSON } = require("smart-collections/ObsAJSON.js"); // Local
const { ScBrain } = require("./sc_brain");
const { default_settings } = require("./default_settings");
const { ScSmartView } = require("./sc_smart_view");
const { SmartChatView } = require("./SmartChatView");
const { SmartConnectionsSettings } = require("./SmartConnectionsSettings");
const { SmartSearch } = require("./SmartSearch");
const { SmartNotices } = require("./smart_notices.js");
class SmartConnectionsPlugin extends Plugin {
  static get defaults() { return default_settings() }
  async open_note(target_path, event=null) {
    let targetFile;
    let heading;
    if (target_path.indexOf("#") > -1) {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(target_path.split("#")[0], ""); // remove after # from link
      // console.log(targetFile);
      const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
      // console.log(target_file_cache);
      let heading_text = target_path.split("#").pop(); // get heading
      // if heading text contains a curly brace, get the number inside the curly braces as occurence
      let occurence = 0;
      if (heading_text.indexOf("{") > -1) {
        // get occurence
        occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
        // remove occurence from heading text
        heading_text = heading_text.split("{")[0];
      }
      const headings = target_file_cache.headings; // get headings from file cache
      // get headings with the same depth and text as the link
      for(let i = 0; i < headings.length; i++) {
        if (headings[i].heading === heading_text) {
          // if occurence is 0, set heading and break
          if(occurence === 0) {
            heading = headings[i];
            break;
          }
          occurence--; // decrement occurence
        }
      }
      // console.log(heading);
    } else {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(target_path, "");
    }
    let leaf;
    if(event) {
      const mod = Keymap.isModEvent(event); // properly handle if the meta/ctrl key is pressed
      leaf = this.app.workspace.getLeaf(mod); // get most recent leaf
    }else{
      leaf = this.app.workspace.getMostRecentLeaf(); // get most recent leaf
    }
    await leaf.openFile(targetFile);
    if (heading) {
      let { editor } = leaf.view;
      const pos = { line: heading.position.start.line, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ to: pos, from: pos }, true);
    }
  }
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
    this.addSettingTab(new SmartConnectionsSettings(this.app, this)); // add settings tab
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
    // regist "change" dynamic code block
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this)); // code-block renderer (DEPRECATE?)
    this.notices = new SmartNotices(this);
    // this.obsidian = { document, Notice, request, requestUrl, TFile };
    this.obsidian = require("obsidian");
    this.brain = new ScBrain(this, ObsAJSON);
    setTimeout(() => {
      // PARTIALLY DEPRECATED: should only apply if using local model VIA Web connector (excludes APIs and local via Smart Connect)
      if(!SmartChatView.is_open(this.app.workspace) && !ScSmartView.is_open(this.app.workspace)) this.notices.show_requires_smart_view();
    }, 1000);
  }
  register_views() {
    this.registerView(ScSmartView.view_type, (leaf) => (new ScSmartView(leaf, this))); // register main view type
    this.registerView(SmartChatView.view_type, (leaf) => (new SmartChatView(leaf, this)));
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
        rand_entity.note ? rand_entity.note.open() : rand_entity.open(); // open random file
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
  open_chat() { SmartChatView.open(this.app.workspace); }
  get view() { return ScSmartView.get_view(this.app.workspace); } 
  get chat_view() { return SmartChatView.get_view(this.app.workspace); }
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
  // is smart view open
  is_smart_view_open() { return ScSmartView.is_open(this.app.workspace); }
  // backwards compatibility
  handle_deprecated_settings() {
    if(this.settings.smart_notes_embed_model === "None"){
      this.settings.smart_notes_embed_model = "TaylorAI/bge-micro-v2";
      this.save_settings();
    }
    // V1 relics
    if (this.settings.header_exclusions) {
      this.settings.excluded_headings = this.settings.header_exclusions;
      delete this.settings.header_exclusions;
    }
  }
  async upgrade_to_v21() {
    // // if license key is not set, return
    if(!this.settings.license_key) return this.show_notice("Supporter license key required for early access to v2.1");
    const v2 = await requestUrl({
      url: "https://sync.smartconnections.app/download_v2",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        license_key: this.settings.license_key,
      })
    });
    if(v2.status !== 200) return console.error("Error downloading version 2", v2);
    console.log(v2);
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/main.js", v2.json.main); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", v2.json.manifest); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/styles.css", v2.json.styles); // add new
    window.restart_plugin = async (id) => {
      console.log("restarting plugin", id);
      await window.app.plugins.disablePlugin(id);
      console.log("plugin disabled", id);
      await window.app.plugins.loadManifests();
      await window.app.plugins.enablePlugin(id);
      console.log("plugin restarted", id);
    }
    window.restart_plugin(this.manifest.id);
  }
}
module.exports = SmartConnectionsPlugin;