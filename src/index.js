import Obsidian from "obsidian";
const {
  Notice,
  Plugin,
  requestUrl,
} = Obsidian;
import { SmartEnv } from 'smart-environment';
import { smart_env_config } from "./smart_env.config.js";
import { default_settings } from "./default_settings.js";
import ejs from "../ejs.min.cjs";
import templates from "../build/views.json" with { type: "json" };
// rename modules
import { ScConnectionsView } from "./views/sc_connections.obsidian.js";
import { ScLookupView } from "./views/sc_lookup.obsidian.js";

import { SmartChatsView } from "./views/smart_chat.obsidian.js";
import { SmartChatGPTView } from "./views/sc_chatgpt.obsidian.js";
import { SmartPrivateChatView } from "./views/sc_private_chat.obsidian.js";
// v2.1
import { SmartSearch } from "./smart_search.js";
import { ScSettingsTab } from "./sc_settings_tab.js";
import { open_note } from "./open_note.js";
import { ScAppConnector } from "./sc_app_connector.js";
import { SmartSettings } from 'smart-settings/smart_settings.js';

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
    if(!this._smart_env_config){
      this._smart_env_config = {
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
      if(this.obsidian.Platform.isMobile && !this.settings.enable_mobile) this._smart_env_config.prevent_load_on_init = true;
    }
    return this._smart_env_config;
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
    await SmartSettings.create(this); // works on mobile (no this.smart_env_config)
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
      this.notices.show('load_env');
    }else await this.load_env();
    console.log("Smart Connections v2 loaded");
  }
  register_code_blocks() {
    this.register_code_block("smart-connections", "render_code_block"); // code-block renderer
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
    /**
     * @deprecated for Smart Visualizer backwards compatibility
     * TODO: remove when new Smart [Clusters] Visualizer plugin is released
     */
    // if(typeof this.env.collections === 'undefined') Object.defineProperty(this.env, 'entities_loaded', { get: () => this.env.collections_loaded });
    if(typeof this.env.smart_sources === 'undefined') Object.defineProperty(this.env, 'smart_notes', { get: () => this.env.smart_sources });
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
        this.notices.show('new_version_available', {version: latest_release});
        this.update_available = true;
      }
    } catch (error) {
      console.log(error);
    }
  }
  async restart_plugin() {
    this.env.unload_main('smart_connections_plugin');
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
  async open_note(target_path, event=null) { await open_note(this, target_path, event); }
  async render_code_block(contents, container, ctx) {
    container.empty();
    container.createEl('span', {text: 'Loading...'});
    if(contents.trim().length) {
      const frag = await this.env.smart_sources.render_component(
        'lookup',
        {
          // add_result_listeners: this.add_result_listeners.bind(this),
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
        // add_result_listeners: this.add_result_listeners.bind(this),
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
      const results_frag = await entity.env.render_component('connections_results', results, component_opts);
      
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
  
  async update_early_access() {
    // if license key is not set, return
    if(!this.settings.license_key) return this.notices.show("supporter_key_required");
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

  remove_setting_elm(path, value, elm) {
    elm.remove();
  }

}