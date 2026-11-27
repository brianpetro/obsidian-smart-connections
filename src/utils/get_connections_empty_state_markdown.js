/**
 * Return a Markdown callout for empty Connections results in Core and Pro.
 * @param {object} item - The current Connections target.
 * @returns {string}
 */
export function get_connections_empty_state_markdown(item) {
  const is_short_source = item?.collection_key === 'smart_sources'
    && !item.vec?.length
    && Number.isFinite(item.file?.stat?.size)
    && item.source_adapter
    && typeof item.source_adapter.should_embed === 'undefined'
    && item.should_embed === false
    && Number.isFinite(item.size)
    && item.size <= (item.settings?.min_chars || 300)
  ;
  return is_short_source
    ? '> [!warning] Note too short to embed\n> Add more text, then refresh Connections, or lower **Minimum length for sources** in Smart Environment settings.'
    : '> [!info] No results found\n> Try using the refresh button, checking your Connections filters, and checking embedding status in Smart Environment.'
  ;
}
