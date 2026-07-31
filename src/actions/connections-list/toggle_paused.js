/**
 * Toggle Connections auto-refresh for the current item view.
 * When resuming, refresh the view target to the current active note.
 *
 * @this {import('../../views/connections_item_view.js').ConnectionsItemView}
 * @param {object} [params={}]
 * @returns {Promise<boolean>}
 */
export async function connections_list_toggle_paused(params = {}) {
  if (!this?.toggle_paused) return false;

  await this.toggle_paused({
    event_source: params.event_source || 'connections_list_toggle_paused',
  });
  return true;
}

export const menus = {
  'connections:item_view_list_menu': {
    title() {
      return this.scope?.paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
    },
    icon() {
      return this.scope?.paused ? 'play-circle' : 'pause-circle';
    },
    order: 0,
  },
};
