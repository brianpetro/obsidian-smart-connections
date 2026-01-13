/**
 * Build Smart Context items from a Connections source and visible results.
 * @param {object} params
 * @param {import('smart-collections').CollectionItem} [params.source_item] - Current Connections entity representing the source note.
 * @param {Array<{ item: import('smart-collections').CollectionItem, score: number }>} [params.results] - Visible connection results with { item, score } shape.
 * @returns {Array<{ key: string, score: number }>} Context payload including the source item when available.
 */
export function build_connections_context_items(params = {}) {
  const { source_item, results = [] } = params;
  const items = [];
  const seen_keys = new Set();

  const append_item = (item, score) => {
    const key = item?.key;
    if (!key || seen_keys.has(key)) return;
    seen_keys.add(key);
    items.push({ key, score });
  };

  if (source_item) append_item(source_item, source_item.score ?? 1);

  results.forEach((result) => append_item(result?.item, result?.score));

  return items;
}
