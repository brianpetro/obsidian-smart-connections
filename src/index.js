import Obsidian from "obsidian";
const {
  Notice,
  Plugin,
  requestUrl,
  Platform,
} = Obsidian;

import { SmartEnv } from 'obsidian-smart-env';
import { smart_env_config } from "./smart_env.config.js";
import { smart_env_config as built_smart_env_config } from "../smart_env.config.js";

import { ConnectionsView } from "./views/connections_view.js";
import { ScLookupView } from "./views/sc_lookup.obsidian.js";
import { SmartChatsView } from "./views/smart_chat.obsidian.js";
import { SmartChatGPTView } from "./views/sc_chatgpt.obsidian.js";
import { SmartPrivateChatView } from "./views/sc_private_chat.obsidian.js";
import { SmartChatView } from "smart-chat-obsidian/src/smart_chat.obsidian.js";
import { smart_env_config as smart_chat_env_config } from "smart-chat-obsidian/smart_env.config.js";
import { smart_env_config as smart_context_env_config } from "smart-context-obsidian/smart_env.config.js";

import { ScSettingsTab } from "./sc_settings_tab.js";
import { open_note } from "obsidian-smart-env/utils/open_note.js";

// import { exchange_code_for_tokens, install_smart_plugins_plugin, get_smart_server_url, enable_plugin } from './sc_oauth.js';
import { SmartNotices } from 'smart-notices/smart_notices.js';
import { merge_env_config } from "obsidian-smart-env";
import { ConnectionsModal } from "./views/connections_modal.js";

import { SmartChatSettingTab } from "smart-chat-obsidian/src/settings_tab.js";

import { ReleaseNotesView }    from "./views/release_notes_view.js";

import { StoryModal } from 'obsidian-smart-env/modals/story.js';
import { create_deep_proxy } from "./utils/create_deep_proxy.js";

export default class SmartConnectionsPlugin extends Plugin {

  get item_views() {
    return {
      ConnectionsView,
      ScLookupView,
      SmartChatsView,
      SmartChatGPTView,
      SmartPrivateChatView,
      ReleaseNotesView,
    };
  }

  // GETTERS
  get obsidian() { return Obsidian; }
  get smart_env_config() {
    if(!this._smart_env_config){
      const merged_env_config = merge_env_config(built_smart_env_config, smart_env_config);
      merge_env_config(merged_env_config, smart_chat_env_config);
      merge_env_config(merged_env_config, smart_context_env_config);
      this._smart_env_config = {
        ...merged_env_config,
        env_path: '', // scope handled by Obsidian FS methods
        // DEPRECATED schema
        smart_env_settings: { // careful: overrides saved settings
          is_obsidian_vault: true, // redundant with default_settings.is_obsidian_vault
        },
        request_adapter: this.obsidian.requestUrl, // NEEDS BETTER HANDLING
      };
      // mobile enable/disable
      if(Platform.isMobile) {
        merge_env_config(this._smart_env_config, {
          collections: {
            smart_sources: { prevent_load_on_init: true },
          },
        });
      }
    }
    return this._smart_env_config;
  }
  get api() { return this._api; }
  onload() {
    this.app.workspace.onLayoutReady(this.initialize.bind(this)); // initialize when layout is ready
    SmartEnv.create(this); // IMPORTANT: works on mobile without this.smart_env_config as second arg
    this.register_views();
    SmartChatView.register_view(this);
    this.addRibbonIcon("smart-connections", "Open: View Smart Connections", () => { this.open_connections_view(); });
    this.addSettingTab(new ScSettingsTab(this.app, this)); // add settings tab
    this.add_commands();
    this.register_code_blocks();
  }
  // async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("unloading plugin");
    this.env?.unload_main?.(this);
    this.notices?.unload();
  }

  async initialize() {
    await this.load_new_user_state();
    // SmartSettings.create_sync(this);
    this.smart_connections_view = null;

    // if(!Platform.isMobile){
    //   // Register protocol handler for obsidian://sc-op/callback
    //   this.registerObsidianProtocolHandler("sc-op/callback", async (params) => {
    //     await this.handle_sc_op_oauth_callback(params);
    //   });
    // }
    console.log("Smart Connections v2 loaded");
    if(this.is_new_user()) {
      setTimeout(() => {
        StoryModal.open(this, {
          title: 'Getting Started With Smart Connections',
          url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-new-user',
        });
      }, 1000);
    }
    await SmartEnv.wait_for({ loaded: true });
    await this.migrate_last_version_from_localStorage();
    await this.check_for_updates();
    this.new_user();
    this.addSettingTab(new SmartChatSettingTab(this.app, this)); // add settings tab
    this.register(() => {
      console.log("removing smart-chat setting tab");
      this.app.setting.removeSettingTab('smart-chat');
    });
    console.log("Smart Chat is registered");
  }


  register_code_blocks() {
    this.register_code_block("smart-connections", "render_code_block");
  }
  register_code_block(name, callback_name) {
    try{
      this.registerMarkdownCodeBlockProcessor(name, this[callback_name].bind(this));
    } catch (error) {
      console.warn(`Error registering code block: ${name}`, error);
    }
  }

  get settings() { return this.env?.settings || {}; }

  async new_user() {
    if(!this.is_new_user()) return;
    await this.save_installed_at(Date.now());
    await this.set_last_known_version(this.manifest.version);
    setTimeout(() => {
      this.open_connections_view();
    }, 1000);
    if(this.app.workspace.rightSplit.collapsed) this.app.workspace.rightSplit.toggle();
    this.add_to_gitignore("\n\n# Ignore Smart Environment folder\n.smart-env");
  }

  register_views() {
    Object.values(this.item_views).forEach(View => {
      this.registerView(View.view_type, (leaf) => (new View(leaf, this)));
      this.addCommand({
        id: View.view_type,
        name: "Open: " + View.display_text + " view",
        callback: () => { View.open(this.app.workspace); }
      });
      const method_name = View.view_type
        .replace('smart-', '')
        .replace(/-/g, '_');
      Object.defineProperty(this, method_name, { get: () => View.get_view(this.app.workspace) });
      this['open_' + method_name] = () => View.open(this.app.workspace);
    });
  }

  async check_for_updates() {
    if (await this.should_show_release_notes(this.manifest.version)) {
      console.log("opening release notes modal");
      try {
        ReleaseNotesView.open(this.app.workspace, this.manifest.version);
      } catch (e) {
        console.error('Failed to open ReleaseNotesView', e);
      }
      await this.set_last_known_version(this.manifest.version);
    }
    setTimeout(this.check_for_update.bind(this), 3000);
    setInterval(this.check_for_update.bind(this), 10800000);
  }

  async check_for_update() {
    try {
      const {json: response} = await requestUrl({
        url: "https://api.github.com/repos/brianpetro/obsidian-smart-connections/releases/latest",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        contentType: "application/json",
      });
      const latest_release = response.tag_name;
      if(latest_release !== this.manifest.version) {
        this.notices?.show('new_version_available', {version: latest_release});
        this.update_available = true;
      }
    } catch (error) {
      console.error(error);
    }
  }


  async restart_plugin() {
    this.env?.unload_main?.(this);
    await new Promise(r => setTimeout(r, 3000));
    window.restart_plugin = async (id) => {
      await window.app.plugins.disablePlugin(id);
      await window.app.plugins.enablePlugin(id);
    };
    await window.restart_plugin(this.manifest.id);
  }

  add_commands() {
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      editorCallback: (editor) => {
        if(editor.somethingSelected()){
          if(!this.lookup_view) this.open_lookup_view();
          this.lookup_view.render_view(editor.getSelection());
          return;
        }
        if(!this.connections_view) this.open_connections_view();
        if(editor.getCursor()?.line){
          const line = editor.getCursor().line;
          const source = this.env.smart_sources.current_note;
          let item = source.get_block_by_line(line);
          if(item?.vec) return this.connections_view.render_view(item);
          else this.connections_view.render_view(source);
        }else this.connections_view.render_view();
      }
    });

    this.addCommand({
      id: "sc-refresh-connections",
      name: "Refresh & make connections",
      editorCallback: async (editor) => {
        const curr_file = this.app.workspace.getActiveFile();
        if(!curr_file?.path) return console.warn("No active file", curr_file);
        let source = this.env.smart_sources.get(curr_file.path);
        if(source) {
          source.data = {path: curr_file.path};
          const source_data_path = source.collection.data_adapter.get_item_data_path(source.key);
          await this.env.data_fs.remove(source_data_path);
        }else{
          source = this.env.smart_sources.init_file_path(curr_file.path);
        }
        if(!source) return this.notices.show("unable_to_init_source", {key: curr_file.path});
        await source.import();
        await this.env.smart_sources.process_embed_queue();
        setTimeout(() => {
          this.connections_view?.render_view?.();
        }, 1000);
      }
    });

    this.addCommand({
      id: "smart-connections-random",
      name: "Random note",
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

    this.addCommand({
      id: 'open-connections-modal',
      name: 'Connections modal',
      checkCallback: (checking) => {
        if(checking) return !!this.app.workspace.getActiveFile()?.path;
        const modal = new ConnectionsModal(this);
        modal.open();
      }
    });

    // show release notes
    this.addCommand({
      id: 'show-release-notes',
      name: 'Show release notes',
      callback: () => ReleaseNotesView.open(this.app.workspace, this.manifest.version)
    });

    // show getting started
    this.addCommand({
      id: 'show-getting-started',
      name: 'Show getting started',
      callback: () => {
        StoryModal.open(this, {
          title: 'Getting Started With Smart Connections',
          url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-command',
        });
      }
    });
  }

  // We keep the old code
  async add_to_gitignore(ignore, message=null) {
    if(!(await this.app.vault.adapter.exists(".gitignore"))) return;
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(ignore) < 0) {
      await this.app.vault.adapter.append(".gitignore", `\n\n${message ? "# " + message + "\n" : ""}${ignore}`);
      console.log("Added to .gitignore: " + ignore);
    }
  }
  async open_note(target_path, event=null) { await open_note(this, target_path, event); }

  async render_code_block(contents, container, ctx) {
    container.empty();
    container.createEl('span', { text: 'Loading…' });
    await SmartEnv.wait_for({ loaded: true });

    const connections_settings = JSON.parse(contents.trim() || '{}');
    // this should be handled better downstream (reduce ambigous limit vs results_limit)
    if(connections_settings?.results_limit && (!connections_settings?.limit || connections_settings?.limit !== connections_settings?.results_limit)) {
      connections_settings.limit = connections_settings.results_limit;
    }
    const observed_connections_settings = create_deep_proxy(connections_settings, (updated) => {
      if (typeof ctx.replaceCode === 'function') ctx.replaceCode(JSON.stringify(connections_settings, null, 2));
      const {text, lineStart: line_start, lineEnd: line_end} = ctx.getSectionInfo(container) ?? {};
      contents = text.split('\n').slice(line_start + 1, line_end).join('\n');
      this.render_code_block(contents, container, ctx);
    });

    const entity =
      this.env.smart_sources.get(ctx.sourcePath) ??
      this.env.smart_sources.init_file_path(ctx.sourcePath);

    if (!entity) {
      container.empty();
      container.createEl('p', { text: 'Entity not found: ' + ctx.sourcePath });
      return;
    }

    const connections_container = await this.env.render_component(
      'connections',
      entity,
      {
        attribution: this.attribution,
        filter: observed_connections_settings,
        codeblock: true,
        connections_settings: observed_connections_settings
      }
    );
    container.empty();
    container.appendChild(connections_container);
  }


  get plugin_is_enabled() { return this.app?.plugins?.enabledPlugins?.has("smart-connections"); }

  // DEPRECATED
  /**
   * @deprecated use SmartEnv.notices instead
   */
  get notices() {
    if(this.env?.notices) return this.env.notices;
    if(!this._notices) this._notices = new SmartNotices(this.env, Notice);
    return this._notices;
  }

  async load_new_user_state() {
    this._installed_at = null;
    const data = await this.loadData();
    // Migration: check for old localStorage value
    if (this.migrate_installed_at_from_localStorage()) {
      // migration handled, _installed_at is set and saved
      return;
    }
    if (data && typeof data.installed_at !== 'undefined') {
      this._installed_at = data.installed_at;
    }
  }

  migrate_installed_at_from_localStorage() {
    const localStorageKey = 'smart_connections_new_user';
    if (typeof localStorage !== 'undefined' && localStorage.getItem(localStorageKey) !== null) {
      const oldValue = localStorage.getItem(localStorageKey) !== 'false';
      if (!oldValue) {
        // If oldValue is false, user is NOT new, so set installed_at to now
        this._installed_at = Date.now();
        this.save_installed_at(this._installed_at);
      }
      // If oldValue is true, user is new, so leave _installed_at null
      localStorage.removeItem(localStorageKey);
      return true;
    }
    return false;
  }

  async save_installed_at(value) {
    this._installed_at = value;
    const data = (await this.loadData()) || {};
    data.installed_at = value;
    // Remove old new_user property if present
    if ('new_user' in data) delete data.new_user;
    await this.saveData(data);
  }

  is_new_user() {
    return !this._installed_at;
  }

  /**
   * MIGRATION: Move last_version from localStorage to plugin data.
   */
  async migrate_last_version_from_localStorage() {
    const localStorageKey = 'smart_connections_last_version';
    if (typeof localStorage !== 'undefined' && localStorage.getItem(localStorageKey)) {
      const version = localStorage.getItem(localStorageKey);
      await this.set_last_known_version(version);
      localStorage.removeItem(localStorageKey);
    }
  }

  /**
   * Returns the last saved plugin version or an empty string.
   * @returns {Promise<string>}
   */
  async get_last_known_version() {
    const data = (await this.loadData()) || {};
    return data.last_version || '';
  }

  /**
   * Persists the provided plugin version as last shown.
   * @param {string} version
   * @returns {Promise<void>}
   */
  async set_last_known_version(version) {
    const data = (await this.loadData()) || {};
    data.last_version = version;
    await this.saveData(data);
  }

  /**
   * Determines if release notes should be shown for `current_version`.
   * @param {string} current_version
   * @returns {Promise<boolean>}
   */
  async should_show_release_notes(current_version) {
    return (await this.get_last_known_version()) !== current_version;
  }

}