import {
  has_smart_drag_data,
  read_smart_drag_data,
} from 'obsidian-smart-env/src/utils/smart_drag_drop.js';
import {
  classify_dropped_obsidian_entry,
  get_dropped_obsidian_entry_path,
  parse_dropped_obsidian_entries,
} from 'obsidian-smart-env/src/utils/parse_dropped_obsidian_data.js';

const SMART_CONNECTIONS_COLLECTION_KEYS = new Set([
  'smart_sources',
  'smart_blocks',
]);

function get_collection_item(env, collection_key, item_key) {
  return env?.[collection_key]?.get?.(item_key)
    || env?.[collection_key]?.items?.[item_key]
    || null
  ;
}

function is_connections_target(item) {
  return Boolean(item?.key && item?.vec);
}

function get_smart_targets(env, data_transfer) {
  const smart_drag_data = read_smart_drag_data(data_transfer);
  if (!smart_drag_data) return [];

  const targets = [];

  for (const { collection_key, item_key } of smart_drag_data.items) {
    if (!SMART_CONNECTIONS_COLLECTION_KEYS.has(collection_key)) return [];

    const target = get_collection_item(env, collection_key, item_key);
    if (!is_connections_target(target)) return [];

    targets.push(target);
  }

  return targets;
}

function get_native_targets(env, data_transfer) {
  const entries = parse_dropped_obsidian_entries(data_transfer);
  if (!entries.length) return [];

  const smart_sources = env?.smart_sources;
  const smart_fs = smart_sources?.fs || env?.fs;
  const source_items = Object.values(smart_sources?.items || {});
  const file_paths = Array.from(new Set([
    ...(smart_fs?.file_paths || []),
    ...source_items.map((source) => source?.key).filter(Boolean),
  ]));
  const available_file_paths = source_items
    .filter(is_connections_target)
    .map((source) => source.key)
  ;
  const folder_paths = smart_fs?.folder_paths || [];
  const vault_path = smart_fs?.base_path || '';
  const targets = [];

  for (const entry of entries) {
    const entry_path = get_dropped_obsidian_entry_path(entry, vault_path);
    const block = get_collection_item(env, 'smart_blocks', entry_path);
    if (block) {
      if (!is_connections_target(block)) return [];
      targets.push(block);
      continue;
    }

    const classified_entry = classify_dropped_obsidian_entry(entry, {
      file_paths,
      folder_paths,
      available_file_paths,
      vault_path,
    });
    if (
      classified_entry.kind !== 'file'
      || (
        classified_entry.status !== 'exact'
        && classified_entry.status !== 'recovered'
      )
    ) {
      return [];
    }

    const target = get_collection_item(
      env,
      'smart_sources',
      classified_entry.path,
    );
    if (!is_connections_target(target)) return [];

    targets.push(target);
  }

  return targets;
}

/**
 * Resolve dropped data into valid Connections source or block targets.
 *
 * The caller intentionally decides whether zero, one, or several resolved
 * targets are acceptable for its surface.
 *
 * @param {object} env
 * @param {DataTransfer|object} data_transfer
 * @returns {object[]}
 */
export function resolve_dropped_connections_targets(env, data_transfer) {
  const targets = has_smart_drag_data(data_transfer)
    ? get_smart_targets(env, data_transfer)
    : get_native_targets(env, data_transfer)
  ;
  const unique_targets = new Map();

  targets.forEach((target) => {
    const key = `${target.collection_key || ''}:${target.key}`;
    if (!unique_targets.has(key)) unique_targets.set(key, target);
  });

  return Array.from(unique_targets.values());
}
