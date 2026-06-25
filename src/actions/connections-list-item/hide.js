import {
  apply_hidden_state,
  build_prefixed_connection_key,
} from '../../utils/connections_list_item_state.js';

const SC_RESULT_HIDDEN_CLASS = 'sc-result-hidden-by-feedback';

/**
 * Hide a Connections result from the current source item's results.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.source_item]
 * @param {object} [params.target_item]
 * @param {string} [params.prefixed_key]
 * @param {HTMLElement} [params.container]
 * @returns {boolean}
 */
export function connections_list_item_hide(params = {}) {
  const source_item = params.source_item || this?.item;
  const target_item = params.target_item;
  const prefixed_key = params.prefixed_key
    || build_prefixed_connection_key(target_item?.collection_key, target_item?.key)
  ;
  const env = this?.env || source_item?.env || target_item?.env;

  if (!source_item || !target_item || !prefixed_key) return false;

  try {
    source_item.data.connections ||= {};
    apply_hidden_state(source_item.data.connections, prefixed_key, Date.now());

    if (source_item.data.hidden_connections) {
      delete source_item.data.hidden_connections[target_item.key];
      if (!Object.keys(source_item.data.hidden_connections).length) {
        delete source_item.data.hidden_connections;
      }
    }

    source_item.queue_save();
    params.container?.classList?.add(SC_RESULT_HIDDEN_CLASS);
    if (params.container?.dataset) params.container.dataset.hidden = 'true';
    source_item.collection.save();
    source_item.emit_event('connections:hidden_item');
    return true;
  } catch (err) {
    env?.events?.emit?.('connections:hide_failed', {
      level: 'error',
      message: 'Hide failed - check console',
      details: err?.message || '',
      event_source: 'connections_list_item.contextmenu',
    });
    console.error(err);
    return false;
  }
}

export const menus = {
  'connections:list_item_menu': {
    title() {
      return `Hide ${this.params.target_name || this.params.target_item?.key || 'connection'}`;
    },
    icon: 'eye-off',
    order: 10,
  },
};
