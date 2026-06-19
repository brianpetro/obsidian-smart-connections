import { connections_view_refresh_handler } from '../../utils/connections_view_refresh_handler.js';

/**
 * Refresh the active Connections view.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @param {HTMLElement} [params.container]
 * @returns {*}
 */
export function connections_list_refresh(params = {}) {
  return connections_view_refresh_handler.call(params.view, { target: params.container });
}

export const menus = {
  'connections:list_menu': {
    title: 'Refresh connections',
    icon: 'refresh-cw',
    order: 10,
  },
};
