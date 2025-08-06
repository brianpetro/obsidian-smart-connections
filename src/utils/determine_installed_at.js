/**
 * Determine the correct installed_at timestamp.
 *
 * @param {number|null} current - Stored installed_at timestamp in ms.
 * @param {number|null} data_file_ctime - Creation time of data.json in ms.
 * @returns {number|null} - Earliest timestamp or current value.
 */
export function determine_installed_at(current, data_file_ctime) {
  if (typeof data_file_ctime !== 'number') return current ?? null;
  if (typeof current !== 'number' || data_file_ctime < current) return data_file_ctime;
  return current;
}
