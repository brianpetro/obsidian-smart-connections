/**
 * Copy only filter state modified by Connections preprocessing.
 * Frontmatter matcher rows and other read-only operands keep their identity.
 * @param {object} [filter={}]
 * @returns {object}
 */
export function copy_connections_filter(filter = {}) {
  filter ||= {};
  const copied = { ...filter };
  for (const key of [
    'exclude_keys',
    'exclude_key_starts_with_any',
    'exclude_key_ends_with_any',
    'key_includes_any',
    'exclude_key_includes_any',
  ]) {
    if (Array.isArray(filter[key])) copied[key] = [...filter[key]];
  }
  if (filter.frontmatter) {
    copied.frontmatter = { ...filter.frontmatter };
    for (const key of ['include', 'exclude']) {
      if (Array.isArray(filter.frontmatter[key])) {
        copied.frontmatter[key] = [...filter.frontmatter[key]];
      }
    }
  }
  return copied;
}
