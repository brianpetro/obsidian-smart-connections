import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';

/**
 * Open the Smart Connections getting started guide.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {boolean}
 */
export function connections_list_open_help(params = {}) {
  const plugin = params.view?.plugin
    || this.env?.smart_connections_plugin
    || this.env?.plugin
    || this.env?.main
  ;
  if (!plugin) return false;

  StoryModal.open(plugin, {
    title: 'Getting Started With Smart Connections',
    url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-view-help#page=understanding-connections-1',
  });
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Help & getting started',
    icon: 'help-circle',
    order: 100,
  },
};
