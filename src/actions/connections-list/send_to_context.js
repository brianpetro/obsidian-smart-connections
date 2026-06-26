import { build_connections_context_items } from '../../utils/connections_context_items.js';

/**
 * @param {import('../../items/connections_list.js').ConnectionsList} connections_list
 * @param {object} [params={}]
 * @returns {Array<object>}
 */
function get_context_items(connections_list, params = {}) {
  const results = Array.isArray(params.visible_results)
    ? params.visible_results
    : connections_list?.results || []
  ;
  if (!results.length) return [];

  return build_connections_context_items({
    source_item: connections_list?.item,
    results,
  });
}

/**
 * Send visible Connections results to a new Smart Context.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {Array<object>} [params.visible_results]
 * @returns {boolean}
 */
export function connections_list_send_to_context(params = {}) {
  const context_items = get_context_items(this, params);
  if (!context_items.length) {
    this.env.events.emit('connections:send_to_context_empty', {
      level: 'warning',
      message: 'No connection results to send to context.',
      event_source: 'connections_view_menu',
    });
    return false;
  }

  const smart_context = this.env.smart_contexts.new_context();
  smart_context.add_items(context_items);
  smart_context.emit_event('context_selector:open');
  this.emit_event('connections:sent_to_context');
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Send to Smart Context',
    icon: 'smart-context-builder',
    order: 20,
    disabled() {
      return !get_context_items(this.scope, this.params).length;
    },
  },
};
