/**
 * Formats connection results as a bullet list of links.
 * @param {Array} results
 * @param {object} connections_settings
 * @returns {string}
 */

export function format_connections_as_links(results = []) {
  if (!Array.isArray(results) || !results.length) return '';
  return results
    .map(({ item }) => format_connection_item(item))
    .filter(Boolean)
    .join('\n');
}

/**
 * Formats a single connection item into a bullet link with optional line info.
 * @param {object} item
 * @returns {string}
 */
function format_connection_item(item) {
  if (!item?.key) return '';
  const link = get_wikilink(item);
  if (!link) return '';
  const lines = get_lines_label(item);
  if (!lines) return link;
  return `${link.replace(/\#\{\d+\}/, '')} (${lines})`;
}

/**
 * Returns a line label for block keys with line metadata.
 * @param {object} item
 * @returns {string}
 */
function get_lines_label(item) {
  if (!item?.key?.endsWith('}')) return '';
  if (!Array.isArray(item.lines) || !item.lines.length) return '';
  return `Lines: ${item.lines.join('-')}`;
}


function get_wikilink(item) {
  if (!item?.key) return '';
  const [source_key, ...block_parts] = item.key.split('#');
  const filename = source_key.split('/').pop().replace(/\.md$/i, '');
  if (block_parts.length) {
    const block_ref = block_parts.pop();
    return `- [[${filename}#${block_ref}]]`;
  }
  return `- [[${filename}]]`;
}
