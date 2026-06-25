import {
  count_hidden_connections,
  remove_all_hidden_states,
} from '../../utils/connections_list_item_state.js';

/**
 * Remove all hidden flags from the current source item's Connections state.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {boolean}
 */
export function connections_list_unhide_all(params = {}) {
  const source_item = this.item;
  if (!source_item?.data?.connections) return false;

  try {
    const changed = remove_all_hidden_states(source_item.data.connections);
    if (!changed) return false;

    if (source_item.data.hidden_connections) delete source_item.data.hidden_connections;
    source_item.queue_save();
    if (typeof params.view?.render_view === 'function') {
      params.view.render_view({ connections_item: source_item, force: true });
    } else {
      console.warn('connections_list_unhide_all: no view.render_view function provided');
    }
    source_item.collection.save();
    return true;
  } catch (err) {
    this.env?.events?.emit?.('connections:unhide_failed', {
      level: 'error',
      message: 'Unhide failed - check console',
      details: err?.message || '',
      event_source: 'connections_list.unhide_all',
    });
    console.error(err);
    return false;
  }
}

export const menus = {
  'connections:list_menu': {
    title() {
      const hidden_count = count_hidden_connections(this.scope?.item?.data?.connections);
      return `Unhide All (${hidden_count})`;
    },
    icon: 'eye',
    order: 60,
    disabled() {
      return !count_hidden_connections(this.scope?.item?.data?.connections);
    },
  },
};
