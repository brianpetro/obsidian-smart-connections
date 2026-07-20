import Obsidian from "obsidian";
const {
  Plugin,
  requestUrl,
  Platform,
} = Obsidian;

import { SmartEnv } from 'obsidian-smart-env';
import { smart_env_config } from "../smart_env.config.js";
import { open_note } from "obsidian-smart-env/utils/open_note.js";

import { ScEarlySettingsTab } from "./views/settings_tab.js";

import { ReleaseNotesView } from "./views/release_notes_view.js";

// DEPRECATED 2026-05-14: Smart Lookup fallback disabled because Smart Lookup is available in plugin index.
// import { ConnectionsLookupItemView } from './views/lookup_item_view.js';

import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';
import { add_smart_dice_icon } from "./utils/add_icons.js";
import { should_relocate_leaf } from "./utils/view_leaf_location.js";

import { SmartPlugin } from "obsidian-smart-env/smart_plugin.js";
import { ConnectionsItemView } from "./views/connections_item_view.js";
import { connections_footer_plugin } from './views/connections_footer_deco.js';
import { ConnectionsFooterView } from './views/connections_footer_view.js';
import { register_smart_connections_codeblock } from "./views/connections_codeblock.js";
import { build_connections_codeblock } from "./utils/build_connections_codeblock.js";
import {
  connections_list_open_random_connection,
  open_random_connection_command,
} from './actions/connections-list/open_random_connection.js';

export default class SmartConnectionsPlugin extends SmartPlugin {
  SmartEnv = SmartEnv;
  ReleaseNotesView = ReleaseNotesView;

  get smart_env_config() {
    if (!this._smart_env_config) {
      this._smart_env_config = { ...smart_env_config };
    }
    return this._smart_env_config;
  }

  ConnectionsSettingsTab = ScEarlySettingsTab;

  get item_views() {
    return {
      ConnectionsItemView,
      ReleaseNotesView: this.ReleaseNotesView,
      // DEPRECATED 2026-05-14: Smart Lookup is a standalone plugin available in plugin index.
      // Keep the legacy Connections-hosted Lookup view disabled to avoid importing smart-lookup-obsidian here.
      // ...(!this.app.plugins.enabledPlugins.has('smart-lookup') ? { ConnectionsLookupItemView } : {}),
    };
  }

  get obsidian() { return Obsidian; }
  get api() { return this._api; }

  onload() {
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
    this.SmartEnv.create(this, this.smart_env_config);
    this.addSettingTab(new this.ConnectionsSettingsTab(this.app, this));
    add_smart_dice_icon();
    this.register_commands();
    this.register_item_views();
  }

  onunload() {
    console.log("Unloading Smart Connections plugin");
    this.connections_footer_view?.unload();
    this.notices?.unload();
    this.env?.unload_main?.(this);
  }

  async initialize() {
    this.register_ribbon_actions();
    this.smart_connections_view = null;
    this.is_new_user().then(async (is_new) => {
      if (!is_new) return;
      window.setTimeout(() => {
        StoryModal.open(this, {
          title: 'Getting Started With Smart Connections',
          url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-new-user',
        });
      }, 1000);
      await this.SmartEnv.wait_for({ loaded: true });
      window.setTimeout(() => {
        this.apply_connections_view_location();
        this.open_connections_view();
      }, 1000);
      this.add_to_gitignore("\n\n# Ignore Smart Environment folder\n.smart-env");
    });
    await this.SmartEnv.wait_for({ loaded: true });
    this.wrap_connections_view_open();
    this.apply_connections_view_location();
    this.register_connections_view_location_listener();
    register_smart_connections_codeblock(this);
    if (!this.connections_footer_view) {
      this.registerEditorExtension(connections_footer_plugin);
      this.connections_footer_view = new ConnectionsFooterView(this);
    }
    this.toggled_footer_connections();
    await this.check_for_updates();
  }

  get settings() { return this.env?.settings || {}; }

  /**
   * Sync connections view location with settings.
   * @returns {void}
   */
  apply_connections_view_location() {
    const connections_view_location = this.env?.connections_lists?.settings?.connections_view_location ?? 'right';
    ConnectionsItemView.default_open_location = connections_view_location === 'left' ? 'left' : 'right';
    this.ensure_connections_view_leaf_location();
  }

  wrap_connections_view_open() {
    if (this._open_connections_view_base || typeof this.open_connections_view !== 'function') {
      return;
    }
    this._open_connections_view_base = this.open_connections_view.bind(this); // added on register by SmartItemView
    this.open_connections_view = (...args) => {
      this.ensure_connections_view_leaf_location();
      return this._open_connections_view_base(...args);
    };
  }

  ensure_connections_view_leaf_location() {
    const workspace = this.app?.workspace;
    if (!workspace) {
      return;
    }
    const desired_location = ConnectionsItemView.default_open_location;
    const connections_leaf = ConnectionsItemView.get_leaf(workspace);
    if (!should_relocate_leaf({ workspace, leaf: connections_leaf, desired_location })) {
      return;
    }
    connections_leaf.detach();
  }

  register_connections_view_location_listener() {
    if (this.connections_view_location_listener || !this.env?.events) return;
    this.connections_view_location_listener = this.env.events.on('settings:changed', (event) => {
      if (!event?.path?.includes?.('connections_view_location')) return;
      this.apply_connections_view_location();
    });
  }

  async check_for_updates() {
    if (await this.is_new_plugin_version(this.manifest.version)) {
      console.log("opening release notes modal");
      try {
        this.ReleaseNotesView.open(this.app.workspace, this.manifest.version);
      } catch (error) {
        console.error('Failed to open ReleaseNotesView', error);
      }
      await this.set_last_known_version(this.manifest.version);
    }
    window.setTimeout(this.check_for_update.bind(this), 3000);
  }

  async check_for_update() {
    try {
      const { json: response } = await requestUrl({
        url: "https://api.github.com/repos/brianpetro/obsidian-smart-connections/releases/latest",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        contentType: "application/json",
      });
      const latest_release = response.tag_name;
      if (latest_release !== this.manifest.version) {
        if (!this.update_available || this.latest_release_version !== latest_release) {
          this.env?.events?.emit('plugin:new_version_available', {
            level: 'attention',
            message: `Smart Connections ${latest_release} is available.`,
            version: latest_release,
            event_source: 'check_for_update',
          });
        }
        this.latest_release_version = latest_release;
        this.update_available = true;
      }
    } catch (error) {
      console.error(error);
    }
  }

  get commands() {
    return {
      ...super.commands,
      random_connection: {
        id: open_random_connection_command.id,
        name: open_random_connection_command.name,
        callback: async () => {
          await open_random_connection_command.callback(this);
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
      toggle_footer_connections: {
        id: 'toggle-footer-connections',
        name: 'Toggle: Footer connections',
        callback: () => {
          const settings = this.env.connections_lists.settings;
          settings.footer_connections = !settings.footer_connections;
        }
      },
    };
  }

  async open_random_connection() {
    return await connections_list_open_random_connection.call(this.env?.connections_lists, {
      plugin: this,
      event_source: 'open_random_connection',
    });
  }

  /**
   * Attempts to retrieve the CodeMirror 6 EditorView for the active markdown file.
   * @returns {EditorView|null}
   */
  get_editor_view() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      console.log("Smart Connections: No active file found");
      return null;
    }
    const markdown_view = this.app.workspace.getActiveFileView();
    if (!markdown_view) {
      console.log("Smart Connections: No active file view found");
      return null;
    }
    return markdown_view.editor?.cm || null;
  }

  toggled_footer_connections() {
    const view = this.get_editor_view();
    if (view && this.env.connections_lists.settings.footer_connections) {
      this.connections_footer_view?.render_view();
    } else {
      this.connections_footer_view?.remove();
    }
  }

  async open_note(target_path, event = null) { await open_note(this, target_path, event); }

  /**
   * @deprecated extract into utility
   */
  async add_to_gitignore(ignore, message = null) {
    if (!(await this.app.vault.adapter.exists(".gitignore"))) return;
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(ignore) < 0) {
      await this.app.vault.adapter.append(".gitignore", `\n\n${message ? "# " + message + "\n" : ""}${ignore}`);
      console.log("Added to .gitignore: " + ignore);
    }
  }
}

