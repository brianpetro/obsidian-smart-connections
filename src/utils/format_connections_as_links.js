/**
 * Formats connection results as a bullet list of links.
 * @param {Array} results
 * @param {object} connections_settings
 * @returns {string}
 */

export function format_connections_as_links(results = []) {
  if (!Array.isArray(results) || !results.length) return '';
  return results
    .map(({ item }) => {
      let lines;
      if (item.key.endsWith('}')) {
        lines = `Lines: ${item.lines.join('-')}`;
      }
      const link = get_wikilink(item);
      if (!link) return '';
      if (lines) {
        return `${link.replace(/\#\{\d+\}/, '')} (${lines})`;
      }
      return link;
    })
    .filter(Boolean)
    .join('\n');
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
