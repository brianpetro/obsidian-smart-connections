import Obsidian from "obsidian";
const {
  Notice,
  Plugin,
  requestUrl,
  Platform,
} = Obsidian;

import { SmartEnv } from 'obsidian-smart-env';
import { smart_env_config } from "../smart_env.config.js";
import { open_note } from "obsidian-smart-env/utils/open_note.js";

import { ScEarlySettingsTab } from "./views/settings_tab.js";

import { ReleaseNotesView }    from "./views/release_notes_view.js";

import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';
import { get_random_connection } from "./utils/get_random_connection.js";
import { add_smart_dice_icon } from "./utils/add_icons.js";

// v4
import { SmartPlugin } from "obsidian-smart-env/smart_plugin.js";
import { ConnectionsItemView } from "./views/connections_item_view.js";
import { LookupItemView } from "./views/lookup_item_view.js";
import { register_smart_connections_codeblock } from "./views/connections_codeblock.js";
import { build_connections_codeblock } from "./utils/build_connections_codeblock.js";

export default class SmartConnectionsPlugin extends SmartPlugin {
  SmartEnv = SmartEnv;
  get smart_env_config() {
    if(!this._smart_env_config){
      this._smart_env_config = smart_env_config;
    }
    return this._smart_env_config;
  }
  ConnectionsSettingsTab = ScEarlySettingsTab;

  get item_views() {
    return {
      ConnectionsItemView,
      LookupItemView,
      ReleaseNotesView,
    };
  }

  // GETTERS
  get obsidian() { return Obsidian; }
  get api() { return this._api; }
  onload() {
    this.app.workspace.onLayoutReady(this.initialize.bind(this)); // initialize when layout is ready
    // this.SmartEnv.create(this); // IMPORTANT: works on mobile without this.smart_env_config as second arg (appears to be fixed 2025-12-03)
    this.SmartEnv.create(this, this.smart_env_config);
    // SmartChatView.register_view(this);
    this.addSettingTab(new this.ConnectionsSettingsTab(this.app, this)); // add settings tab
    add_smart_dice_icon();
    this.register_commands(); // from SmartPlugin
    this.register_item_views(); // from SmartPlugin
    this.register_ribbon_icons(); // from SmartPlugin
    // this.register_views(); // replace with register_item_views from SmartPlugin
  }
  // async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("Unloading Smart Connections plugin");
    this.notices?.unload();
    this.env?.unload_main?.(this);
  }

  async initialize() {
    this.smart_connections_view = null;
    this.is_new_user().then(async (is_new) => {
      if (!is_new) return;
      setTimeout(() => {
        StoryModal.open(this, {
          title: 'Getting Started With Smart Connections',
          url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-new-user',
        });
      }, 1000);
      await this.SmartEnv.wait_for({ loaded: true });
      setTimeout(() => {
        this.open_connections_view();
        if(this.app.workspace.rightSplit.collapsed) this.app.workspace.rightSplit.toggle();
      }, 1000);
      this.add_to_gitignore("\n\n# Ignore Smart Environment folder\n.smart-env");
    });
    await this.SmartEnv.wait_for({ loaded: true });
    register_smart_connections_codeblock(this);
    await this.check_for_updates();
  }

  /**
   * Initialize ribbon icons with default visibility.
   */

  get ribbon_icons () {
    return {
      connections: {
        icon_name: "smart-connections",
        description: "Smart Connections: Open connections view",
        callback: () => { this.open_connections_view(); }
      },
      lookup: {
        icon_name: "smart-lookup",
        description: "Smart Lookup: Open lookup view",
        callback: () => { this.open_lookup_view(); }
      },
      random_note: {
        icon_name: "smart-dice",
        description: "Smart Connections: Open random connection",
        callback: () => { this.open_random_connection(); }
      }
    }
  }

  get settings() { return this.env?.settings || {}; }

  async check_for_updates() {
    if (await this.is_new_plugin_version(this.manifest.version)) {
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
        this.env?.events?.emit('plugin:new_version_available', { version: latest_release });
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

  get commands() {
    return {
      ...super.commands,
      random_connection: {
        id: "smart-connections-random",
        name: "Open: Random note from connections",
        callback: async () => {
          await this.open_random_connection();
        }
      },
      getting_started: {
        id: "smart-connections-getting-started",
        name: "Show: Getting started slideshow",
        callback: () => {
          StoryModal.open(this, {
            title: 'Getting Started With Smart Connections',
            url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-command',
          });
        }
      },
      insert_connections_codeblock: {
        id: 'insert-connections-codeblock',
        name: 'Insert: Connections codeblock',
        editorCallback: (editor) => {
          editor.replaceSelection(build_connections_codeblock());
        }
      },
    };
  }

  show_release_notes() {
    return ReleaseNotesView.open(this.app.workspace, this.manifest.version);
  }

  async open_random_connection() {
    const curr_file = this.app.workspace.getActiveFile();
    if (!curr_file) {
      new Notice('No active file to find connections for');
      return;
    }
    const rand_entity = await get_random_connection(this.env, curr_file.path);
    if (!rand_entity) {
      new Notice('Cannot open random connection for non-embedded source: ' + curr_file.path);
      return;
    }
    this.open_note(rand_entity.item.path);
    this.env?.events?.emit?.('connections:open_random');
  }

  async open_note(target_path, event=null) { await open_note(this, target_path, event); }

  /**
   * @deprecated extract into utility
   */
  async add_to_gitignore(ignore, message=null) {
    if(!(await this.app.vault.adapter.exists(".gitignore"))) return;
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(ignore) < 0) {
      await this.app.vault.adapter.append(".gitignore", `\n\n${message ? "# " + message + "\n" : ""}${ignore}`);
      console.log("Added to .gitignore: " + ignore);
    }
  }

}