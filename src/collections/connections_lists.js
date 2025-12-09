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
    },
    "results_limit": {
      name: "Results limit",
      type: "number",
      description: "Adjust the number of connections displayed in the connections view (default 20).",
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



