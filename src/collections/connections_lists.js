import { Collection } from 'smart-collections';
import { parse_frontmatter_filter_lines } from 'smart-entities/utils/frontmatter_filter.js';
import { ConnectionsList } from '../items/connections_list.js';
import { migrate_connections_lists_settings } from '../../migrations/migrate_connections_lists_settings.js';
import { insert_settings_after } from '../utils/insert_settings_after.js';

/**
 * Configuration for filtering connections results.
 * Copied from SmartEntities to avoid additional dependency.
 */
export const connections_filter_config = {
  "results_collection_key": {
    name: "Connection results type",
    type: "dropdown",
    description: "Choose whether results should be sources or blocks.",
    option_1: 'smart_sources|Sources',
    option_2: 'smart_blocks|Blocks',
  },
  "results_limit": {
    name: "Results limit",
    type: "number",
    description: "Adjust the number of connections displayed in the connections view (default 20).",
  },
};

export class ConnectionsLists extends Collection {
  static version = 1;
  process_load_queue() {} // no persisting data (for now)

  constructor(env, opts = {}) {
    migrate_connections_lists_settings(env); // probably should be removed soon
    super(env, opts);
  }

  static get default_settings() {
    return {
      results_collection_key: 'smart_sources',
      score_algo_key: 'similarity',
      connections_post_process: 'none',
      results_limit: 20,
      connections_view_location: 'right',
      exclude_frontmatter_blocks: true,
      frontmatter_filter_include: '',
      frontmatter_filter_exclude: '',
      // Graph and result-style defaults are applied by the plugin after migration.
      components: {
        connections_list: {},
        connections_list_item_v3: {
          render_markdown: true,
          show_full_path: false,
        }
      },
    };
  }

  get settings_config() {
    return settings_config(this);
  }

  new_connections_list(item) {
    return new this.item_type(this.env, {
      collection_key: item.collection_key,
      item_key: item.key
    });
  }

  new_item(item) {
    const connections_list = this.new_connections_list(item);
    this.set(connections_list);
    Object.defineProperty(item, 'connections', {
      get: () => connections_list,
      configurable: true
    });
    return connections_list;
  }

  get_connections_graph_component_options() {
    return Object.entries(this.env.config.components || {})
      .filter(([key]) => key.startsWith('connections_graph_'))
      .map(([value, component]) => ({ value, name: component.display_name || value, description: component.description }))
    ;
  }

  get_connections_list_item_options() {
    return Object.entries(this.env.config.components || {})
      .filter(([key, fn]) => key.startsWith('connections_list_item_'))
      .map(([value, fn]) => ({ value, name: fn.display_name || value, description: fn.description }))
    ;
  }

  get score_algo_key() {
    const stored_key = this.settings?.score_algo_key;
    if(this.env.config?.actions?.[stored_key]) return stored_key;
    return 'similarity'; // TEMP default
  }
  get results_collection_key() {
    const stored_key = this.settings?.results_collection_key;
    if(this.env[stored_key]) return stored_key;
    return 'smart_sources';
  }

  get frontmatter_inclusions() {
    return parse_frontmatter_filter_lines(this.settings.frontmatter_filter_include);
  }

  get frontmatter_exclusions() {
    return parse_frontmatter_filter_lines(this.settings.frontmatter_filter_exclude);
  }

  get_connections_graph_component_settings_config(component_key) {
    const component_module = this.env.config.components?.[component_key];
    const config = typeof component_module?.settings_config === 'function'
      ? component_module.settings_config(this)
      : component_module?.settings_config
    ;
    if (!config) return null;
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [`components.${component_key}.${key}`, value])
    );
  }

  get connections_list_component_settings_config() {
    const component_key = 'connections_list';
    const component_module = this.env.config.components?.[component_key];
    const config = typeof component_module?.settings_config === 'function'
      ? component_module.settings_config(this)
      : component_module?.settings_config
    ;
    if (!config) return null;
    // prepend `components.${key}.` to each config key
    return Object.fromEntries(
      Object.entries(config)
        .map(([k, v]) => {
          return [`components.${component_key}.${k}`, v];
        })
    );
  }
}

export function settings_config(scope) {
  let config = {
    "results_collection_key": {
      name: "Connection results type",
      type: "dropdown",
      description: "Choose whether results should be sources or blocks.",
      option_1: 'smart_sources|Sources', // DEPRECATED
      option_2: 'smart_blocks|Blocks', // DEPRECATED
      options_callback: () => {
        const options = [
          { value: 'smart_sources', name: 'Sources' },
        ];
        if (scope.env.smart_blocks) {
          options.push({ value: 'smart_blocks', name: 'Blocks' });
        }
        return options;
      }
    },
    "results_limit": {
      name: "Results limit",
      type: "number",
      description: "Adjust the number of connections displayed in the connections view (default 20).",
    },
    "connections_view_location": {
      group: "Display",
      name: "Connections sidebar location",
      type: "dropdown",
      description: "Choose which sidebar opens when showing the Connections view.",
      option_1: "right|Right sidebar", // DEPRECATED
      option_2: "left|Left sidebar", // DEPRECATED
      options_callback: () => {
        return [
          { value: 'right', name: 'Right sidebar' },
          { value: 'left', name: 'Left sidebar' },
        ];
      }
    },
    "show_connections_graph": {
      group: 'Display',
      name: "Show connections graph",
      type: "toggle",
      description: "Show a graph above connection results in the Connections view and code blocks.",
    },
    "connections_graph_component_key": {
      group: 'Display',
      name: "Graph style",
      type: "dropdown",
      description: "Choose the graph visualization.",
      options_callback: (scope) => scope.get_connections_graph_component_options(),
    },
    "inline_connections": {
      group: 'Inline connections',
      name: "Show inline connections",
      type: "toggle",
      scope_class: 'pro-setting',
      description: "Shows connections for each block within the note. Hover connections icon to see list of connections.",
    },
    "footer_connections": {
      group: 'Footer connections',
      name: "Show footer connections",
      type: "toggle",
      description: "Show connections at the bottom of each note.",
    },
    "footer_show_connections_graph": {
      group: 'Footer connections',
      name: "Show graph",
      type: "toggle",
      description: "Show a graph above footer connection results.",
    },
    "footer_connections_graph_component_key": {
      group: 'Footer connections',
      name: "Graph style",
      type: "dropdown",
      description: "Choose the graph visualization for footer connections.",
      options_callback: (scope) => scope.get_connections_graph_component_options(),
    },
    filters_helper: {
      group: 'Connections filters',
      type: 'html',
      value: [
        '<p class="setting-item-description"><strong>Filter tips:</strong> Use comma-separated folder or file path fragments such as <code>Projects/Clients</code>. Values are trimmed automatically and compared using case-sensitive substring matches.</p>',
        '<p class="setting-item-description"><strong>Result vs ingestion:</strong> Connections filters only hide results after Smart Environment builds its dataset. To stop notes from being indexed, adjust Smart Environment include/exclude settings in the Environment window or plugin settings.</p>',
        '<p class="setting-item-description"><strong>Precedence:</strong> Entries in the exclude filter always win when they match, even if the same path fragment appears in the include filter.</p>'
      ].join('')
    },
    "exclude_inlinks": {
      group: 'Connections filters',
      name: "Exclude inlinks (backlinks)",
      type: "toggle",
      scope_class: 'pro-setting',
      description: "Exclude notes that already link to the current note from the connections results.",
    },
    "exclude_outlinks": {
      group: 'Connections filters',
      name: "Exclude outlinks",
      type: "toggle",
      scope_class: 'pro-setting',
      description: "Exclude notes that are already linked from within the current note from appearing in the connections results.",
    },
    "include_filter": {
      group: 'Connections filters',
      name: "Include filter",
      type: "text",
      scope_class: 'pro-setting',
      description: "Comma-separated path fragments that must appear in the note path. Matches use case-sensitive substring checks; trim spaces or wrap folder names like `Daily/`. This only affects the results list; Smart Environment still embeds matching notes unless excluded there.",
    },
    "exclude_filter": {
      group: 'Connections filters',
      name: "Exclude filter",
      type: "text",
      scope_class: 'pro-setting',
      description: "Comma-separated path fragments to omit from results. Exclusions run before includes, so any matching fragment removes the note even if it also appears in `Include filter`. Use Smart Environment include/exclude settings to stop notes from being embedded altogether.",
    },
    "frontmatter_filter_include": {
      group: 'Connections filters',
      name: 'Frontmatter include filter',
      type: 'text',
      scope_class: 'pro-setting',
      description: 'Newline-delimited frontmatter matchers (ex. status or status:open). Case-insensitive key and value matching.',
    },
    "frontmatter_filter_exclude": {
      group: 'Connections filters',
      name: 'Frontmatter exclude filter',
      type: 'text',
      scope_class: 'pro-setting',
      description: 'Newline-delimited frontmatter matchers removed from results. Exclude entries take precedence over include entries.',
    },
    // hide frontmatter blocks from connections results
    "exclude_frontmatter_blocks": {
      group: 'Connections filters',
      name: "Hide frontmatter blocks in results",
      type: "toggle",
      scope_class: 'pro-setting',
      description: "Show only sources in the connections results (no frontmatter blocks).",
    },
  };

  if (!scope.env.smart_blocks.settings.embed_blocks) {
    config.results_collection_key = {
      type: 'html',
      value: '<p>Enable "Embed blocks" in Smart Blocks settings to use block connections.</p>',
      name: 'Connection results type',
    };
  }

  if(scope.connections_list_component_settings_config) {
    config = insert_settings_after('connections_graph_component_key', config, scope.connections_list_component_settings_config);
  }

  const configured_graphs = new Set();
  for (const [show_key, graph_key, group] of [
    ['show_connections_graph', 'connections_graph_component_key', 'Display'],
    ['footer_show_connections_graph', 'footer_connections_graph_component_key', 'Footer connections'],
  ]) {
    const requested_graph_key = scope.settings[graph_key] ?? 'connections_graph_v1';
    const component_key = scope.env.config.components?.[requested_graph_key]
      ? requested_graph_key
      : 'connections_graph_v1';
    if (!scope.settings[show_key] || configured_graphs.has(component_key)) continue;
    const graph_settings = scope.get_connections_graph_component_settings_config(component_key);
    if (!graph_settings) continue;
    configured_graphs.add(component_key);
    config = insert_settings_after(graph_key, config, Object.fromEntries(
      Object.entries(graph_settings).map(([key, value]) => [key, { ...value, group }])
    ));
  }

  if (!scope.settings.show_connections_graph) delete config.connections_graph_component_key;
  if (!scope.settings.footer_show_connections_graph) delete config.footer_connections_graph_component_key;

  return config;
};

export default {
  class: ConnectionsLists,
  collection_key: 'connections_lists',
  item_type: ConnectionsList,
  settings_config,
};
