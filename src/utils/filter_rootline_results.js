/**
 * Filter out connections that are in any ancestor folder of the source item's path.
 * 
 * For example, if source is at "Projects/AI/Research/note.md", this will exclude results from:
 * - "Projects/" (root level)
 * - "Projects/AI/" (parent level)
 * - "Projects/AI/Research/" (same folder)
 *
 * @param {Array} results - Array of connection results
 * @param {Object} source_item - The source item to compare against
 * @param {boolean} exclude_rootline - Whether to exclude rootline results
 * @returns {Array} Filtered results
 */
export function filter_rootline_results(results = [], source_item = null, exclude_rootline = false) {
  if (!exclude_rootline) return results;
  if (!Array.isArray(results) || !results.length) return [];
  if (!source_item?.path) return results;

  const rootline_folders = get_rootline_folders(source_item.path);
  
  // If source is at root (no folders), no filtering needed
  if (rootline_folders.length === 0) return results;

  return results.filter((result) => {
    const item = result?.item;
    if (!item?.path) return true; // Keep items without path

    const result_folder = get_folder_path(item.path);
    
    // Exclude if result is in any of the rootline folders
    return !rootline_folders.some(ancestor => {
      return result_folder === ancestor || result_folder.startsWith(ancestor + '/');
    });
  });
}

/**
 * Get all ancestor folder paths for a given file path.
 * @param {string} path - Full file path
 * @returns {string[]} Array of ancestor folder paths from root to immediate parent
 */
function get_rootline_folders(path) {
  if (!path || typeof path !== 'string') return [];
  
  const folder = get_folder_path(path);
  if (!folder) return []; // File is at root
  
  const parts = folder.split('/');
  const ancestors = [];
  
  for (let i = 0; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i + 1).join('/'));
  }
  
  return ancestors;
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