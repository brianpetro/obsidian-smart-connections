export async function connections_view_refresh_handler(event) {
  const view_container = event.target.closest('.connections-view');
  const list_el = view_container?.querySelector('.connections-list');
  const entity_key = list_el?.dataset?.key;
  console.log(`Refreshing smart connections view entity ${entity_key}`);
  const refresh_entity = this.env.smart_sources.get(entity_key);
  if (refresh_entity) {
    await refresh_entity.read();
    refresh_entity.queue_import();
    await refresh_entity.collection.process_source_import_queue?.();
    this.render_view(refresh_entity);
  } else {
    console.warn('No entity found for refresh');
  }
}
