import Obsidian from "obsidian";
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
} = Obsidian;
import { SmartEnv } from 'smart-environment';
import { smart_env_config } from "./smart_env.config.js";
import { default_settings } from "./default_settings.js";
import ejs from "../ejs.min.cjs";
import templates from "../build/views.json" assert { type: "json" };
// rename modules
import { ScConnectionsView } from "./views/sc_connections.obsidian.js";
import { ScLookupView } from "./views/sc_lookup.obsidian.js";
import { SmartChatsView } from "./views/smart_chat.obsidian.js";
import { SmartChatGPTView } from "./views/sc_chatgpt.obsidian.js";
import { SmartPrivateChatView } from "./views/sc_private_chat.obsidian.js";
// v2.1
import { SmartSearch } from "./smart_search.js";
import { ScSettingsTab } from "./sc_settings_tab.js";
import { ScActionsUx } from "./sc_actions_ux.js";
import { open_note } from "./open_note.js";
import { ScAppConnector } from "./sc_app_connector.js";

export default class SmartConnectionsPlugin extends Plugin {
  static get defaults() { return default_settings() }
  get item_views() {
    return {
      ScConnectionsView,
      ScLookupView,
      SmartChatsView,
      SmartChatGPTView,
      SmartPrivateChatView,
    }
  }
  // GETTERS for overrides in subclasses without overriding the constructor or init method
  get smart_env_class() { return SmartEnv; }
  get smart_env_config() {
    const config = {
      ...smart_env_config,
      env_path: '', // scope handled by Obsidian FS methods
      // DEPRECATED schema
      smart_env_settings: { // careful: overrides saved settings
        is_obsidian_vault: true, // redundant with default_settings.is_obsidian_vault
      },
      // DEPRECATED usage
      ejs: ejs,
      templates: templates,
      request_adapter: this.obsidian.requestUrl, // NEEDS BETTER HANDLING
    };
    // mobile enable/disable
    if(this.obsidian.Platform.isMobile && !this.settings.enable_mobile) config.prevent_load_on_init = true;
    return config;
  }
  get_tfile(file_path) { return this.app.vault.getAbstractFileByPath(file_path); }
  async read_file(tfile_or_path) {
    const t_file = (typeof tfile_or_path === 'string') ? this.get_tfile(tfile_or_path) : tfile_or_path; // handle string (file_path) or Tfile input
    if (!(t_file instanceof this.obsidian.TFile)) return null;
    return await this.app.vault.cachedRead(t_file);
  }
  get api() { return this._api; }
  async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("unloading plugin");
    this.env?.unload_main('smart_connections_plugin');
    this.env = null;
    this.notices?.unload();
  }
  async initialize() {
    this.obsidian = Obsidian;
    // await this.smart_env_config.modules.smart_settings.class.create(this); // fails on mobile
    await smart_env_config.modules.smart_settings.class.create(this); // works on mobile (no this.smart_env_config)
    this.notices = new this.smart_env_config.modules.smart_notices.class(this);
    this.smart_connections_view = null;
    this.add_commands(); // add commands
    this.register_views();
    this.addSettingTab(new ScSettingsTab(this.app, this)); // add settings tab
    await this.check_for_updates();
    this._api = new SmartSearch(this);
    (window["SmartSearch"] = this._api) && this.register(() => delete window["SmartSearch"]); // register API to global window object
    this.addRibbonIcon("smart-connections", "Open: View Smart Connections", () => { this.open_connections_view(); });
    this.addRibbonIcon("message-square", "Open: Smart Chat Conversation", () => { this.open_chat_view(); });
    this.register_code_blocks();
    this.new_user();
    console.log("loading env");
    if(this.obsidian.Platform.isMobile){
      // render notice with button to load smart env
      this.show_notice("Mobile detected: to prevent performance issues, click to load Smart Environment when ready.", {
        button: {text: "Load Smart Env", callback: () => { this.load_env(); }},
        timeout: 0,
      });
    }else await this.load_env();
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
    // if(this.obsidian.Platform.isMobile && !this.settings.enable_mobile) return console.warn("SKIPPING: Mobile and not enabled"); // SKIP if mobile and not enabled
    await this.smart_env_class.create(this, this.smart_env_config);
    console.log("env loaded");
    // skip if is mobile
    if(!this.obsidian.Platform.isMobile) ScAppConnector.create(this.env, 37042); // Smart Connect
    // DEPRECATED getters: for Smart Visualizer backwards compatibility
    Object.defineProperty(this.env, 'entities_loaded', { get: () => this.env.collections_loaded });
    Object.defineProperty(this.env, 'smart_notes', { get: () => this.env.smart_sources });
  }
  async ready_to_load_collections() {
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds for other processes to finish
    await this.wait_for_obsidian_sync();
  }

  new_user() {
    if(!this.settings.new_user) return;
    this.settings.new_user = false;
    this.settings.version = this.manifest.version;
    setTimeout(() => {
      this.open_connections_view();
      this.open_chat_view();
    }, 1000); // wait a sec to allow existing views to open
    if(this.app.workspace.rightSplit.collapsed) this.app.workspace.rightSplit.toggle();
    this.add_to_gitignore("\n\n# Ignore Smart Environment folder\n.smart-env"); 
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
      this.addCommand({
        id: View.view_type,
        name: "Open: " + View.display_text + " view",
        callback: () => { View.open(this.app.workspace); }
      });
      const method_name = View.view_type
        .replace('smart-', '')
        .replace(/-/g, '_')
      ;
      // getters
      Object.defineProperty(this, method_name, { get: () => View.get_view(this.app.workspace) });
      // open methods
      this['open_' + method_name] = () => View.open(this.app.workspace);
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
      await window.app.plugins.disablePlugin(id);
      await window.app.plugins.enablePlugin(id);
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
        // if has selection, use selection
        if(editor.somethingSelected()){
          if(!this.lookup_view) this.open_lookup_view();
          this.lookup_view.render_view(editor.getSelection());
          return;
        }

        if(!this.connections_view) this.open_connections_view();
        if(editor.getCursor()?.line){ // if cursor is on a line greater than 0
          const line = editor.getCursor().line;
          const source = this.env.smart_sources.current_note;
          let item = source.get_block_by_line(line);
          if(item?.vec) return this.connections_view.render_view(item);
          else this.connections_view.render_view(source);
        }else this.connections_view.render_view();
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
        if(!curr_file?.path) return console.warn("No active file", curr_file);
        let source = this.env.smart_sources.get(curr_file.path);
        if(source) {
          source.data = {path: curr_file.path}; // forces should_import to true by removing last_import
          const source_data_path = source.collection.data_adapter.get_item_data_path(source.key);
          // clear file at source_data_path
          await this.env.data_fs.remove(source_data_path);
        }else{
          this.env.smart_sources.fs.include_file(curr_file.path); // add to fs
          source = this.env.smart_sources.init_file_path(curr_file.path); // init source
        }
        await source.import();
        await this.env.smart_sources.process_embed_queue();
        setTimeout(() => {
          // refresh view
          this.connections_view.render_view();
        }, 1000);
      }
    });
    // open view command
    this.addCommand({
      id: "smart-connections-view",
      name: "Open: View Smart Connections",
      callback: () => { this.open_connections_view(); }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => { this.open_chat_view(); }
    });
    // open random note from nearest cache
    this.addCommand({
      id: "smart-connections-random",
      name: "Random Note",
      callback: async () => {
        const curr_file = this.app.workspace.getActiveFile();
        const entity = this.env.smart_sources.get(curr_file.path);
        const connections = await entity.find_connections({
            filter: {limit: 20},
          })
        ;
        const rand = Math.floor(Math.random() * connections.length/2); // divide by 2 to limit to top half of results
        const rand_entity = connections[rand]; // get random from nearest cache
        this.open_note(rand_entity.item.path);
      }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chatgpt",
      name: "Open: Smart ChatGPT",
      callback: () => { this.open_chatgpt_view(); }
    });
    // open private chat command
    this.addCommand({
      id: "smart-connections-private-chat",
      name: "Open: Smart Connections Supporter Private Chat",
      callback: () => { this.open_private_chat(); }
    });
  }
  async make_connections(selected_text=null) {
    if(!this.connections_view) await this.open_connections_view(); // open view if not open
    await this.connections_view.render_nearest(selected_text);
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
  get_link_target_path(link_path, file_path) {
    return this.app.metadataCache.getFirstLinkpathDest(link_path, file_path)?.path;
  }
  // SUPPORTERS
  async render_code_block(contents, container, ctx) {
    container.empty();
    container.createEl('span', {text: 'Loading...'});
    if(contents.trim().length) {
      const frag = await this.env.smart_sources.render_component(
        'lookup',
        {
          add_result_listeners: this.add_result_listeners.bind(this),
          attribution: this.attribution,
          query: contents,
        }
      );
      container.empty();
      container.appendChild(frag);
    }else{
      const entity = this.env.smart_sources.get(ctx.sourcePath);
      if(!entity) return container.innerHTML = 'Entity not found: ' + ctx.sourcePath;
      const component_opts = {
        add_result_listeners: this.add_result_listeners.bind(this),
        attribution: this.attribution,
        re_render: () => {
          this.render_code_block(contents, container, ctx);
        },
        open_lookup_view: this.open_lookup_view.bind(this),
      };
      const frag = await this.env.render_component('connections', entity, component_opts);
      container.empty();
      container.appendChild(frag);
      const results = await entity.find_connections({ 
        exclude_source_connections: entity.env.smart_blocks.settings.embed_blocks
      });
      const results_frag = await entity.env.render_component('results', results, component_opts);
      
      const results_container = container.querySelector('.sc-list');
      // Clear and update results container
      results_container.innerHTML = '';
      Array.from(results_frag.children).forEach((elm) => {
        results_container.appendChild(elm);
      });
      const header_status_elm = container.querySelector('.sc-top-bar .sc-context');
      results_container.dataset.key = entity.key;
      const context_name = (entity.path).split('/').pop();
      const status_elm = container.querySelector('.sc-bottom-bar .sc-context');
      status_elm.innerText = context_name;
      header_status_elm.innerText = context_name;
      return results;
    }
  }
  async render_code_block_context(results, container, ctx) {
    results = this.get_entities_from_context_codeblock(results);
    container.innerHTML = this.connections_view.render_template("smart_connections", { current_path: "context", results });
    container.querySelectorAll(".sc-result").forEach((elm, i) => this.connections_view.add_link_listeners(elm, results[i]));
    container.querySelectorAll(".sc-result:not(.sc-collapsed) ul li").forEach(this.connections_view.render_result.bind(this.connections_view));
  }
  get_entities_from_context_codeblock(results) {
    return results.split("\n").map(key => {
      // const key = line.substring(line.indexOf('[[') + 2, line.indexOf(']]'));
      const entity = key.includes("#") ? this.env.smart_blocks.get(key) : this.env.smart_sources.get(key);
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
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/main.js", v2.json.main); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", v2.json.manifest); // add new
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/styles.css", v2.json.styles); // add new
    await window.app.plugins.loadManifests();
    await this.restart_plugin();
  }

  get plugin_is_enabled() { return this.app?.plugins?.enabledPlugins?.has("smart-connections"); }
  // WAIT FOR OBSIDIAN SYNC
  async wait_for_obsidian_sync() {
    while (this.obsidian_is_syncing) {
      if(!this.plugin_is_enabled) throw new Error("Smart Connections: plugin disabled while waiting for obsidian sync"); // if plugin is disabled, stop waiting for sync
      console.log("Smart Connections: Waiting for Obsidian Sync to finish");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  get obsidian_is_syncing() {
    const obsidian_sync_instance = this.app?.internalPlugins?.plugins?.sync?.instance;
    if(!obsidian_sync_instance) return false; // if no obsidian sync instance, not syncing
    if(obsidian_sync_instance?.syncStatus.startsWith('Uploading')) return false; // if uploading, don't wait for obsidian sync
    if(obsidian_sync_instance?.syncStatus.startsWith('Fully synced')) return false; // if fully synced, don't wait for obsidian sync
    return obsidian_sync_instance?.syncing;
  }

  // main settings
  async load_settings() {
    const settings = (default_settings()).settings;
    // Object.assign(this, this.constructor.defaults); // set defaults
    const saved_settings = await this.loadData();
    Object.assign(settings, saved_settings || {}); // overwrites defaults with saved settings
    return settings;
  }
  async save_settings(settings=this.smart_settings._settings) {
    await this.saveData(settings); // Obsidian API->saveData
  }
  
  get system_prompts() {
    const folder = this.env.settings?.smart_chats?.prompts_path || this.settings.system_prompts_folder;
    return this.app.vault.getMarkdownFiles()
      .filter(file => file.path.includes(folder) || file.path.includes('.prompt') || file.path.includes('.sp'))
    ;
  }

  // FROM ScSettings
  async force_refresh() {
    this.env.smart_blocks.clear();
    this.env.smart_sources.clear();
    await this.env.smart_sources.init(); // trigger making new connections
    Object.values(this.env.smart_sources.items).forEach(item => item.queue_import());
    await this.env.smart_sources.process_source_import_queue(); // trigger making new connections
  }
  async exclude_all_top_level_folders() {
    const folders = (await this.app.vault.adapter.list("/")).folders;
    const input = document.querySelector("#smart-connections-settings div[data-setting='folder_exclusions'] input");
    input.value = folders.join(", ");
    input.dispatchEvent(new Event("input")); // send update event
    this.update_exclusions();
  }
  async update_exclusions() {
    this.env.smart_sources.smart_fs = null; // clear smart fs cache (re adds exclusions) (should only require clearing smart_sources.smart_fs)
    console.log("render_file_counts");
    const elm = document.querySelector("#smart-connections-settings #file-counts");
    elm.setText(`Included files: ${this.included_files} / Total files: ${this.total_files}`);
  }
  async toggle_mobile(setting, value, elm) {
    const manifest = JSON.parse(await this.app.vault.adapter.read(".obsidian/plugins/smart-connections/manifest.json"));
    manifest.isDesktopOnly = !value;
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", JSON.stringify(manifest, null, 2));
    console.log("Manifest written");
    this.restart_plugin();
  }


  // // TODO: re-implement in plugin initialization
  // /**
  //  * Loads settings specific to Obsidian for backwards compatibility.
  //  * @returns {Promise<void>} A promise that resolves when Obsidian settings have been loaded.
  //  */
  // async load_obsidian_settings() {
  //   if (this._settings.is_obsidian_vault && this.env.smart_connections_plugin) {
  //     const obsidian_settings = this._settings.smart_connections_plugin;
  //     console.log("obsidian_settings", obsidian_settings, this._settings);
  //     if(obsidian_settings){
  //       this.transform_backwards_compatible_settings(obsidian_settings);
  //       await this.save_settings();
  //       this.env.smart_connections_plugin.save_settings(obsidian_settings);
  //     }
  //   }
  // }
  // /**
  //  * Transforms settings to maintain backwards compatibility with older configurations.
  //  * @param {Object} os - The old settings object to transform.
  //  */
  // transform_backwards_compatible_settings(os) {
  //   // move muted notices to main 2024-09-27
  //   if(this.env._settings.smart_notices){
  //     if(!os.smart_notices) os.smart_notices = {};
  //     os.smart_notices.muted = {...this.env._settings.smart_notices.muted};
  //     delete this.env._settings.smart_notices;
  //   }
  //   // rename to embed_model
  //   if (os.smart_sources_embed_model) {
  //     if (!this.env._settings.smart_sources) this.env._settings.smart_sources = {};
  //     if (!this.env._settings.smart_sources.embed_model) this.env._settings.smart_sources.embed_model = {};
  //     if (!this.env._settings.smart_sources.embed_model.model_key) this.env._settings.smart_sources.embed_model.model_key = os.smart_sources_embed_model;
  //     if (!this.env._settings.smart_sources.embed_model[os.smart_sources_embed_model]) this.env._settings.smart_sources.embed_model[os.smart_sources_embed_model] = {};
  //     delete os.smart_sources_embed_model;
  //   }
  //   // move from main to embed_model in env
  //   if (os.smart_blocks_embed_model) {
  //     if (!this.env._settings.smart_blocks) this.env._settings.smart_blocks = {};
  //     if (!this.env._settings.smart_blocks.embed_model) this.env._settings.smart_blocks.embed_model = {};
  //     if (!this.env._settings.smart_blocks.embed_model.model_key) this.env._settings.smart_blocks.embed_model.model_key = os.smart_blocks_embed_model;
  //     if (!this.env._settings.smart_blocks.embed_model[os.smart_blocks_embed_model]) this.env._settings.smart_blocks.embed_model[os.smart_blocks_embed_model] = {};
  //     delete os.smart_blocks_embed_model;
  //   }
  //   if (os.api_key) {
  //     Object.entries(this.env._settings.smart_sources?.embed_model || {}).forEach(([key, value]) => {
  //       if (key.startsWith('text')) value.api_key = os.api_key;
  //       if (os.embed_input_min_chars && typeof value === 'object' && !value.min_chars) value.min_chars = os.embed_input_min_chars;
  //     });
  //     Object.entries(this.env._settings.smart_blocks?.embed_model || {}).forEach(([key, value]) => {
  //       if (key.startsWith('text')) value.api_key = os.api_key;
  //       if (os.embed_input_min_chars && typeof value === 'object' && !value.min_chars) value.min_chars = os.embed_input_min_chars;
  //     });
  //     delete os.api_key;
  //     delete os.embed_input_min_chars;
  //   }
  //   if(os.muted_notices) {
  //     if(!this.env._settings.smart_notices) this.env._settings.smart_notices = {};
  //     this.env._settings.smart_notices.muted = {...os.muted_notices};
  //     delete os.muted_notices;
  //   }
  //   if(os.smart_connections_folder){
  //     if(!os.env_data_dir) os.env_data_dir = os.smart_connections_folder;
  //     delete os.smart_connections_folder;
  //   }
  //   if(os.smart_connections_folder_last){
  //     os.env_data_dir_last = os.smart_connections_folder_last;
  //     delete os.smart_connections_folder_last;
  //   }
  //   if(os.file_exclusions){
  //     if(!this.env._settings.file_exclusions || this.env._settings.file_exclusions === 'Untitled') this.env._settings.file_exclusions = os.file_exclusions;
  //     delete os.file_exclusions;
  //   }
  //   if(os.folder_exclusions){
  //     if(!this.env._settings.folder_exclusions || this.env._settings.folder_exclusions === 'smart-chats') this.env._settings.folder_exclusions = os.folder_exclusions;
  //     delete os.folder_exclusions;
  //   }
  //   if(os.system_prompts_folder){
  //     if(!this.env._settings.smart_chats) this.env._settings.smart_chats = {};
  //     if(!this.env._settings.smart_chats?.prompts_path) this.env._settings.smart_chats.prompts_path = os.system_prompts_folder;
  //     delete os.system_prompts_folder;
  //   }
  //   if(os.smart_chat_folder){
  //     if(!this.env._settings.smart_chats) this.env._settings.smart_chats = {};
  //     if(!this.env._settings.smart_chats?.fs_path) this.env._settings.smart_chats.fs_path = os.smart_chat_folder;
  //     delete os.smart_chat_folder;
  //   }
  // }


  remove_setting_elm(path, value, elm) {
    elm.remove();
  }


  // ENTITIES VIEW
  add_result_listeners(elm, source) {
    const toggle_result = async (result) => {
      result.classList.toggle("sc-collapsed");
      // if li contents is empty, render it
      if(!result.querySelector("li").innerHTML){
        const collection_key = result.dataset.collection;
        const entity = this.env[collection_key].get(result.dataset.path);
        await entity.render_item(result.querySelector("li"));
      }
    }
    const handle_result_click = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      const result = target.closest(".sc-result");
      if (target.classList.contains("svg-icon")) {
        toggle_result(result);
        return;
      }
      
      const link = result.dataset.link || result.dataset.path;
      if(result.classList.contains("sc-collapsed")){
        if (this.obsidian.Keymap.isModEvent(event)) {
          console.log("open_note", link);
          this.open_note(link, event);
        } else {
          toggle_result(result);
        }
      } else {
        console.log("open_note", link);
        this.open_note(link, event);
      }
    }
    elm.addEventListener("click", handle_result_click.bind(this));
    const path = elm.querySelector("li").dataset.key;
    elm.addEventListener('dragstart', (event) => {
      const drag_manager = this.app.dragManager;
      const file_path = path.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, '');
      const drag_data = drag_manager.dragFile(event, file);
      drag_manager.onDragStart(event, drag_data);
    });

    if (path.indexOf("{") === -1) {
      elm.addEventListener("mouseover", (event) => {
        this.app.workspace.trigger("hover-link", {
          event,
          // source: this.constructor.view_type,
          source,
          hoverParent: elm.parentElement,
          targetEl: elm,
          linktext: path,
        });
      });
    }
  }

}