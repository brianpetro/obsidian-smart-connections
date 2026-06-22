/**
 * Refresh the current Connections source and rerender the active view.
 *
 * @this {import('../../items/connections_list.js').ConnectionsList}
 * @param {object} [params={}]
 * @param {object} [params.view]
 * @returns {Promise<boolean>}
 */
export async function connections_list_refresh(params = {}) {
  const refresh_entity = this.item;
  if (!refresh_entity) return false;

  await refresh_entity.read();
  refresh_entity.queue_import();
  await refresh_entity.collection.process_source_import_queue?.();
  await params.view?.render_view?.({ connections_item: refresh_entity });
  return true;
}

export const menus = {
  'connections:list_menu': {
    title: 'Refresh connections',
    icon: 'refresh-cw',
    order: 10,
  },
};
