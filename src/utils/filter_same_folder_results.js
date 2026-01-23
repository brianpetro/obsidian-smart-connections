/**
 * Filter out connections that are in the same folder as the source item.
 *
 * @param {Array} results - Array of connection results
 * @param {Object} source_item - The source item to compare folders against
 * @param {boolean} exclude_same_folder - Whether to exclude same folder results
 * @returns {Array} Filtered results
 */
export function filter_same_folder_results(results = [], source_item = null, exclude_same_folder = false) {
  if (!exclude_same_folder) return results;
  if (!Array.isArray(results) || !results.length) return [];
  if (!source_item?.path) return results;

  const source_folder = get_folder_path(source_item.path);

  return results.filter((result) => {
    const item = result?.item;
    if (!item?.path) return true; // Keep items without path (shouldn't happen)

    const result_folder = get_folder_path(item.path);
    return result_folder !== source_folder;
  });
}

/**
 * Extract folder path from a file path.
 * @param {string} path - Full file path
 * @returns {string} Folder path (empty string for root)
 */
function get_folder_path(path) {
  if (!path || typeof path !== 'string') return '';
  const last_slash = path.lastIndexOf('/');
  if (last_slash === -1) return ''; // File is in root
  return path.substring(0, last_slash);
}