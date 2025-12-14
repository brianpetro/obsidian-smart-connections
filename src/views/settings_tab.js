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
    const smart_view = this.env?.smart_view;

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
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#connections-lists', '_external'),
            }
          },
          'Display': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#display', '_external'),
            }
          },
          'Score algorithm': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#score-algorithm', '_external'),
            }
          },
          'Ranking algorithm': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#ranking-algorithm', '_external'),
            }
          },
          'Filters': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#filters', '_external'),
            }
          },
          'Inline connections': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#inline-connections', '_external'),
            }
          },
          'Footer connections': {
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#footer-connections', '_external'),
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
            heading_btn: {
              btn_icon: 'help-circle',
              callback: () => window.open('https://smartconnections.app/smart-connections/settings/#lookup-lists', '_external'),
            }
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
