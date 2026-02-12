import { Collection } from 'smart-collections';
import { parse_frontmatter_filter_lines } from 'smart-entities/utils/frontmatter_filter.js';
import { ConnectionsList } from '../items/connections_list.js';
import { migrate_connections_lists_settings } from '../../migrations/migrate_connections_lists_settings.js';

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
    migrate_connections_lists_settings(env);
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
      connections_list_item_component_key: 'connections_list_item_v3',
      frontmatter_filter_include: '',
      frontmatter_filter_exclude: '',
      components: {
        connections_list_item_v3: {
          render_markdown: true,
          show_full_path: false,
        }
      },
    };
  }

  get settings_config() {
    return settings_config(this);
    // let config = { ...connections_filter_config };
    // return config;
  }

  new_item(item) {
    const connections_list = new this.item_type(this.env, {
      collection_key: item.collection_key,
      item_key: item.key
    });
    this.set(connections_list);
    Object.defineProperty(item, 'connections', {
      get: () => connections_list,
      configurable: true
    });
    return connections_list;
  }

  get_connections_list_item_options() {
    return Object.entries(this.env.config.components || {})
      .filter(([key, fn]) => key.startsWith('connections_list_item_'))
      .map(([value, fn]) => ({ value, name: fn.display_name || value, description: fn.display_description }))
    ;
  }

  get score_algo_key () {
    const stored_key = this.settings?.score_algo_key;
    if(this.env.config?.actions?.[stored_key]) return stored_key;
    return 'similarity'; // TEMP default
  }
  get results_collection_key () {
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
}

export function settings_config (scope) {
  const config = {
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
      scope_class: 'pro-setting',
      description: "Show connections at the bottom of each note.",
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

  return config;
};

export default {
  class: ConnectionsLists,
  collection_key: 'connections_lists',
  item_type: ConnectionsList,
  settings_config,
};

