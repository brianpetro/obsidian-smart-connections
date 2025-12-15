import { SmartPluginSettingsTab } from "obsidian-smart-env";
import {render_settings_config} from "obsidian-smart-env/src/utils/render_settings_config.js";

export class ScEarlySettingsTab extends SmartPluginSettingsTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide(){
    super.hide?.();
    this.plugin_container?.empty?.();
    this.turn_off_listener?.();
  }

  async render_header(container) {
    const header = await this.env.smart_components.render_component('connections_settings_header', this.plugin);
    container.appendChild(header);
  }

  async render_plugin_settings(container) {
    if (!container) return;
    container.empty?.();
    container.innerHTML = '<div class="sc-loading">Loading main settings...</div>';

    container.empty?.();

    const cl_container = container.createDiv({
      cls: 'sc-settings-tab__section',
      attr: { 'data-section-key': 'connections_lists' },
    });
    cl_container.createEl('h1', { text: 'Connections' });
    
    const connections_lists_settings_config = this.env.config.collections.connections_lists.settings_config;
    // const connections_lists_settings = await smart_view.render_settings(connections_lists_settings_config, { scope: this.env.connections_lists });
    // if (connections_lists_settings) cl_container.appendChild(connections_lists_settings);
    render_settings_config(
      connections_lists_settings_config,
      this.env.connections_lists,
      cl_container,
      {
        default_group_name: 'Connections lists',
        group_params: {
          'Connections lists': {
            heading_btn: [
              {
                label: 'Learn about Connections Lists',
                btn_text: 'Learn more',
                callback: () => window.open('https://smartconnections.app/smart-connections/list-feature/?utm_source=connections-settings-tab', '_external'),
              },
              {
                label: 'Settings documentation for Connections Lists',
                btn_icon: 'help-circle',
                callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#connections-lists', '_external'),
              },
            ]
          },
          'Display': {
            heading_btn: {
              label: 'Settings documentation for Display',
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#display', '_external'),
            }
          },
          'Score algorithm': {
            heading_btn: {
              label: 'Settings documentation for Score Algorithms',
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#score-algorithm', '_external'),
            }
          },
          'Ranking algorithm': {
            heading_btn: {
              label: 'Settings documentation for Ranking Algorithms',
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#ranking-algorithm', '_external'),
            }
          },
          'Filters': {
            heading_btn: {
              label: 'Settings documentation for Filters',
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#filters', '_external'),
            }
          },
          'Inline connections': {
            heading_btn: [
              {
                label: 'Learn about the inline connections feature',
                btn_text: 'Learn more',
                callback: () => window.open('https://smartconnections.app/smart-connections/inline/?utm_source=connections-settings-tab', '_external'),
              },
              {
                label: 'Settings documentation for inline connections',
                btn_icon: 'help-circle',
                callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#inline-connections', '_external'),
              },
            ]
          },
          'Footer connections': {
            heading_btn: {
              label: 'Settings documentation for Footer Connections',
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#footer-connections', '_external'),
            }
          },
        }
      }
    );

    const ll_container = container.createDiv({
      cls: 'sc-settings-tab__section',
      attr: { 'data-section-key': 'lookup_lists' },
    });
    // ll_container.createEl('h1', { text: 'Lookup' });

    const lookup_lists_settings_config = this.env.config.collections.lookup_lists.settings_config;
    // const lookup_lists_settings = await smart_view.render_settings(lookup_lists_settings_config, { scope: this.env.lookup_lists });
    // if (lookup_lists_settings) ll_container.appendChild(lookup_lists_settings);
    render_settings_config(
      lookup_lists_settings_config,
      this.env.lookup_lists,
      ll_container,
      {
        default_group_name: 'Lookup lists',
        group_params: {
          'Lookup lists': {
            heading_btn: [
              {
                label: 'Learn about Lookup Lists',
                btn_text: 'Learn more',
                callback: () => window.open('https://smartconnections.app/smart-connections/lookup/?utm_source=connections-settings-tab', '_external'),
              },
              {
                label: 'Settings documentation for Lookup Lists',
                btn_icon: 'help-circle',
                callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=connections-settings-tab#lookup-lists', '_external'),
              }
            ]
          },
        }
      }
    );

    this.register_env_events();
  }

  register_env_events() {
    if (this.turn_off_listener || !this.env?.events) return;
    this.turn_off_listener = this.env.events.on('settings:changed', (event) => {
      if (event.path?.includes('connections_post_process')
        || event.path?.includes('score_algo_key')
        || event.path?.includes('connections_list_item')
      ) {
        this.render_plugin_settings(this.plugin_container);
      }
    });
  }
}
