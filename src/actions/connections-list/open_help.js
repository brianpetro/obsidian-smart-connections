import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';

const HELP_TITLE = 'Getting Started With Smart Connections';
const HELP_URL = 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help#page=understanding-connections-1';
const COMMAND_HELP_URL = 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-command';

/**
 * Open the Smart Connections getting started guide.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.plugin]
 * @param {object} [params.view]
 * @param {string} [params.url]
 * @returns {boolean}
 */
export function connections_list_open_help(params = {}) {
  const plugin = params.plugin
    || params.view?.plugin
    || this.env?.smart_connections_plugin
    || this.env?.plugin
    || this.env?.main
  ;
  if (!plugin) return false;

  StoryModal.open(plugin, {
    title: HELP_TITLE,
    url: params.url || HELP_URL,
  });
  return true;
}

export const commands = {
  'smart-connections-getting-started': {
    name: 'Show: Getting started slideshow',

    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-connections';
    },

    params({ plugin }) {
      return {
        plugin,
        url: COMMAND_HELP_URL,
      };
    },

    get_scope({ env }) {
      return env.connections_lists;
    },
  },
};

export const menus = {
  'connections:list_menu': {
    title: 'Help & getting started',
    icon: 'help-circle',
    order: 100,
  },
};
