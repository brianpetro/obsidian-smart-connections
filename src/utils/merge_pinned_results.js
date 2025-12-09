/**
 * Merge pinned results ahead of scored results while avoiding duplicates.
 * @param {Array} base_results
 * @param {object} params
 * @returns {Array}
 */
export function merge_pinned_results(base_results, params) {
  if (!params.pinned?.length) return base_results;
  const pinned_keys = new Set(params.pinned_keys || params.pinned.map(item => item.key));
  const pinned_results = params.pinned.map(item => ({
    item,
    ...(item.score?.(params) || {}),
  }));
  const filtered_results = base_results.filter(result => {
    const key = result?.item?.key;
    return key ? !pinned_keys.has(key) : true;
  });
  return [...pinned_results, ...filtered_results];
}
