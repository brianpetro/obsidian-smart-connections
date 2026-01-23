import { Collection } from 'smart-collections';
import { ConnectionsList } from '../items/connections_list.js';
import { migrate_connections_lists_settings } from '../../migrations/migrate_connections_lists_settings.js';
import { insert_settings_after } from '../utils/insert_settings_after.js';
import { create_settings_section_heading } from 'obsidian-smart-env/src/utils/create_settings_section_heading.js';

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
      exclude_frontmatter_blocks: true,
      exclude_same_folder: false,
      exclude_rootline: false,
      same_folder_boost_multiplier: 1.5,
      rootline_boost_multiplier: 2.0,
      max_boost_multiplier: 10.0,
      show_path_and_tags: false,
      connections_list_item_component_key: 'connections_list_item_v3',
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
}

export function settings_config (scope) {
  const config = {
    "results_collection_key": {
      name: "Connection results type",
      type: "dropdown",
      description: "Choose whether results should be sources or blocks.",
      option_1: 'smart_sources|Sources',
      option_2: 'smart_blocks|Blocks',
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
    "exclude_same_folder": {
      name: "Exclude notes from same folder",
      type: "toggle",
      description: "When enabled, notes in the same folder as the current note will be excluded from connection results.",
      group: "Filters",
    },
    "exclude_rootline": {
      name: "Exclude notes from ancestor folders",
      type: "toggle",
      description: "When enabled, notes in any ancestor folder (parent, grandparent, etc.) of the current note will be excluded from connection results. More restrictive than 'Exclude same folder'.",
      group: "Filters",
    },
    "same_folder_boost_multiplier": {
      name: "Same folder filter boost multiplier",
      type: "number",
      description: "Multiplier for initial results limit when 'Exclude same folder' is active. Higher values fetch more results to compensate for filtering. Default: 1.5",
      group: "Filters",
    },
    "rootline_boost_multiplier": {
      name: "Rootline filter boost multiplier",
      type: "number",
      description: "Multiplier for initial results limit when 'Exclude rootline' is active. Higher values fetch more results to compensate for filtering. Default: 2.0",
      group: "Filters",
    },
    "max_boost_multiplier": {
      name: "Maximum boost multiplier",
      type: "number",
      description: "Maximum total multiplier for adaptive retry logic. When filters leave no results, the system will retry with increasingly higher limits up to this maximum. Default: 10.0",
      group: "Filters",
    },
    "show_path_and_tags": {
      name: "Show path and tags in results",
      type: "toggle",
      description: "Display the file path and tags below each connection result.",
      group: "Display",
    },
  };

  if (!scope.env.smart_blocks.settings.embed_blocks) {
    config.results_collection_key = {
      type: 'html',
      value: create_settings_section_heading('Connection results type', 'Enable "Embed blocks" in Smart Blocks settings to use block connections.'),
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



