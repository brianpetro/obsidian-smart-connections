import {
  has_smart_drag_data,
  read_smart_drag_data,
} from 'obsidian-smart-env/src/utils/smart_drag_drop.js';
import { parse_dropped_obsidian_data } from 'obsidian-smart-env/src/utils/parse_dropped_obsidian_data.js';

const SMART_CONNECTIONS_COLLECTION_KEYS = new Set([
  'smart_sources',
  'smart_blocks',
]);

function normalize_path(value) {
  return String(value || '')
    .trim()
    .replace(/\\+/g, '/')
    .replace(/\/+$/g, '')
  ;
}

function get_collection_item(env, collection_key, item_key) {
  return env?.[collection_key]?.get?.(item_key)
    || env?.[collection_key]?.items?.[item_key]
    || null
  ;
}

function is_connections_target(item) {
  return Boolean(item?.key && item?.vec);
}

function resolve_native_source(env, dropped_path) {
  const exact_item = get_collection_item(env, 'smart_blocks', dropped_path)
    || get_collection_item(env, 'smart_sources', dropped_path)
  ;
  if (is_connections_target(exact_item)) return exact_item;

  const normalized_drop = normalize_path(dropped_path);
  if (!normalized_drop) return null;

  const matching_sources = Object.values(env?.smart_sources?.items || {})
    .filter(is_connections_target)
    .filter((source) => {
      const source_key = normalize_path(source.key);
      return normalized_drop.endsWith(`/${source_key}`)
        || source_key.endsWith(`/${normalized_drop}`)
      ;
    })
  ;

  return matching_sources.length === 1 ? matching_sources[0] : null;
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
  return [...parse_dropped_obsidian_data(data_transfer)]
    .map((item_key) => resolve_native_source(env, item_key))
    .filter(Boolean)
  ;
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
