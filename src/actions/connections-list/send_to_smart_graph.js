export const SMART_GRAPH_URL = 'https://smartconnections.app/smart-graph/';

/**
 * Open Smart Graph information when Smart Graph Pro is not installed.
 *
 * Smart Graph Pro replaces this placeholder with an actual graph action via
 * its own `connections:list_menu` menu action.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 */
export function connections_list_send_to_smart_graph() {
  if (this?.env?.event_logs?.settings?.native_notice_attention) {
    this?.env?.events?.emit?.('connections:smart_graph_link_unavailable', {
      level: 'attention',
      message: 'Smart Graph plugin is required.',
      event_source: 'connections_list_send_to_smart_graph',
      link: SMART_GRAPH_URL,
      hide_mute_button: true,
    });
    return;
  }

  // open directly if attention notifications are disabled
  activeWindow.open(SMART_GRAPH_URL, '_external');
  return;
}

export const menus = {
  'connections:list_menu': {
    title: 'Explore in Smart Graph',
    icon: 'smart-graph',
    order: 30,
    when() {
      return !this.env?.smart_graph_plugin?._loaded;
    },
  },
};
