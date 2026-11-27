/**
 * Explain empty Connections results consistently in Core and Pro.
 * @param {object} item - The current Connections target.
 * @returns {string}
 */
export function get_connections_empty_state_html(item) {
  const is_short_source = item?.collection_key === 'smart_sources'
    && !item.vec?.length
    && Number.isFinite(item.file?.stat?.size)
    && item.source_adapter
    && typeof item.source_adapter.should_embed === 'undefined'
    && item.should_embed === false
    && Number.isFinite(item.size)
    && item.size <= (item.settings?.min_chars || 300)
  ;
  const guidance = is_short_source
    ? 'This note is too short to embed at the current minimum length. Add more text, then refresh Connections, or lower Minimum length for sources in Smart Environment settings.'
    : 'Try using the refresh button, checking your Connections filters, and checking embedding status in Smart Environment.'
  ;
  return `<p class="sc-no-results">No results found.<br><em>${guidance}</em></p>`;
}
