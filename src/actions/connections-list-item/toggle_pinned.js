import {
  apply_pinned_state,
  build_prefixed_connection_key,
  is_connection_pinned,
  remove_pinned_state,
} from '../../utils/connections_list_item_state.js';

function get_menu_pinned_state(menu_ctx) {
  const source_item = menu_ctx.scope?.item;
  const target_item = menu_ctx.params.target_item;
  const prefixed_key = menu_ctx.params.prefixed_key
    || build_prefixed_connection_key(target_item?.collection_key, target_item?.key)
  ;
  return is_connection_pinned(source_item?.data?.connections, prefixed_key);
}

/**
 * Toggle a Connections result pinned state for the current source item.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.target_item]
 * @param {string} [params.prefixed_key]
 * @param {HTMLElement} [params.container]
 * @returns {boolean}
 */
export function connections_list_item_toggle_pinned(params = {}) {
  const source_item = this?.item;
  const target_item = params.target_item;
  const prefixed_key = params.prefixed_key
    || build_prefixed_connection_key(target_item?.collection_key, target_item?.key)
  ;
  const env = this?.env || source_item?.env || target_item?.env;

  if (!source_item || !target_item || !prefixed_key) return false;

  try {
    source_item.data.connections ||= {};
    const pinned = is_connection_pinned(source_item.data.connections, prefixed_key);

    if (pinned) {
      remove_pinned_state(source_item.data.connections, prefixed_key);
      params.container?.classList?.remove('sc-result-pinned');
      params.container?.removeAttribute?.('data-pinned');
    } else {
      apply_pinned_state(source_item.data.connections, prefixed_key, Date.now());
      params.container?.classList?.add('sc-result-pinned');
      if (params.container?.dataset) params.container.dataset.pinned = 'true';
      source_item.emit_event('connections:pinned_item');
    }

    source_item.queue_save();
    source_item.collection.save();
    return true;
  } catch (err) {
    const title_prefix = is_connection_pinned(source_item?.data?.connections, prefixed_key) ? 'Unpin' : 'Pin';
    env?.events?.emit?.('connections:pin_toggle_failed', {
      level: 'error',
      message: `${title_prefix} failed - check console`,
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
      const title_prefix = get_menu_pinned_state(this) ? 'Unpin' : 'Pin';
      return `${title_prefix} ${this.params.target_name || this.params.target_item?.key || 'connection'}`;
    },
    icon() {
      return get_menu_pinned_state(this) ? 'pin-off' : 'pin';
    },
    order: 20,
  },
};
