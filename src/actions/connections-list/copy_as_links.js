import { copy_to_clipboard } from 'obsidian-smart-env/src/utils/copy_to_clipboard.js';
import { format_connections_as_links } from '../../utils/format_connections_as_links.js';

/**
 * @param {object} [params={}]
 * @returns {string}
 */
function get_links_payload(params = {}) {
  return format_connections_as_links(params.visible_results || []);
}

/**
 * Copy visible Connections results as a list of links.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {Array<object>} [params.visible_results]
 * @returns {Promise<boolean>}
 */
export async function connections_list_copy_as_links(params = {}) {
  const links_payload = get_links_payload(params);
  if (!links_payload) {
    this.env.events.emit('connections:copy_list_empty', {
      level: 'warning',
      message: 'No connection results to copy.',
      event_source: 'connections_view_menu',
    });
    return false;
  }

  await copy_to_clipboard(links_payload);
  this.emit_event('connections:copied_list', {
    level: 'info',
    message: 'Copied connection links to clipboard.',
  });
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Copy as list of links',
    icon: 'copy',
    order: 20,
    disabled() {
      return !get_links_payload(this.params);
    },
  },
};
